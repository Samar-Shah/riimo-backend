import { Kysely, sql } from 'kysely';
import { Database } from '../src/database/types';

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS vector`.execute(db);

  await db.schema
    .createTable('behaviour_cluster')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`uuid_generate_v4()`),
    )
    .addColumn('organizationId', 'uuid', (col) =>
      col.notNull().references('organization.id').onDelete('cascade'),
    )
    .addColumn('callType', 'uuid', (col) =>
      col.notNull().references('call_type.id').onDelete('cascade'),
    )
    .addColumn('type', 'text', (col) => col.notNull())
    // Average of member embeddings — nullable at insert, filled by the per-run stats pass.
    .addColumn('centroid', sql`vector(512)`)
    .addColumn('label', 'text', (col) => col.notNull())
    .addColumn('memberCount', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('signalPrecedingCount', 'integer', (col) =>
      col.notNull().defaultTo(0),
    )
    // Mean turn position of members — used later to bucket clusters into playbook phases.
    .addColumn('avgTurnPosition', 'real', (col) => col.notNull().defaultTo(0))
    // Member count at the last insight synthesis — drives the refresh-delta check.
    .addColumn('lastInsightMemberCount', 'integer', (col) =>
      col.notNull().defaultTo(0),
    )
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updatedAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // Assignment scans nearest centroid within org+callType+type.
  await db.schema
    .createIndex('behaviour_cluster_org_ct_type_idx')
    .ifNotExists()
    .on('behaviour_cluster')
    .columns(['organizationId', 'callType', 'type'])
    .execute();

  // HNSW on the centroid — powers nearest-cluster assignment.
  await db.schema
    .createIndex('behaviour_cluster_centroid_hnsw')
    .ifNotExists()
    .on('behaviour_cluster')
    .using('hnsw')
    .expression(sql`centroid vector_cosine_ops`)
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable('behaviour_cluster').execute();
  await sql`DROP EXTENSION IF EXISTS vector`.execute(db);
}
