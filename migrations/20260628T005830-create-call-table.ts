import { Kysely, sql } from 'kysely';
import { Database } from '../src/database/types';

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable('call')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`uuid_generate_v4()`),
    )
    .addColumn('userId', 'uuid', (col) =>
      col.notNull().references('user.id').onDelete('cascade'),
    )
    .addColumn('callTypeId', 'uuid', (col) =>
      col.notNull().references('call_type.id').onDelete('cascade'),
    )
    .addColumn('durationInSeconds', 'integer', (col) => col.notNull())
    .addColumn('totalSegments', 'integer', (col) => col.notNull())
    .addColumn('totalAnalyses', 'integer', (col) => col.notNull())
    .addColumn('finalPhase', 'integer')
    .addColumn('transcript', 'jsonb', (col) => col.notNull().defaultTo('[]'))
    .addColumn('buyingSignals', 'jsonb', (col) => col.notNull().defaultTo('[]'))
    .addColumn('patternExecutions', 'jsonb', (col) =>
      col.notNull().defaultTo('[]'),
    )
    .addColumn('isNextMeetingBooked', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .addColumn('endedAt', 'timestamptz', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updatedAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable('call').execute();
}
