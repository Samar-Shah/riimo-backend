import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { GetOrganizationsQueryDto } from './dto';
import { escapeIlikePattern } from '../utils';
import { sql } from 'kysely';

@Injectable()
export class OrganizationService {
  constructor(private db: DatabaseService) {}

  async getOrganizations({
    page,
    pageSize,
    status,
    search,
    sortBy,
    sortOrder,
  }: GetOrganizationsQueryDto) {
    const trimmedSearch = search?.trim() ?? '';

    // Build shared base with all WHERE conditions
    let base = this.db.selectFrom('organization');

    switch (status) {
      case 'deleted':
        base = base.where('organization.isDeleted', '=', true);
        break;
      case 'banned':
        base = base.where('organization.isBanned', '=', true);
        break;
      case 'active':
        base = base
          .where('organization.isBanned', '=', false)
          .where('organization.isDeleted', '=', false);
        break;
      default:
        break;
    }

    if (trimmedSearch) {
      const pattern = `%${escapeIlikePattern(trimmedSearch)}%`;
      base = base.where((eb) =>
        eb.or([eb('organization.name', 'ilike', pattern)]),
      );
    }

    // Run count, data, and stats queries in parallel
    const [{ count }, data, stats] = await Promise.all([
      base
        .select((eb) => eb.fn.countAll<string>().as('count'))
        .executeTakeFirstOrThrow(),
      base
        .leftJoin('user', 'user.organizationId', 'organization.id')
        .select([
          'organization.id as id',
          'organization.name as name',
          'organization.isDeleted as isDeleted',
          'organization.isBanned as isBanned',
          'organization.createdAt as createdAt',
          'organization.updatedAt as updatedAt',
        ])
        .select((eb) => eb.fn.count('user.id').as('userCount'))
        .groupBy([
          'organization.id',
          'organization.name',
          'organization.isDeleted',
          'organization.isBanned',
          'organization.createdAt',
          'organization.updatedAt',
        ])
        .orderBy(`organization.${sortBy}`, sortOrder)
        .limit(pageSize)
        .offset((page - 1) * pageSize)
        .execute(),
      this.fetchOrganizationStats(),
    ]);

    const total = Number(count);

    return {
      data: {
        orgs: data.map((org) => ({
          ...org,
          userCount: Number(org.userCount),
        })),
        stats,
      },
      meta: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    };
  }

  async getOrganizationDetails(id: string) {
    return this.db
      .selectFrom('organization')
      .selectAll()
      .where('id', '=', id)
      .where('isDeleted', '=', false)
      .where('isBanned', '=', false)
      .executeTakeFirstOrThrow(
        () => new NotFoundException('Organization not found'),
      );
  }

  private async fetchOrganizationStats() {
    const stats = await this.db
      .selectFrom('organization')
      .select((eb) => [
        eb.fn
          .count<number>('id')
          .filterWhere('isDeleted', '=', false)
          .filterWhere('isBanned', '=', false)
          .as('active'),
        eb.fn
          .count<number>('id')
          .filterWhere('isBanned', '=', true)
          .as('banned'),
        eb.fn
          .count<number>('id')
          .filterWhere('isDeleted', '=', true)
          .as('deleted'),
      ])
      .executeTakeFirstOrThrow();

    return {
      active: Number(stats.active),
      banned: Number(stats.banned),
      deleted: Number(stats.deleted),
    };
  }

  async createOrganization(name: string) {
    return this.db
      .insertInto('organization')
      .values({ name })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async editOrganization(id: string, name: string) {
    await this.db
      .updateTable('organization')
      .set({ name, updatedAt: sql`now()` })
      .where('id', '=', id)
      .where('isDeleted', '=', false)
      .executeTakeFirstOrThrow(
        () => new NotFoundException('Organization not found'),
      );

    return { message: 'Organization edited successfully' };
  }

  async toggleOrganizationBan(id: string, isBanned: boolean) {
    await this.db.transaction().execute(async (tx) => {
      await tx
        .updateTable('organization')
        .set({
          isBanned,
          updatedAt: sql`now()`,
        })
        .where('id', '=', id)
        .executeTakeFirstOrThrow(
          () => new NotFoundException('Organization not found'),
        );

      const userIds = await tx
        .updateTable('user')
        .set({
          banned: isBanned,
          banExpires: null,
          banReason: isBanned ? 'Organization banned by admin' : null,
          updatedAt: sql`now()`,
        })
        .where('organizationId', '=', id)
        .returning('id')
        .execute();

      if (isBanned && userIds.length > 0)
        await tx
          .deleteFrom('session')
          .where(
            'userId',
            'in',
            userIds.map((user) => user.id),
          )
          .execute();
    });

    return {
      message: `Organization ${isBanned ? 'banned' : 'unbanned'} successfully`,
    };
  }

  async deleteOrganization(id: string) {
    await this.db.transaction().execute(async (tx) => {
      await tx
        .updateTable('organization')
        .set({ isDeleted: true, updatedAt: sql`now()` })
        .where('id', '=', id)
        .executeTakeFirstOrThrow(
          () => new NotFoundException('Organization not found'),
        );

      const userIds = await tx
        .updateTable('user')
        .set({ isDeleted: true, updatedAt: sql`now()` })
        .where('organizationId', '=', id)
        .returning('id')
        .execute();

      if (userIds.length > 0)
        await tx
          .deleteFrom('session')
          .where(
            'userId',
            'in',
            userIds.map((user) => user.id),
          )
          .execute();
    });
  }
}
