import { Kysely, sql } from 'kysely';
import { Database } from '../src/database/types';

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable('crash_report')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`uuid_generate_v4()`),
    )
    .addColumn('userId', 'uuid', (col) =>
      col.notNull().references('user.id').onDelete('cascade'),
    )
    .addColumn('callId', 'uuid', (col) =>
      col.references('call.id').onDelete('cascade'),
    )
    .addColumn('appVersion', 'text', (col) => col.notNull())
    .addColumn('os', 'text', (col) => col.notNull())
    .addColumn('panic_message', 'text', (col) => col.notNull())
    .addColumn('panic_location', 'text')
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable('crash_report').execute();
}
