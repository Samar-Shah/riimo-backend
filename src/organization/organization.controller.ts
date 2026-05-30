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
} from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { Roles } from '@thallesp/nestjs-better-auth';
import { USER_ROLES } from '../constants';
import { GetOrganizationsQueryDto } from './dto';

@Controller('organization')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  @Roles([USER_ROLES.ADMIN])
  getOrganizations(@Query() queryDto: GetOrganizationsQueryDto) {
    return this.organizationService.getOrganizations(queryDto);
  }

  @Post()
  @Roles([USER_ROLES.ADMIN])
  createOrganization(@Body('name') name: string) {
    return this.organizationService.createOrganization(name);
  }

  @Put(':id')
  @Roles([USER_ROLES.ADMIN])
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
