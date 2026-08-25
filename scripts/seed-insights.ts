import { Kysely, sql } from 'kysely';
import { dialect } from '../kysely.config';
import { Database } from '../src/database/types';

/*
 * Seed `call` + `call_behaviour` rows for testing insight generation.
 *
 * The SEED arrays below use the ACTUAL table columns, so you can copy rows straight from
 * another DB. They link back to your existing user/org via `userId`, and to the seeded
 * calls via `callId`. Keep the ids consistent between the two arrays.
 *
 * Run:  pnpm db:seed   (after `pnpm db:migrate`)
 * Then trigger generation (cron, or a one-off calling generateInsightsForCallType('discovery')).
 *
 * Notes:
 * - `call`: need >= 10 rows total to trigger generation (warns otherwise).
 * - `call_behaviour.embedding` is a vector(512). Paste the real '[..,..]' string when copying
 *   real data; for synthetic data use oneHot(n) below (same n => same cluster, different n =>
 *   separate cluster). Keep the same `type` within a cluster.
 * - Top/Rest % needs >= 2 users with mixed isTopRep (set on the user rows themselves). One
 *   user => every cluster is 100/0.
 * - clusterId is intentionally omitted (NULL) so the pipeline picks the behaviours up.
 */

// Synthetic embedding helper (delete when pasting real embeddings). one-hot 512-vector:
// oneHot(0) ~ oneHot(0) => cosine 1 (same cluster); oneHot(0) vs oneHot(1) => cosine 0.
function oneHot(dim: number): string {
  const a = new Array<number>(512).fill(0);
  a[dim] = 1;
  return `[${a.join(',')}]`;
}

// ─── EDIT THIS ──────────────────────────────────────────────────────────────
const SEED = {
  // `call` rows — columns match the call table. Set explicit `id`s so call_behaviour.callId
  // can reference them. userId = your existing user; callTypeId = the discovery call_type id.
  calls: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      userId: 'REPLACE_WITH_USER_ID',
      callTypeId: 'REPLACE_WITH_CALLTYPE_ID',
      durationInSeconds: 600,
      totalSegments: 40,
      totalAnalyses: 5,
      endedAt: '2026-07-06T00:00:00Z',
    },
    // ... paste the rest (need >= 10 total) ...
  ],

  // `call_behaviour` rows — columns match the call_behaviour table.
  callBehaviours: [
    {
      callId: '11111111-1111-1111-1111-111111111111',
      type: 'objection',
      behaviour: 'asks about pricing early',
      turnPosition: 1,
      precededSignal: true,
      embedding: oneHot(0),
    },
    {
      callId: '11111111-1111-1111-1111-111111111111',
      type: 'objection',
      behaviour: 'asks about budget',
      turnPosition: 2,
      precededSignal: false,
      embedding: oneHot(0),
    },
    // ... paste the rest ...
  ],
} as const;
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (SEED.calls.length < 10) {
    console.warn(
      `⚠ Only ${SEED.calls.length} calls — need >= 10 to trigger generation.`,
    );
  }

  const db = new Kysely<Database>({ dialect });
  try {
    // Explicit ids are supplied (copied from source), so cast past the GeneratedAlways id type.
    await db
      .insertInto('call')
      .values(SEED.calls as never)
      .execute();

    await db
      .insertInto('call_behaviour')
      .values(
        SEED.callBehaviours.map((b) => ({
          ...b,
          embedding: sql`${b.embedding}::vector`,
        })) as never,
      )
      .execute();

    console.log(
      `Seeded ${SEED.calls.length} calls + ${SEED.callBehaviours.length} behaviours.`,
    );
  } finally {
    await db.destroy();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
