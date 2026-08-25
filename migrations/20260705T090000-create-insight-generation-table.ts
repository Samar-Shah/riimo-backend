import { Kysely, sql } from 'kysely';
import { Database } from '../src/database/types';

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable('insight_generation')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`uuid_generate_v4()`),
    )
    .addColumn('organizationId', 'uuid', (col) =>
      col.notNull().references('organization.id').onDelete('cascade'),
    )
    .addColumn('callType', 'uuid', (col) =>
      col.notNull().references('call_type.id').onDelete('cascade'),
    )
    .addColumn('lastGeneratedAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`'epoch'::timestamptz`),
    )
    .addColumn('isLocked', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    // One watermark row per (org, callType) — enables upsert + the boolean lock.
    .addUniqueConstraint('insight_generation_org_calltype_unique', [
      'organizationId',
      'callType',
    ])
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable('insight_generation').execute();
}
