import { PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

export const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
});

export const dbConfig = {
  dialect,
  migrations: {
    migrationFolder: path.join(__dirname, 'src', 'database', 'migrations'),
  },
};

export default dbConfig;
