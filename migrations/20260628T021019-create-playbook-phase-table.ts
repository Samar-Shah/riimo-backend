import { Kysely, sql } from 'kysely';
import { Database } from '../src/database/types';

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable('playbook_phase')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`uuid_generate_v4()`),
    )
    .addColumn('playbookId', 'uuid', (col) =>
      col.notNull().references('playbook.id').onDelete('cascade'),
    )
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('order', 'integer', (col) => col.notNull())
    .addColumn('confidence', 'float4', (col) => col.notNull().defaultTo(0.0))
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updatedAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  // No two phases in the same playbook can share an order.
  await db.schema
    .createIndex('playbook_phase_playbookid_order_unique')
    .on('playbook_phase')
    .columns(['playbookId', 'order'])
    .unique()
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable('playbook_phase').execute();
}

// Every playbook gets generated after 20 calls cycle
// create insights table
//
