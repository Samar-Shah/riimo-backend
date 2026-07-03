import { Kysely, sql } from 'kysely';
import { Database } from '../src/database/types';

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable('playbook_pattern')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`uuid_generate_v4()`),
    )
    .addColumn('playbookPhaseId', 'uuid', (col) =>
      col.notNull().references('playbook_phase.id').onDelete('cascade'),
    )
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('guideline', 'text', (col) => col.notNull())
    .addColumn('signalType', 'text', (col) => col.notNull())
    .addColumn('order', 'integer', (col) => col.notNull())
    .addColumn('confidence', 'float4', (col) => col.notNull().defaultTo(0.0))
    .addColumn('topRepFrequency', 'float4', (col) =>
      col.notNull().defaultTo(0.0),
    )
    .addColumn('otherRepFrequency', 'float4', (col) =>
      col.notNull().defaultTo(0.0),
    )
    .addColumn('pValue', 'float4')
    .addColumn('oddsRatio', 'float4')

    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updatedAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // No two patterns in the same phase can share an order.
  await db.schema
    .createIndex('playbook_pattern_playbook_phase_id_order_unique')
    .on('playbook_pattern')
    .columns(['playbookPhaseId', 'order'])
    .unique()
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable('playbook_pattern').execute();
}
