import { Kysely, sql } from 'kysely';
import { Database } from '../src/database/types';

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS vector`.execute(db);

  await db.schema
    .createTable('call_behaviours')
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
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable('call_behaviours').execute();
  await sql`DROP EXTENSION IF EXISTS vector`.execute(db);
}
