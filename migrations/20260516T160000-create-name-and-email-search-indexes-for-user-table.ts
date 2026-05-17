import { Kysely, sql } from 'kysely';
import { Database } from '../src/database/types';

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS user_name_trgm_idx
    ON "user" USING gin (name gin_trgm_ops)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS user_email_trgm_idx
    ON "user" USING gin (email gin_trgm_ops)
  `.execute(db);
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`DROP INDEX IF EXISTS user_email_trgm_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS user_name_trgm_idx`.execute(db);
}
