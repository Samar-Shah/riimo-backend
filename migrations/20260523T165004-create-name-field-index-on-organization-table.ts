import { Kysely, sql } from 'kysely';
import { Database } from '../src/database/types';

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    CREATE INDEX IF NOT EXISTS org_name_trgm_idx
    ON "organization" USING gin (name gin_trgm_ops)
  `.execute(db);
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`DROP INDEX IF EXISTS org_name_trgm_idx`.execute(db);
}
