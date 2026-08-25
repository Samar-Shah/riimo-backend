import { Kysely, sql } from 'kysely';
import { Database } from '../src/database/types';

export async function up(db: Kysely<Database>): Promise<void> {
  // HNSW ANN index — powers the k-NN similarity graph in insight clustering.
  // Build is heavy on large tables; raise maintenance_work_mem if needed.
  await db.schema
    .createIndex('call_behaviour_embedding_hnsw')
    .ifNotExists()
    .on('call_behaviour')
    .using('hnsw')
    .expression(sql`embedding vector_cosine_ops`)
    .execute();

  // Btree indexes — FK columns are not auto-indexed in Postgres. These speed the
  // org-selection + windowed clustering joins/filters.
  await db.schema
    .createIndex('call_behaviour_callId_idx')
    .ifNotExists()
    .on('call_behaviour')
    .column('callId')
    .execute();
  await db.schema
    .createIndex('call_userId_idx')
    .ifNotExists()
    .on('call')
    .column('userId')
    .execute();
  await db.schema
    .createIndex('call_callTypeId_createdAt_idx')
    .ifNotExists()
    .on('call')
    .columns(['callTypeId', 'createdAt'])
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema
    .dropIndex('call_behaviour_embedding_hnsw')
    .ifExists()
    .execute();
  await db.schema.dropIndex('call_behaviour_callId_idx').ifExists().execute();
  await db.schema.dropIndex('call_userId_idx').ifExists().execute();
  await db.schema
    .dropIndex('call_callTypeId_createdAt_idx')
    .ifExists()
    .execute();
}
