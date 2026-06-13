import { sql } from 'kysely';
import type { Role } from '../database/types';
import { USER_STATUS } from '../constants';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { GetUsersByRoleQueryDto } from './dto';
import { escapeIlikePattern } from '../utils';
import { auth } from '../auth';
import { UserSession } from '@thallesp/nestjs-better-auth';

@Injectable()
export class UserService {
  constructor(private db: DatabaseService) {}

  async inviteUser(
    name: string,
    email: string,
    role: Role,
    organizationId?: string,
  ) {
    const existingUser = await this.db
      .selectFrom('user')
      .selectAll()
      .where('email', '=', email)
      .executeTakeFirst();

    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    await auth.api.createUser({
      body: {
        name,
        email,
        data: { role, ...(organizationId && { organizationId }) },
      },
    });

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

  async getUsersByRole(
    {
      page,
      pageSize,
      status,
      search,
      sortBy,
      sortOrder,
    }: GetUsersByRoleQueryDto,
    role: Role,
    organizationId?: string,
  ) {
    const trimmedSearch = search?.trim() ?? '';

    // Build shared base with all WHERE conditions
    let base = this.db.selectFrom('user').where('role', '=', role);

    if (organizationId)
      base = base.where('organizationId', '=', organizationId);

    switch (status) {
      case 'deleted':
        base = base.where('isDeleted', '=', true);
        break;
      case 'banned':
        base = base.where('banned', '=', true);
        break;
      case 'invited':
        base = base.where('status', '=', USER_STATUS.INVITED);
        break;
      case 'active':
        base = base.where('status', '=', USER_STATUS.ACTIVE);
        break;
      default:
        break;
    }

    if (trimmedSearch) {
      const pattern = `%${escapeIlikePattern(trimmedSearch)}%`;
      base = base.where((eb) =>
        eb.or([eb('name', 'ilike', pattern), eb('email', 'ilike', pattern)]),
      );
    }

    // Run count and data queries in parallel
    const [{ count }, data, stats] = await Promise.all([
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
      this.getUserStats({ role, organizationId }),
    ]);

    const total = Number(count);

    return {
      data: { users: data, stats },
      meta: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    };
  }

  async getUserStats({
    role,
    excludeRole,
    organizationId,
  }: {
    role?: Role;
    excludeRole?: Role;
    organizationId?: string;
  }) {
    const stats = await this.db
      .selectFrom('user')
      .$if(!!role, (qb) => qb.where('role', '=', role!))
      .$if(!!excludeRole, (qb) => qb.where('role', '!=', excludeRole!))
      .$if(!!organizationId, (qb) =>
        qb.where('organizationId', '=', organizationId!),
      )
      .select((eb) => [
        eb.fn.countAll<number>().as('total'),
        eb.fn
          .count<number>('id')
          .filterWhere('isDeleted', '=', false)
          .filterWhere('banned', '=', false)
          .filterWhere('status', '=', USER_STATUS.INVITED)
          .as('invited'),
        eb.fn
          .count<number>('id')
          .filterWhere('isDeleted', '=', false)
          .filterWhere('banned', '=', false)
          .filterWhere('status', '=', USER_STATUS.ACTIVE)
          .as('active'),
        eb.fn
          .count<number>('id')
          .filterWhere('isDeleted', '=', false)
          .filterWhere('banned', '=', true)
          .as('banned'),
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
      banned: Number(stats.banned),
      deleted: Number(stats.deleted),
    };
  }

  async editUser(id: string, name: string, role: Role) {
    await this.db
      .updateTable('user')
      .set({
        name,
        updatedAt: sql`now()`,
      })
      .where('id', '=', id)
      .where('role', '=', role)
      .where('isDeleted', '=', false)
      .executeTakeFirstOrThrow(() => new NotFoundException('User not found'));

    return { message: 'User edited successfully' };
  }

  async deleteUser(id: string, headers: Headers, role: Role) {
    await this.db
      .updateTable('user')
      .set({ isDeleted: true, updatedAt: sql`now()` })
      .where('id', '=', id)
      .where('role', '=', role)
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
    // banExpires,
    headers,
  }: {
    id: string;
    userRole: Role;
    action: 'ban' | 'unban';
    banReason?: string;
    banExpires?: number; // number of days
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
          // TODO: Will implement this later
          // ...(banExpires && { banExpiresIn: banExpires * 24 * 60 * 60 }),
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

  async editProfile(session: UserSession, name: string) {
    await this.db
      .updateTable('user')
      .set({
        name,
        updatedAt: sql`now()`,
      })
      .where('id', '=', session.user.id)
      .where('isDeleted', '=', false)
      .executeTakeFirstOrThrow(() => new NotFoundException('User not found'));

    return { message: 'User edited successfully', session };
  }
}
