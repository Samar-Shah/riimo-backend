import { Kysely, sql } from 'kysely';
import { Database } from '../src/database/types';

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable('insight')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`uuid_generate_v4()`),
    )
    .addColumn('pattern', 'text', (col) => col.notNull())
    .addColumn('signalType', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable('insight').execute();
}
