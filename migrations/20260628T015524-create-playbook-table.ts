import { Kysely, sql } from 'kysely';
import { Database } from '../src/database/types';

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable('playbook')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`uuid_generate_v4()`),
    )
    .addColumn('organizationId', 'uuid', (col) =>
      col.notNull().references('organization.id').onDelete('cascade'),
    )
    .addColumn('callTypeId', 'uuid', (col) =>
      col.notNull().references('call_type.id').onDelete('cascade'),
    )
    .addColumn('version', 'integer', (col) => col.notNull())
    .addColumn('versionChange', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updatedAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // version must be unique per (organizationId, callTypeId) group.
  // Also blocks races: concurrent inserts computing the same version fail here.
  await db.schema
    .createIndex('playbook_org_calltype_version_unique')
    .on('playbook')
    .columns(['organizationId', 'callTypeId', 'version'])
    .unique()
    .execute();

  // BEFORE INSERT trigger: auto-increment version within each
  // (organizationId, callTypeId) group. Advisory lock serializes
  // concurrent inserts for the same group so MAX+1 stays correct.
  await sql`
    CREATE OR REPLACE FUNCTION playbook_set_version()
    RETURNS trigger AS $$
    BEGIN
      IF NEW."version" IS NULL THEN
        PERFORM pg_advisory_xact_lock(
          hashtextextended(NEW."organizationId"::text || ':' || NEW."callTypeId"::text, 0)
        );
        SELECT COALESCE(MAX("version"), 0) + 1
          INTO NEW."version"
          FROM playbook
         WHERE "organizationId" = NEW."organizationId"
           AND "callTypeId" = NEW."callTypeId";
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);

  await sql`
    CREATE TRIGGER playbook_set_version_trigger
    BEFORE INSERT ON playbook
    FOR EACH ROW
    EXECUTE FUNCTION playbook_set_version();
  `.execute(db);
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS playbook_set_version_trigger ON playbook`.execute(
    db,
  );
  await sql`DROP FUNCTION IF EXISTS playbook_set_version()`.execute(db);
  await db.schema.dropTable('playbook').execute();
}
