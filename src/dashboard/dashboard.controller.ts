import { Controller, Get } from '@nestjs/common';
import { Roles, Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { DashboardService } from './dashboard.service';
import { USER_ROLES } from '../constants';
import type { auth } from '../auth';
import type { Role } from '../database/types';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @Roles([USER_ROLES.ADMIN, USER_ROLES.ORG_ADMIN])
  getDashboard(@Session() session: UserSession<typeof auth>) {
    const { role, organizationId } = session.user;
    return this.dashboardService.getDashboard({
      role: role as Role,
      organizationId,
    });
  }
}
