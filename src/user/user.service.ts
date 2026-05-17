import { sql } from 'kysely';
import * as crypto from 'crypto';
import { hashPassword } from 'better-auth/crypto';
import type { Role } from '../database/types';
import { USER_ROLES, USER_STATUS } from '../constants';
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { EmailService } from '../email/email.service';
import { OnboardingTemplate } from '../templates/OnboardingTemplate';
import { GetAdminsQueryDto } from './dto';
import { escapeIlikePattern } from '../utils';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private db: DatabaseService,
    private emailService: EmailService,
  ) {}

  async inviteUser(name: string, email: string, role: Role) {
    const existingUser = await this.db
      .selectFrom('user')
      .selectAll()
      .where('email', '=', email)
      .executeTakeFirst();

    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    await this.db
      .insertInto('user')
      .values({
        name,
        email,
        createdAt: sql`now()`,
        updatedAt: sql`now()`,
        role,
      })
      .execute();

    await this.sendSetupEmail(email);

    return { message: 'User invited successfully, email sent' };
  }

  async getPasswordSetupInfo(token: string) {
    const verification = await this.db
      .selectFrom('verification')
      .selectAll()
      .where('value', '=', this.hashToken(token))
      .executeTakeFirst();

    if (!verification || verification.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired token');
    }

    const email = verification.identifier.replace('password-setup-', '');

    const user = await this.db
      .selectFrom('user')
      .selectAll()
      .where('email', '=', email)
      .executeTakeFirst();

    if (!user) throw new NotFoundException('User not found');

    return { email: user.email, name: user.name };
  }

  async setupPassword(token: string, password: string) {
    const verification = await this.db
      .selectFrom('verification')
      .selectAll()
      .where('value', '=', this.hashToken(token))
      .executeTakeFirst();

    if (!verification || verification.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired token');
    }

    const email = verification.identifier.replace('password-setup-', '');

    const user = await this.db
      .selectFrom('user')
      .selectAll()
      .where('email', '=', email)
      .executeTakeFirst();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hashedPassword = await hashPassword(password);

    await this.db.transaction().execute(async (tx) => {
      await tx
        .insertInto('account')
        .values({
          accountId: email,
          providerId: 'credential',
          userId: user.id,
          password: hashedPassword,
          createdAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .execute();

      await tx
        .updateTable('user')
        .where('id', '=', user.id)
        .set({
          status: USER_STATUS.ACTIVE,
          emailVerified: true,
          updatedAt: sql`now()`,
        })
        .execute();

      await tx
        .deleteFrom('verification')
        .where('id', '=', verification.id)
        .execute();
    });

    return { message: 'Password set successfully' };
  }

  async resendInvite(email: string) {
    const user = await this.db
      .selectFrom('user')
      .selectAll()
      .where('email', '=', email)
      .where('emailVerified', '=', false)
      .executeTakeFirst();

    if (!user) throw new NotFoundException('User not found');

    await this.db
      .deleteFrom('verification')
      .where('identifier', '=', `password-setup-${email}`)
      .execute();

    await this.sendSetupEmail(email);

    return { message: 'Invite resent successfully' };
  }

  private hashToken(token: string): string {
    return crypto
      .createHmac('sha256', process.env.TOKEN_SECRET!)
      .update(token)
      .digest('hex');
  }

  private async sendSetupEmail(email: string) {
    const token = crypto.randomBytes(32).toString('hex');

    await this.db
      .insertInto('verification')
      .values({
        identifier: `password-setup-${email}`,
        value: this.hashToken(token),
        expiresAt: sql`now() + interval '24 hours'`,
        createdAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .execute();

    const setupUrl = `${process.env.REACT_APP_URL}/setup-password/${token}`;
    const html = OnboardingTemplate(setupUrl);

    await this.emailService.sendEmail(
      [email],
      `Riimo <${process.env.ONBOARDING_EMAIL || 'no-reply@riimo.ai'}>`,
      'Set up your password for Riimo',
      html,
    );
  }

  async getAdminUsers({
    page,
    pageSize,
    status,
    search,
    sortBy,
    sortOrder,
  }: GetAdminsQueryDto) {
    const trimmedSearch = search?.trim() ?? '';

    // Build shared base with all WHERE conditions
    let base = this.db.selectFrom('user').where('role', '=', USER_ROLES.ADMIN);

    if (status) base = base.where('status', '=', status);
    if (trimmedSearch) {
      const pattern = `%${escapeIlikePattern(trimmedSearch)}%`;
      base = base.where((eb) =>
        eb.or([eb('name', 'ilike', pattern), eb('email', 'ilike', pattern)]),
      );
    }

    // Run count and data queries in parallel
    const [{ count }, data] = await Promise.all([
      base
        .select((eb) => eb.fn.countAll<string>().as('count'))
        .executeTakeFirstOrThrow(),
      base
        .select(['id', 'name', 'email', 'status', 'createdAt', 'updatedAt'])
        .orderBy(sortBy, sortOrder)
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .execute(),
    ]);

    const total = Number(count);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    };
  }
}
