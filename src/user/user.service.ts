import { sql } from 'kysely';
import type { Role } from '../database/types';
import { USER_ROLES, USER_STATUS } from '../constants';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { GetAdminsQueryDto } from './dto';
import { escapeIlikePattern } from '../utils';
import { auth } from '../auth';

@Injectable()
export class UserService {
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

    await auth.api.createUser({ body: { name, email, data: { role } } });

    await auth.api.requestPasswordReset({
      body: {
        email,
        redirectTo: `${process.env.REACT_APP_URL}/setup-password`,
      },
    });

    return { message: 'User invited successfully, email sent' };
  }

  async resendInvite(email: string) {
    const user = await this.db
      .selectFrom('user')
      .selectAll()
      .where('email', '=', email)
      .where('emailVerified', '=', false)
      .executeTakeFirst();

    if (!user) throw new NotFoundException('User not found');

    await auth.api.requestPasswordReset({
      body: {
        email,
        redirectTo: `${process.env.REACT_APP_URL}/setup-password`,
      },
    });

    return { message: 'Invite resent successfully' };
  }

  async forgotPassword(email: string) {
    const user = await this.db
      .selectFrom('user')
      .selectAll()
      .where('email', '=', email)
      .executeTakeFirst();

    if (!user) throw new NotFoundException('User not found');
    if (user.isDeleted)
      throw new BadRequestException('This user is already deleted');
    if (user.banned)
      throw new BadRequestException('This user is banned, contact your admin');
    if (!user.emailVerified)
      throw new BadRequestException(
        'This email is not verified, ask your admin to send you an invite again',
      );

    await auth.api.requestPasswordReset({
      body: {
        email,
        redirectTo: `${process.env.REACT_APP_URL}/forgot-password`,
      },
    });

    return { message: 'Password reset email sent successfully' };
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
        .select([
          'id',
          'name',
          'email',
          'status',
          'isDeleted',
          'banned',
          'banReason',
          'banExpires',
          'createdAt',
          'updatedAt',
        ])
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

  async getAdminStats() {
    const stats = await this.db
      .selectFrom('user')
      .where('role', '=', USER_ROLES.ADMIN)
      .select((eb) => [
        eb.fn.countAll<number>().as('total'),
        eb.fn
          .count<number>('id')
          .filterWhere('status', '=', USER_STATUS.INVITED)
          .as('invited'),
        eb.fn
          .count<number>('id')
          .filterWhere('status', '=', USER_STATUS.ACTIVE)
          .as('active'),
        eb.fn
          .count<number>('id')
          .filterWhere('banned', '=', true)
          .as('blocked'),
        eb.fn
          .count<number>('id')
          .filterWhere('isDeleted', '=', true)
          .as('deleted'),
      ])
      .executeTakeFirstOrThrow();

    return {
      total: Number(stats.total),
      invited: Number(stats.invited),
      active: Number(stats.active),
      blocked: Number(stats.blocked),
      deleted: Number(stats.deleted),
    };
  }

  async editAdminUser(id: string, name: string) {
    await this.db
      .updateTable('user')
      .set({
        name,
        updatedAt: sql`now()`,
      })
      .where('id', '=', id)
      .where('role', '=', USER_ROLES.ADMIN)
      .where('isDeleted', '=', false)
      .executeTakeFirstOrThrow(() => new NotFoundException('User not found'));

    return { message: 'User edited successfully' };
  }

  async deleteAdminUser(id: string, headers: Headers) {
    await this.db
      .updateTable('user')
      .set({ isDeleted: true, updatedAt: sql`now()` })
      .where('id', '=', id)
      .where('role', '=', USER_ROLES.ADMIN)
      .where('isDeleted', '=', false)
      .executeTakeFirstOrThrow();

    await auth.api.revokeUserSessions({ body: { userId: id }, headers });

    return { message: 'User deleted successfully' };
  }

  async toggleUserBan({
    id,
    userRole,
    action,
    banReason,
    banExpires,
    headers,
  }: {
    id: string;
    userRole: Role;
    action: 'ban' | 'unban';
    banReason?: string;
    banExpires?: number;
    headers: Headers;
  }) {
    const user = await this.db
      .selectFrom('user')
      .selectAll()
      .where('id', '=', id)
      .where('role', '=', userRole)
      .executeTakeFirstOrThrow();

    if (!user) throw new NotFoundException('User not found');
    if (user.isDeleted)
      throw new BadRequestException('User is already deleted');

    if (action === 'ban') {
      await auth.api.banUser({
        body: {
          userId: id,
          ...(banReason && { banReason }),
          ...(banExpires && { banExpiresIn: banExpires }),
        },
        headers,
      });
      return { message: `User banned successfully` };
    }

    await auth.api.unbanUser({
      body: { userId: id },
      headers,
    });
    return { message: `User unbanned successfully` };
  }
}
