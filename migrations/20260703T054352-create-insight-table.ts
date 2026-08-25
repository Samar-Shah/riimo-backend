import { Kysely, sql } from 'kysely';
import { Database } from '../src/database/types';

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable('insight')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`uuid_generate_v4()`),
    )
    .addColumn('organizationId', 'uuid', (col) =>
      col.notNull().references('organization.id').onDelete('cascade'),
    )
    .addColumn('callType', 'uuid', (col) =>
      col.notNull().references('call_type.id').onDelete('cascade'),
    )
    // Stable identity: one insight per cluster (the upsert target).
    .addColumn('clusterId', 'uuid', (col) =>
      col.notNull().references('behaviour_cluster.id').onDelete('cascade'),
    )
    .addColumn('pattern', 'text', (col) => col.notNull())
    .addColumn('signalType', 'text', (col) => col.notNull())
    // Share-of-cluster by distinct users (sum to 1). Refreshed every run.
    .addColumn('topRepFrequency', 'real', (col) => col.notNull().defaultTo(0))
    .addColumn('otherRepFrequency', 'real', (col) => col.notNull().defaultTo(0))
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    // Bumped only on material content change — drives the "New" pill + future playbook gate.
    .addColumn('updatedAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // One insight per cluster — the upsert conflict target.
  await db.schema
    .createIndex('insight_cluster_unique')
    .ifNotExists()
    .on('insight')
    .column('clusterId')
    .unique()
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable('insight').execute();
}
