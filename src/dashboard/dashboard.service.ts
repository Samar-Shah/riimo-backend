import { ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { UserService } from '../user/user.service';
import { USER_ROLES, USER_STATUS } from '../constants';
import type { Role, Timestamp } from '../database/types';
import { lastNMonthWindows, monthWindow, percentChange } from '../utils';

interface MetricCard {
  value: number;
  change: number;
  changeType: 'percent';
  trend: 'up' | 'down';
}

const GROWTH_KEYS = ['m0', 'm1', 'm2', 'm3', 'm4', 'm5'] as const;

const ts = (date: Date) => date as unknown as Timestamp;

const percentCard = (
  total: number,
  current: number,
  previous: number,
): MetricCard => ({
  value: total,
  change: percentChange(current, previous),
  changeType: 'percent',
  trend: current >= previous ? 'up' : 'down',
});

@Injectable()
export class DashboardService {
  constructor(
    private db: DatabaseService,
    private userService: UserService,
  ) {}

  getDashboard(user: { role: Role; organizationId?: string | null }) {
    switch (user.role) {
      case USER_ROLES.ADMIN:
        return this.getAdminDashboard();
      case USER_ROLES.ORG_ADMIN:
        if (!user.organizationId)
          throw new ForbiddenException('No organization assigned');
        return this.getOrgAdminDashboard(user.organizationId);
      default:
        throw new ForbiddenException('Role not allowed on dashboard');
    }
  }

  private async getAdminDashboard() {
    const [
      userMetrics,
      organizations,
      userGrowth,
      statusBreakdown,
      topOrganizations,
      recentlyDeletedUsers,
    ] = await Promise.all([
      this.getUserMetrics({ excludeRole: USER_ROLES.ADMIN }),
      this.getOrganizationMetric(),
      this.getUserGrowth({ excludeRole: USER_ROLES.ADMIN }),
      this.getStatusBreakdown({ excludeRole: USER_ROLES.ADMIN }),
      this.getTopOrganizations(),
      this.getRecentlyDeletedUsers(),
    ]);

    return {
      role: USER_ROLES.ADMIN,
      cards: {
        totalUsers: userMetrics.totalUsers,
        organizations,
        pendingInvites: userMetrics.pendingInvites,
        deletedAccounts: userMetrics.deletedAccounts,
      },
      userGrowth,
      statusBreakdown,
      topOrganizations,
      recentlyDeletedUsers,
    };
  }

  private async getOrgAdminDashboard(organizationId: string) {
    const [userMetrics, userGrowth, statusBreakdown] = await Promise.all([
      this.getUserMetrics({ organizationId }),
      this.getUserGrowth({ organizationId }),
      this.getStatusBreakdown({ role: USER_ROLES.SALES_REP, organizationId }),
    ]);

    return {
      role: USER_ROLES.ORG_ADMIN,
      cards: {
        totalUsers: userMetrics.totalUsers,
        pendingInvites: userMetrics.pendingInvites,
        deletedAccounts: userMetrics.deletedAccounts,
      },
      userGrowth,
      statusBreakdown,
    };
  }

  private async getUserMetrics({
    organizationId,
    excludeRole,
  }: { organizationId?: string; excludeRole?: Role } = {}) {
    const now = new Date();
    const thisM = monthWindow(now.getUTCFullYear(), now.getUTCMonth());
    const lastM = monthWindow(now.getUTCFullYear(), now.getUTCMonth() - 1);

    const row = await this.db
      .selectFrom('user')
      .$if(!!organizationId, (qb) =>
        qb.where('organizationId', '=', organizationId!),
      )
      .$if(!!excludeRole, (qb) => qb.where('role', '!=', excludeRole!))
      .select((eb) => [
        // Total users (active accounts, excludes soft-deleted)
        eb.fn.count('id').as('usersTotal'),
        eb.fn
          .count('id')
          .filterWhere('createdAt', '>=', ts(thisM.start))
          .filterWhere('createdAt', '<', ts(thisM.end))
          .as('usersThis'),
        eb.fn
          .count('id')
          .filterWhere('createdAt', '>=', ts(lastM.start))
          .filterWhere('createdAt', '<', ts(lastM.end))
          .as('usersLast'),
        // Pending invites
        eb.fn
          .count('id')
          .filterWhere('isDeleted', '=', false)
          .filterWhere('banned', '=', false)
          .filterWhere('status', '=', USER_STATUS.INVITED)
          .as('invitesTotal'),
        eb.fn
          .count('id')
          .filterWhere('isDeleted', '=', false)
          .filterWhere('banned', '=', false)
          .filterWhere('status', '=', USER_STATUS.INVITED)
          .filterWhere('createdAt', '>=', ts(thisM.start))
          .filterWhere('createdAt', '<', ts(thisM.end))
          .as('invitesThis'),
        eb.fn
          .count('id')
          .filterWhere('isDeleted', '=', false)
          .filterWhere('banned', '=', false)
          .filterWhere('status', '=', USER_STATUS.INVITED)
          .filterWhere('createdAt', '>=', ts(lastM.start))
          .filterWhere('createdAt', '<', ts(lastM.end))
          .as('invitesLast'),
        // Deleted accounts. Soft-deleted rows are never updated again, so
        // updatedAt is a reliable proxy for when the deletion happened.
        eb.fn
          .count('id')
          .filterWhere('isDeleted', '=', true)
          .as('deletedTotal'),
        eb.fn
          .count('id')
          .filterWhere('isDeleted', '=', true)
          .filterWhere('updatedAt', '>=', ts(thisM.start))
          .filterWhere('updatedAt', '<', ts(thisM.end))
          .as('deletedThis'),
        eb.fn
          .count('id')
          .filterWhere('isDeleted', '=', true)
          .filterWhere('updatedAt', '>=', ts(lastM.start))
          .filterWhere('updatedAt', '<', ts(lastM.end))
          .as('deletedLast'),
      ])
      .executeTakeFirstOrThrow();

    return {
      totalUsers: percentCard(
        Number(row.usersTotal),
        Number(row.usersThis),
        Number(row.usersLast),
      ),
      pendingInvites: percentCard(
        Number(row.invitesTotal),
        Number(row.invitesThis),
        Number(row.invitesLast),
      ),
      deletedAccounts: percentCard(
        Number(row.deletedTotal),
        Number(row.deletedThis),
        Number(row.deletedLast),
      ),
    };
  }

  private async getOrganizationMetric(): Promise<MetricCard> {
    const now = new Date();
    const thisM = monthWindow(now.getUTCFullYear(), now.getUTCMonth());
    const lastM = monthWindow(now.getUTCFullYear(), now.getUTCMonth() - 1);

    const row = await this.db
      .selectFrom('organization')
      .select((eb) => [
        eb.fn.count('id').filterWhere('isDeleted', '=', false).as('total'),
        eb.fn
          .count('id')
          .filterWhere('isDeleted', '=', false)
          .filterWhere('createdAt', '>=', ts(thisM.start))
          .filterWhere('createdAt', '<', ts(thisM.end))
          .as('thisMonth'),
        eb.fn
          .count('id')
          .filterWhere('isDeleted', '=', false)
          .filterWhere('createdAt', '>=', ts(lastM.start))
          .filterWhere('createdAt', '<', ts(lastM.end))
          .as('lastMonth'),
      ])
      .executeTakeFirstOrThrow();

    return percentCard(
      Number(row.total),
      Number(row.thisMonth),
      Number(row.lastMonth),
    );
  }

  private async getUserGrowth({
    organizationId,
    excludeRole,
  }: { organizationId?: string; excludeRole?: Role } = {}) {
    const windows = lastNMonthWindows(new Date(), 6);

    const row = await this.db
      .selectFrom('user')
      .$if(!!organizationId, (qb) =>
        qb.where('organizationId', '=', organizationId!),
      )
      .$if(!!excludeRole, (qb) => qb.where('role', '!=', excludeRole!))
      .select((eb) =>
        windows.map((w, i) =>
          eb.fn
            .count('id')
            .filterWhere('isDeleted', '=', false)
            .filterWhere('createdAt', '>=', ts(w.start))
            .filterWhere('createdAt', '<', ts(w.end))
            .as(GROWTH_KEYS[i]),
        ),
      )
      .executeTakeFirstOrThrow();

    return windows.map((w, i) => ({
      label: w.label,
      count: Number(row[GROWTH_KEYS[i]]),
    }));
  }

  private async getStatusBreakdown(filter: {
    role?: Role;
    excludeRole?: Role;
    organizationId?: string;
  }) {
    const stats = await this.userService.getUserStats(filter);
    const pct = (n: number) =>
      stats.total === 0 ? 0 : Math.round((n / stats.total) * 100);

    return {
      total: stats.total,
      statuses: [
        {
          key: 'invited',
          label: 'Invited',
          count: stats.invited,
          percent: pct(stats.invited),
        },
        {
          key: 'active',
          label: 'Active',
          count: stats.active,
          percent: pct(stats.active),
        },
        {
          key: 'banned',
          label: 'Banned',
          count: stats.banned,
          percent: pct(stats.banned),
        },
        {
          key: 'deleted',
          label: 'Deleted',
          count: stats.deleted,
          percent: pct(stats.deleted),
        },
      ],
    };
  }

  private async getTopOrganizations() {
    const now = new Date();
    const thisM = monthWindow(now.getUTCFullYear(), now.getUTCMonth());
    const lastM = monthWindow(now.getUTCFullYear(), now.getUTCMonth() - 1);

    const rows = await this.db
      .selectFrom('organization')
      .leftJoin('user', (join) =>
        join
          .onRef('user.organizationId', '=', 'organization.id')
          .on('user.isDeleted', '=', false),
      )
      .where('organization.isDeleted', '=', false)
      // .where('organization.isBanned', '=', false) // Not sure yet so commented out
      .select(['organization.id as id', 'organization.name as name'])
      .select((eb) => [
        eb.fn.count('user.id').as('memberCount'),
        eb.fn
          .count('user.id')
          .filterWhere('user.createdAt', '>=', ts(thisM.start))
          .filterWhere('user.createdAt', '<', ts(thisM.end))
          .as('newThis'),
        eb.fn
          .count('user.id')
          .filterWhere('user.createdAt', '>=', ts(lastM.start))
          .filterWhere('user.createdAt', '<', ts(lastM.end))
          .as('newLast'),
      ])
      .groupBy(['organization.id', 'organization.name'])
      .orderBy((eb) => eb.fn.count('user.id'), 'desc')
      .limit(5)
      .execute();

    return rows.map((org) => ({
      id: org.id,
      name: org.name,
      memberCount: Number(org.memberCount),
      growth: percentChange(Number(org.newThis), Number(org.newLast)),
    }));
  }

  private getRecentlyDeletedUsers() {
    return this.db
      .selectFrom('user')
      .where('isDeleted', '=', true)
      .where('role', '!=', USER_ROLES.ADMIN)
      .select([
        'id',
        'name',
        'email',
        'role',
        'image',
        'updatedAt as deletedAt',
      ])
      .orderBy('updatedAt', 'desc')
      .limit(6)
      .execute();
  }
}
