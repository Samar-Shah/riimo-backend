import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { sql } from 'kysely';
import { DatabaseService } from '../database/database.service';
import { CALL_TYPES, INSIGHT_CONFIG } from '../constants';
import {
  assignUnassignedBehaviours,
  clusterUnmatched,
  refreshClusterStats,
  getChangedClusters,
} from './insight.clustering';
import { synthesizeInsights, GeneratedInsight } from './insight.synthesis';

@Injectable()
export class InsightService {
  private readonly logger = new Logger(InsightService.name);

  constructor(private db: DatabaseService) {}

  /**
   * SAFETY-NET CRON entry — batch-scan every qualifying org for one call type.
   * Qualifying = >= CALLS_PER_GENERATION new calls since the org's watermark.
   */
  async generateInsightsForCallType(callTypeName: string): Promise<void> {
    const callType = await this.db
      .selectFrom('call_type')
      .where('name', '=', callTypeName)
      .select('id')
      .executeTakeFirst();
    if (!callType) {
      this.logger.warn(`Unknown call type ${callTypeName}`);
      return;
    }

    // `>=` so an overshoot (11, 15, 50 new calls) still triggers; never checks exactly N.
    // Date comparison + count done in SQL (no server/DB clock skew).
    const orgs = await this.db
      .selectFrom('organization as o')
      .innerJoin('user as u', 'u.organizationId', 'o.id')
      .innerJoin('call as c', 'c.userId', 'u.id')
      .leftJoin('insight_generation as ig', (j) =>
        j
          .onRef('ig.organizationId', '=', 'o.id')
          .on('ig.callType', '=', callType.id),
      )
      .where('o.isDeleted', '=', false)
      .where('o.isBanned', '=', false)
      .where('c.callTypeId', '=', callType.id)
      .where(
        sql<boolean>`c."createdAt" > COALESCE(ig."lastGeneratedAt", 'epoch'::timestamptz)`,
      )
      .groupBy('o.id')
      .having((eb) =>
        eb(eb.fn.count('c.id'), '>=', INSIGHT_CONFIG.CALLS_PER_GENERATION),
      )
      .select('o.id as id')
      .execute();

    for (const org of orgs) {
      try {
        await this.generateForOrg(org.id, callType.id);
      } catch (e) {
        // Boundary unchanged -> the next cron run re-qualifies & retries this org
        // automatically. No explicit retry logic. (Optional: failure log for observability.)
        this.logger.error(`Insight gen failed org=${org.id}`, e as Error);
      }
    }
  }

  /**
   * EVENT-DRIVEN entry — call after a call is saved. NOTE: no call-insert path exists
   * in the backend yet (calls are written by external ingestion), so this stays dormant
   * until that lands. When wired, pass the org + resolved call_type.id.
   */
  async maybeGenerate(orgId: string, callTypeId: string): Promise<void> {
    const row = await this.db
      .selectFrom('call as c')
      .innerJoin('user as u', 'c.userId', 'u.id')
      .leftJoin('insight_generation as ig', (j) =>
        j
          .onRef('ig.organizationId', '=', 'u.organizationId')
          .on('ig.callType', '=', callTypeId),
      )
      .where('u.organizationId', '=', orgId)
      .where('c.callTypeId', '=', callTypeId)
      .where(
        sql<boolean>`c."createdAt" > COALESCE(ig."lastGeneratedAt", 'epoch'::timestamptz)`,
      )
      .select((eb) => eb.fn.count('c.id').as('newCalls'))
      .executeTakeFirst();

    if (!row || Number(row.newCalls) < INSIGHT_CONFIG.CALLS_PER_GENERATION)
      return;
    await this.generateForOrg(orgId, callTypeId);
  }

  /**
   * Shared unit. A 2-column lock on the watermark row (isLocked + lastGeneratedAt)
   * serializes the event trigger and the cron per (org, callType).
   *
   * Incremental pipeline: assign new behaviours to existing clusters -> mini-cluster the
   * leftovers -> refresh cluster stats -> (re)synthesize only materially-changed clusters
   * -> refresh rep-frequency stats on all insights.
   */
  private async generateForOrg(
    orgId: string,
    callTypeId: string,
  ): Promise<void> {
    // Ensure a row exists to lock against (lastGeneratedAt defaults to 'epoch').
    await this.db
      .insertInto('insight_generation')
      .values({ organizationId: orgId, callType: callTypeId })
      .onConflict((oc) =>
        oc.columns(['organizationId', 'callType']).doNothing(),
      )
      .execute();

    // Obtain the lock: win only if unlocked, OR the lock is stale (crashed run).
    // Returns now() = the lock-acquisition time T.
    const lock = await this.db
      .updateTable('insight_generation')
      .set({ isLocked: true })
      .where('organizationId', '=', orgId)
      .where('callType', '=', callTypeId)
      .where(
        sql<boolean>`("isLocked" = false OR "lastGeneratedAt" < now() - make_interval(mins => ${sql.lit(
          INSIGHT_CONFIG.GENERATION_LOCK_TTL_MINUTES,
        )}))`,
      )
      .returning(sql<Date>`now()`.as('lockedAt'))
      .executeTakeFirst();
    if (!lock) return; // another run holds the lock — skip

    try {
      // 1. assign unassigned behaviours to their nearest existing cluster
      const assigned = await assignUnassignedBehaviours(
        this.db,
        orgId,
        callTypeId,
      );
      // 2. mini-cluster the leftovers into new clusters
      const created = await clusterUnmatched(this.db, orgId, callTypeId);
      // 3. recompute stats only for the clusters that changed this run
      const touched = [...new Set([...assigned, ...created])];
      await refreshClusterStats(this.db, touched);

      // 4. (re)synthesize only clusters that grew enough since their last insight
      const refreshIds = new Set(touched);
      const changed = await getChangedClusters(this.db, orgId, callTypeId);
      if (changed.length) {
        const sentIds = changed.map((c) => c.id);
        const known = new Set(sentIds);
        const insights = (await synthesizeInsights(changed)).filter((i) =>
          known.has(i.ref),
        );
        if (insights.length) {
          await this.upsertInsights(orgId, callTypeId, insights);
          insights.forEach((i) => refreshIds.add(i.ref));
        }
        // Advance the synthesis watermark for ALL sent clusters — including any the LLM
        // skipped — so weak clusters aren't re-sent (and re-billed) every run.
        await this.db
          .updateTable('behaviour_cluster')
          .set({ lastInsightMemberCount: sql`"memberCount"` })
          .where('id', 'in', sentIds)
          .execute();
      }

      // 5. refresh rep-frequency stats only on insights whose clusters changed / are new
      await this.refreshInsightRepFrequencies([...refreshIds]);

      // Success: advance boundary to the lock time T + release the lock.
      await this.db
        .updateTable('insight_generation')
        .set({ lastGeneratedAt: sql`${lock.lockedAt}`, isLocked: false })
        .where('organizationId', '=', orgId)
        .where('callType', '=', callTypeId)
        .execute();
    } catch (e) {
      // Failure: release the lock only; previous boundary stays -> next cron run retries.
      await this.db
        .updateTable('insight_generation')
        .set({ isLocked: false })
        .where('organizationId', '=', orgId)
        .where('callType', '=', callTypeId)
        .execute();
      throw e; // caller logs it
    }
  }

  /** Upsert one insight per cluster in a single statement (conflict on the unique clusterId). */
  private async upsertInsights(
    orgId: string,
    callTypeId: string,
    insights: GeneratedInsight[],
  ): Promise<void> {
    await this.db
      .insertInto('insight')
      .values(
        insights.map((i) => ({
          organizationId: orgId,
          callType: callTypeId,
          clusterId: i.ref,
          pattern: i.pattern,
          signalType: i.signalType,
        })),
      )
      .onConflict((oc) =>
        oc.column('clusterId').doUpdateSet((eb) => ({
          pattern: eb.ref('excluded.pattern'),
          signalType: eb.ref('excluded.signalType'),
          updatedAt: sql`now()`, // material change -> drives the "New" pill
        })),
      )
      .execute();
  }

  /**
   * Refresh share-of-cluster rep frequencies (by distinct users, summing to 1) for the
   * given clusters' insights. Scoped to the clusters that changed this run; clusterId alone
   * identifies the insight, so no org/callType filter is needed. Never touches updatedAt.
   */
  private async refreshInsightRepFrequencies(
    clusterIds: string[],
  ): Promise<void> {
    if (!clusterIds.length) return;
    await sql`
      UPDATE insight AS i
      SET "topRepFrequency" = f.top_freq,
          "otherRepFrequency" = f.other_freq
      FROM (
        SELECT cb."clusterId" AS cid,
               count(DISTINCT c."userId") FILTER (WHERE u."isTopRep")::real
                 / NULLIF(count(DISTINCT c."userId"), 0) AS top_freq,
               count(DISTINCT c."userId") FILTER (WHERE NOT u."isTopRep")::real
                 / NULLIF(count(DISTINCT c."userId"), 0) AS other_freq
        FROM call_behaviour cb
        JOIN call c ON cb."callId" = c.id
        JOIN "user" u ON c."userId" = u.id
        WHERE cb."clusterId" = ANY(${clusterIds}::uuid[])
        GROUP BY cb."clusterId"
      ) f
      WHERE i."clusterId" = f.cid
    `.execute(this.db);
  }

  /**
   * Safety-net cron — one thin method per call type keeps a single cron from being
   * overloaded. Adjust the cadence as needed (the real gate is CALLS_PER_GENERATION).
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async discoveryInsightsCron(): Promise<void> {
    await this.generateInsightsForCallType(CALL_TYPES.DISCOVERY);
  }
}
