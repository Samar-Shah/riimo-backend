import { betterAuth } from 'better-auth';
import { admin, bearer } from 'better-auth/plugins';
import { dialect } from '../kysely.config';
import * as dotenv from 'dotenv';

dotenv.config();

const trustedOrigins = process.env.ORIGIN_LIST?.split(',') || [];

export const auth = betterAuth({
  basePath: '/api/auth',
  trustedOrigins,
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
    trustedOrigins: (origin) => !origin, // desktop app (no origin header)
  },
  plugins: [admin(), bearer()],
});
