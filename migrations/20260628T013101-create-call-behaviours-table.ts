import { Kysely, sql } from 'kysely';
import { Database } from '../src/database/types';

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable('call_behaviour')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`uuid_generate_v4()`),
    )
    .addColumn('callId', 'uuid', (col) =>
      col.notNull().references('call.id').onDelete('cascade'),
    )
    .addColumn('type', 'text', (col) => col.notNull())
    .addColumn('behaviour', 'text', (col) => col.notNull())
    .addColumn('turnPosition', 'integer', (col) => col.notNull())
    .addColumn('precededSignal', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .addColumn('embedding', sql`vector(512)`)
    // Incremental-clustering watermark: NULL = not yet assigned to a cluster.
    .addColumn('clusterId', 'uuid', (col) =>
      col.references('behaviour_cluster.id').onDelete('set null'),
    )
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // Partial index — the incremental scan is "WHERE clusterId IS NULL".
  await db.schema
    .createIndex('call_behaviour_unassigned_idx')
    .ifNotExists()
    .on('call_behaviour')
    .column('clusterId')
    .where('clusterId', 'is', null)
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable('call_behaviour').execute();
}
