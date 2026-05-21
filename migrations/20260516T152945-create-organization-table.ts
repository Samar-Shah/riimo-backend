import { Kysely, sql } from 'kysely';
import { Database } from '../src/database/types';

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable('organization')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`uuid_generate_v4()`),
    )
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('isBlocked', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('isDeleted', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updatedAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .alterTable('user')
    .addColumn('organizationId', 'uuid', (col) =>
      col.references('organization.id').onDelete('set null'),
    )
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.alterTable('user').dropColumn('organizationId').execute();
  await db.schema.dropTable('organization').execute();
}
