import { Kysely, sql } from 'kysely';
import { Database } from '../src/database/types';

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`.execute(db);
  await sql`CREATE EXTENSION IF NOT EXISTS vector`.execute(db);

  await db.schema
    .createTable('user')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`uuid_generate_v4()`),
    )
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('invited'))
    .addColumn('email', 'text', (col) => col.notNull().unique())
    .addColumn('emailVerified', 'boolean', (col) =>
      col.notNull().defaultTo(false),
    )
    .addColumn('isDeleted', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('role', 'text', (col) => col.notNull())
    .addColumn('banned', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('banReason', 'text')
    .addColumn('banExpires', 'timestamptz')
    .addColumn('image', 'text')
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updatedAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createTable('session')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`uuid_generate_v4()`),
    )
    .addColumn('token', 'text', (col) => col.notNull().unique())
    .addColumn('expiresAt', 'timestamptz', (col) => col.notNull())
    .addColumn('ipAddress', 'text')
    .addColumn('userAgent', 'text')
    .addColumn('userId', 'uuid', (col) =>
      col.notNull().references('user.id').onDelete('cascade'),
    )
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updatedAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createTable('account')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`uuid_generate_v4()`),
    )
    .addColumn('accountId', 'text', (col) => col.notNull())
    .addColumn('providerId', 'text', (col) => col.notNull())
    .addColumn('userId', 'uuid', (col) =>
      col.notNull().references('user.id').onDelete('cascade'),
    )
    .addColumn('accessToken', 'text')
    .addColumn('refreshToken', 'text')
    .addColumn('idToken', 'text')
    .addColumn('accessTokenExpiresAt', 'timestamptz')
    .addColumn('refreshTokenExpiresAt', 'timestamptz')
    .addColumn('scope', 'text')
    .addColumn('password', 'text')
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updatedAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();

  await db.schema
    .createTable('verification')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`uuid_generate_v4()`),
    )
    .addColumn('identifier', 'text', (col) => col.notNull())
    .addColumn('value', 'text', (col) => col.notNull())
    .addColumn('expiresAt', 'timestamptz', (col) => col.notNull())
    .addColumn('createdAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .addColumn('updatedAt', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`now()`),
    )
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable('verification').execute();
  await db.schema.dropTable('account').execute();
  await db.schema.dropTable('session').execute();
  await db.schema.dropTable('user').execute();

  await sql`DROP EXTENSION IF EXISTS vector`.execute(db);
  await sql`DROP EXTENSION IF EXISTS "uuid-ossp"`.execute(db);
}
