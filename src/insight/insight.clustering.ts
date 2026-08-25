import { sql } from 'kysely';
import { DatabaseService } from '../database/database.service';
import { INSIGHT_CONFIG } from '../constants';

/** A cluster that changed enough to (re)synthesize an insight for. */
export interface ClusterForSynthesis {
  id: string;
  type: string;
  label: string;
  memberCount: number;
  signalPrecedingCount: number;
}

/**
 * Union-Find (disjoint set) with path compression + union by rank.
 * Used only to mini-cluster the behaviours that don't match any existing cluster.
 */
class UnionFind {
  private parent: number[];
  private rank: number[];

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Array<number>(n).fill(0);
  }

  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }

  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    if (this.rank[ra] < this.rank[rb]) {
      this.parent[ra] = rb;
    } else if (this.rank[ra] > this.rank[rb]) {
      this.parent[rb] = ra;
    } else {
      this.parent[rb] = ra;
      this.rank[ra] += 1;
    }
  }
}

/**
 * Step 1 — assign every unassigned behaviour (clusterId IS NULL) to its nearest existing
 * cluster centroid of the same type, if within the similarity threshold. One set-based
 * UPDATE; embeddings never leave Postgres. Returns the ids of clusters that gained members.
 */
export async function assignUnassignedBehaviours(
  db: DatabaseService,
  orgId: string,
  callTypeId: string,
): Promise<string[]> {
  const res = await sql<{ clusterId: string }>`
    UPDATE call_behaviour AS cb
    SET "clusterId" = m.cluster_id
    FROM (
      SELECT b.id AS beh_id, nn.cluster_id
      FROM call_behaviour b
      JOIN call c ON b."callId" = c.id
      JOIN "user" u ON c."userId" = u.id
      CROSS JOIN LATERAL (
        SELECT bc.id AS cluster_id, bc.centroid <=> b.embedding AS dist
        FROM behaviour_cluster bc
        WHERE bc."organizationId" = ${orgId} AND bc."callType" = ${callTypeId}
          AND bc.type = b.type AND bc.centroid IS NOT NULL
        ORDER BY bc.centroid <=> b.embedding
        LIMIT 1
      ) nn
      WHERE b."clusterId" IS NULL AND b.embedding IS NOT NULL
        AND u."organizationId" = ${orgId} AND c."callTypeId" = ${callTypeId}
        AND 1 - nn.dist >= ${INSIGHT_CONFIG.SIMILARITY_THRESHOLD}
    ) m
    WHERE cb.id = m.beh_id
    RETURNING cb."clusterId" AS "clusterId"
  `.execute(db);

  return [...new Set(res.rows.map((r) => r.clusterId))];
}

/**
 * Step 2 — mini-cluster the behaviours that still have no cluster (HNSW k-NN graph among
 * the unassigned set of the same type + union-find). Groups of >= MIN_CLUSTER_SIZE become
 * new behaviour_cluster rows; leftover singletons stay NULL and retry next run. This is
 * also the cold-start path. Returns the ids of the clusters created.
 */
export async function clusterUnmatched(
  db: DatabaseService,
  orgId: string,
  callTypeId: string,
): Promise<string[]> {
  const behaviours = await db
    .selectFrom('call_behaviour as cb')
    .innerJoin('call as c', 'cb.callId', 'c.id')
    .innerJoin('user as u', 'c.userId', 'u.id')
    .where('u.organizationId', '=', orgId)
    .where('c.callTypeId', '=', callTypeId)
    .where('cb.clusterId', 'is', null)
    .where('cb.embedding', 'is not', null)
    .select(['cb.id', 'cb.type', 'cb.behaviour', 'cb.precededSignal'])
    .execute();

  if (behaviours.length < INSIGHT_CONFIG.MIN_CLUSTER_SIZE) return [];

  const edges = await sql<{ idA: string; idB: string }>`
    SELECT cb.id AS "idA", nn.id AS "idB"
    FROM call_behaviour cb
    JOIN call c ON cb."callId" = c.id
    JOIN "user" u ON c."userId" = u.id
    CROSS JOIN LATERAL (
      SELECT cb2.id, cb2.embedding <=> cb.embedding AS dist
      FROM call_behaviour cb2
      JOIN call c2 ON cb2."callId" = c2.id
      JOIN "user" u2 ON c2."userId" = u2.id
      WHERE u2."organizationId" = ${orgId} AND c2."callTypeId" = ${callTypeId}
        AND cb2."clusterId" IS NULL AND cb2.type = cb.type
        AND cb2.id <> cb.id AND cb2.embedding IS NOT NULL
      ORDER BY cb2.embedding <=> cb.embedding
      LIMIT ${INSIGHT_CONFIG.KNN_K}
    ) nn
    WHERE u."organizationId" = ${orgId} AND c."callTypeId" = ${callTypeId}
      AND cb."clusterId" IS NULL AND cb.embedding IS NOT NULL
      AND 1 - nn.dist >= ${INSIGHT_CONFIG.SIMILARITY_THRESHOLD}
  `.execute(db);

  const idToIdx = new Map<string, number>();
  behaviours.forEach((b, i) => idToIdx.set(b.id, i));

  const uf = new UnionFind(behaviours.length);
  for (const { idA, idB } of edges.rows) {
    const a = idToIdx.get(idA);
    const b = idToIdx.get(idB);
    if (a !== undefined && b !== undefined) uf.union(a, b);
  }

  const groups = new Map<number, number[]>();
  for (let i = 0; i < behaviours.length; i++) {
    const root = uf.find(i);
    const members = groups.get(root);
    if (members) members.push(i);
    else groups.set(root, [i]);
  }

  // Build the new clusters (drop singletons; label = most common behaviour text).
  const newGroups: { type: string; label: string; memberIds: string[] }[] = [];
  for (const members of groups.values()) {
    if (members.length < INSIGHT_CONFIG.MIN_CLUSTER_SIZE) continue;

    const textCounts = new Map<string, number>();
    for (const idx of members) {
      const text = behaviours[idx].behaviour;
      textCounts.set(text, (textCounts.get(text) ?? 0) + 1);
    }
    let label = '';
    let bestCount = -1;
    for (const [text, count] of textCounts) {
      if (count > bestCount) {
        bestCount = count;
        label = text;
      }
    }

    newGroups.push({
      type: behaviours[members[0]].type,
      label,
      memberIds: members.map((i) => behaviours[i].id),
    });
  }

  if (!newGroups.length) return [];

  // One insert. counts/centroid left to refreshClusterStats. Postgres returns the rows in
  // VALUES order for a single INSERT, so inserted[i] lines up with newGroups[i].
  const inserted = await db
    .insertInto('behaviour_cluster')
    .values(
      newGroups.map((g) => ({
        organizationId: orgId,
        callType: callTypeId,
        type: g.type,
        label: g.label,
      })),
    )
    .returning('id')
    .execute();

  // One set-based assignment via unnest of parallel (behaviourId, clusterId) arrays.
  const behaviourIds: string[] = [];
  const clusterIds: string[] = [];
  newGroups.forEach((g, i) => {
    for (const bid of g.memberIds) {
      behaviourIds.push(bid);
      clusterIds.push(inserted[i].id);
    }
  });

  await sql`
    UPDATE call_behaviour AS cb
    SET "clusterId" = m.cid
    FROM unnest(${behaviourIds}::uuid[], ${clusterIds}::uuid[]) AS m(bid, cid)
    WHERE cb.id = m.bid
  `.execute(db);

  return inserted.map((r) => r.id);
}

/**
 * Step 3 — recompute centroid + counts for the given clusters from their current members.
 * One set-based UPDATE (pgvector avg()). Scoped to the clusters touched this run — clusterId
 * alone identifies the cluster, so no org/callType join is needed.
 */
export async function refreshClusterStats(
  db: DatabaseService,
  clusterIds: string[],
): Promise<void> {
  if (!clusterIds.length) return;

  await sql`
    UPDATE behaviour_cluster AS bc
    SET centroid = agg.centroid,
        "memberCount" = agg.cnt,
        "signalPrecedingCount" = agg.sig,
        "avgTurnPosition" = agg.avg_turn,
        "updatedAt" = now()
    FROM (
      SELECT cb."clusterId" AS cid,
             avg(cb.embedding) AS centroid,
             count(*) AS cnt,
             count(*) FILTER (WHERE cb."precededSignal") AS sig,
             avg(cb."turnPosition") AS avg_turn
      FROM call_behaviour cb
      WHERE cb."clusterId" = ANY(${clusterIds}::uuid[])
      GROUP BY cb."clusterId"
    ) agg
    WHERE bc.id = agg.cid
  `.execute(db);
}

/**
 * Step 4 — clusters big enough AND grown enough since their last insight (or never had
 * one). Scans the small behaviour_cluster table (not behaviours), so it stays global to
 * catch clusters that overflowed the LLM cap in a previous run. Capped + biggest first.
 */
export async function getChangedClusters(
  db: DatabaseService,
  orgId: string,
  callTypeId: string,
): Promise<ClusterForSynthesis[]> {
  const rows = await db
    .selectFrom('behaviour_cluster')
    .where('organizationId', '=', orgId)
    .where('callType', '=', callTypeId)
    .where('memberCount', '>=', INSIGHT_CONFIG.MIN_CLUSTER_SIZE)
    // never synthesized (lastInsightMemberCount = 0) OR grown by the refresh delta since last insight
    .where(
      sql<boolean>`("lastInsightMemberCount" = 0 OR "memberCount" - "lastInsightMemberCount" >= ${sql.lit(
        INSIGHT_CONFIG.INSIGHT_REFRESH_DELTA,
      )})`,
    )
    .orderBy('memberCount', 'desc')
    .limit(INSIGHT_CONFIG.MAX_CLUSTERS_TO_LLM)
    .select(['id', 'type', 'label', 'memberCount', 'signalPrecedingCount'])
    .execute();
  return rows;
}
