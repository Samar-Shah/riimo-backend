import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Session,
} from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { Roles } from '@thallesp/nestjs-better-auth';
import { USER_ROLES } from '../constants';
import { GetOrganizationsQueryDto } from './dto';
import type { AppSession } from '../auth';

@Controller('organization')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  @Roles([USER_ROLES.ADMIN])
  getOrganizations(@Query() queryDto: GetOrganizationsQueryDto) {
    return this.organizationService.getOrganizations(queryDto);
  }

  @Get('self')
  @Roles([USER_ROLES.ORG_ADMIN, USER_ROLES.SALES_REP])
  getUserOrganization(@Session() session: AppSession) {
    return this.organizationService.getOrganizationDetails(
      session.user.organizationId ?? '',
    );
  }

  @Post()
  @Roles([USER_ROLES.ADMIN])
  createOrganization(@Body('name') name: string) {
    return this.organizationService.createOrganization(name);
  }

  @Put(':id')
  @Roles([USER_ROLES.ADMIN, USER_ROLES.ORG_ADMIN])
  editOrganization(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body('name') name: string,
  ) {
    return this.organizationService.editOrganization(id, name);
  }

  @Put('ban/:id')
  @Roles([USER_ROLES.ADMIN])
  banOrganization(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.organizationService.toggleOrganizationBan(id, true);
  }

  @Put('unban/:id')
  @Roles([USER_ROLES.ADMIN])
  unbanOrganization(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.organizationService.toggleOrganizationBan(id, false);
  }

  @Delete(':id')
  @Roles([USER_ROLES.ADMIN])
  deleteOrganization(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.organizationService.deleteOrganization(id);
  }
}
