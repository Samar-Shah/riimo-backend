import { sql } from 'kysely';
import * as crypto from 'crypto';
import { hashPassword } from 'better-auth/crypto';
import { Role } from '../database/types';
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private db: DatabaseService) {}

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
        emailVerified: false,
        createdAt: sql`now()`,
        updatedAt: sql`now()`,
        role,
      })
      .execute();

    await this.sendSetupEmail(email);

    return { message: 'User invited successfully, email sent' };
  }

  async setupPassword(token: string, email: string, password: string) {
    const user = await this.db
      .selectFrom('user')
      .selectAll()
      .where('email', '=', email)
      .executeTakeFirst();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const verification = await this.db
      .selectFrom('verification')
      .selectAll()
      .where('identifier', '=', `password-setup-${email}`)
      .where('value', '=', this.hashToken(token))
      .executeTakeFirst();

    if (!verification || verification.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired token');
    }

    const hashedPassword = await hashPassword(password);

    await this.db
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

    await this.db
      .deleteFrom('verification')
      .where('identifier', '=', `password-setup-${email}`)
      .execute();

    return { message: 'Password set successfully' };
  }

  async resendInvite(email: string) {
    const user = await this.db
      .selectFrom('user')
      .selectAll()
      .where('email', '=', email)
      .executeTakeFirst();

    if (!user) {
      throw new NotFoundException('User not found');
    }

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

    const setupUrl = `${process.env.REACT_APP_URL}/setup-password?token=${token}&email=${encodeURIComponent(email)}`;
    this.logger.log(`[MOCK EMAIL] To: ${email}`);
    this.logger.log(`[MOCK EMAIL] Subject: Set up your password for Riimo`);
    this.logger.log(
      `[MOCK EMAIL] Body: Click to set up your password: ${setupUrl}`,
    );
  }
}
