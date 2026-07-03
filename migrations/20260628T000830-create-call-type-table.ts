import { Kysely, sql } from 'kysely';
import { Database } from '../src/database/types';

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable('call_type')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`uuid_generate_v4()`),
    )
    .addColumn('name', 'text', (col) => col.notNull())
    .execute();

  await db.insertInto('call_type').values({ name: 'discovery' }).execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable('call_type').execute();
}
