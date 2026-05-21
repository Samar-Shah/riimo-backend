import { APIError, betterAuth } from 'better-auth';
import { admin, bearer } from 'better-auth/plugins';
import { dialect } from '../kysely.config';
import { OnboardingTemplate } from './templates/OnboardingTemplate';
import { EmailService } from './email/email.service';
import { DatabaseService } from './database/database.service';
import { ResetPasswordTemplate } from './templates/ResetPasswordTemplate';
import { USER_STATUS } from './constants';
import { sql } from 'kysely';

const trustedOrigins = process.env.ORIGIN_LIST?.split(',') || [];

let emailService: EmailService;
let dbService: DatabaseService;

export const setEmailService = (service: EmailService) => {
  emailService = service;
};

export const setDbService = (service: DatabaseService) => {
  dbService = service;
};

export const auth = betterAuth({
  // config
  basePath: '/api/auth',
  trustedOrigins,
  database: {
    dialect,
    type: 'postgres',
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: true,
      },
      isDeleted: {
        type: 'boolean',
        required: true,
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

  // callbacks
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60 * 24, // 24 hours
    sendResetPassword: async ({ user, url }) => {
      const html = user.emailVerified
        ? ResetPasswordTemplate(url)
        : OnboardingTemplate(url);

      const subject = user.emailVerified
        ? 'Reset your password for Riimo'
        : 'Set up your password for Riimo';

      await emailService.sendEmail(
        [user.email],
        `Riimo <${process.env.ONBOARDING_EMAIL || 'no-reply@riimo.ai'}>`,
        subject,
        html,
      );
    },
    onPasswordReset: async ({ user }) => {
      if (user.emailVerified) return;
      await dbService
        .updateTable('user')
        .where('id', '=', user.id)
        .set({
          emailVerified: true,
          status: USER_STATUS.ACTIVE,
          updatedAt: sql`now()`,
        })
        .execute();
    },
  },

  // Hooks
  databaseHooks: {
    account: {
      create: {
        before: async (account) => {
          if (account.userId) {
            const user = await dbService!
              .selectFrom('user')
              .selectAll()
              .where('isDeleted', '=', false)
              .where('id', '=', account.userId)
              .executeTakeFirst();

            if (!user) throw new APIError(404, { message: 'User not found' });
          }

          return { data: { ...account } };
        },
      },
    },
  },
});
