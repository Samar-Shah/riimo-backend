import { betterAuth } from 'better-auth';
import { admin, bearer } from 'better-auth/plugins';
import { dialect } from '../../kysely.config';
import * as dotenv from 'dotenv';

dotenv.config();

export const auth = betterAuth({
  basePath: '/auth',
  database: {
    dialect,
    type: 'postgres',
  },
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
      },
    },
  },
  advanced: {
    database: {
      generateId: false,
    },
  },
  plugins: [admin(), bearer()],
});
