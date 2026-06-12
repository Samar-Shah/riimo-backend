import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Query,
  Put,
  ParseUUIDPipe,
  Delete,
  Req,
  Headers,
} from '@nestjs/common';
import {
  AllowAnonymous,
  Roles,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import { UserService } from './user.service';
import { USER_ROLES } from '../constants';
import { GetUsersByRoleQueryDto } from './dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('invite-admin')
  @Roles([USER_ROLES.ADMIN])
  async inviteAdmin(@Body('name') name: string, @Body('email') email: string) {
    return this.userService.inviteUser(name, email, USER_ROLES.ADMIN);
  }

  @Post('invite-org-admin')
  @Roles([USER_ROLES.ADMIN])
  async inviteOrgAdmin(
    @Body('name') name: string,
    @Body('email') email: string,
    @Body('organizationId', new ParseUUIDPipe({ version: '4' }))
    organizationId: string,
  ) {
    return this.userService.inviteUser(
      name,
      email,
      USER_ROLES.ORG_ADMIN,
      organizationId,
    );
  }

  @Post('invite-sales-rep')
  @Roles([USER_ROLES.ORG_ADMIN])
  async inviteSalesRep(
    @Body('name') name: string,
    @Body('email') email: string,
    @Body('organizationId', new ParseUUIDPipe({ version: '4' }))
    organizationId: string,
  ) {
    return this.userService.inviteUser(
      name,
      email,
      USER_ROLES.SALES_REP,
      organizationId,
    );
  }

  @Post('resend-invite')
  @Roles([USER_ROLES.ADMIN, USER_ROLES.ORG_ADMIN])
  async resendInvite(@Body('email') email: string) {
    return this.userService.resendInvite(email);
  }

  @Post('forgot-password')
  @AllowAnonymous()
  async forgotPassword(@Body('email') email: string) {
    return this.userService.forgotPassword(email);
  }

  // Dummy route for Web App using Session (Cookie)
  @Get('web-profile')
  getWebProfile(@Session() session: UserSession) {
    return {
      message: 'This is a session-protected route',
      user: session.user,
    };
  }

  @Get('me')
  getProfile(@Session() session: UserSession) {
    return { user: session.user };
  }

  // Dummy route for Desktop App using Bearer Token
  @Get('desktop-profile')
  getDesktopProfile(@Session() session: UserSession) {
    return {
      message: 'This is a bearer-token-protected route',
      user: session.user,
    };
  }

  // Dummy route for RBAC
  @Get('admin-dashboard')
  @Roles([USER_ROLES.ADMIN, USER_ROLES.ORG_ADMIN])
  getAdminDashboard(@Session() session: UserSession) {
    return {
      message: 'Welcome to the admin dashboard',
      user: session.user,
    };
  }

  @Get('admins')
  @Roles([USER_ROLES.ADMIN])
  getAdminUsers(@Query() queryDto: GetUsersByRoleQueryDto) {
    return this.userService.getUsersByRole(queryDto, USER_ROLES.ADMIN);
  }

  @Get('org-admins/:organizationId')
  @Roles([USER_ROLES.ADMIN])
  getOrgAdminUsers(
    @Param('organizationId', new ParseUUIDPipe({ version: '4' }))
    organizationId: string,
    @Query() queryDto: GetUsersByRoleQueryDto,
  ) {
    return this.userService.getUsersByRole(
      queryDto,
      USER_ROLES.ORG_ADMIN,
      organizationId,
    );
  }

  @Put('admins/:id')
  @Roles([USER_ROLES.ADMIN])
  editAdminUser(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body('name') name: string,
  ) {
    return this.userService.editUser(id, name, USER_ROLES.ADMIN);
  }

  @Put('org-admins/:id')
  @Roles([USER_ROLES.ADMIN])
  editOrgAdminUser(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body('name') name: string,
  ) {
    return this.userService.editUser(id, name, USER_ROLES.ORG_ADMIN);
  }

  @Delete('admins/:id')
  @Roles([USER_ROLES.ADMIN])
  deleteAdminUser(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Headers() headers: Headers,
  ) {
    return this.userService.deleteUser(id, headers, USER_ROLES.ADMIN);
  }

  @Delete('org-admins/:id')
  @Roles([USER_ROLES.ADMIN])
  deleteOrgAdminUser(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Headers() headers: Headers,
  ) {
    return this.userService.deleteUser(id, headers, USER_ROLES.ORG_ADMIN);
  }

  @Put('admins/ban/:id')
  @Roles([USER_ROLES.ADMIN])
  banAdminUser(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request,
    @Body('banReason') banReason?: string,
    @Body('banExpires') banExpires?: number,
  ) {
    return this.userService.toggleUserBan({
      id,
      action: 'ban',
      userRole: USER_ROLES.ADMIN,
      banReason,
      banExpires,
      headers: req.headers,
    });
  }

  @Put('admins/unban/:id')
  @Roles([USER_ROLES.ADMIN])
  unbanAdminUser(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Headers() headers: Headers,
  ) {
    return this.userService.toggleUserBan({
      id,
      userRole: USER_ROLES.ADMIN,
      action: 'unban',
      headers,
    });
  }

  @Put('org-admins/ban/:id')
  @Roles([USER_ROLES.ADMIN])
  banOrgAdminUser(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: Request,
    @Body('banReason') banReason?: string,
    @Body('banExpires') banExpires?: number,
  ) {
    return this.userService.toggleUserBan({
      id,
      action: 'ban',
      userRole: USER_ROLES.ORG_ADMIN,
      banReason,
      banExpires,
      headers: req.headers,
    });
  }

  @Put('org-admins/unban/:id')
  @Roles([USER_ROLES.ADMIN])
  unbanOrgAdminUser(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Headers() headers: Headers,
  ) {
    return this.userService.toggleUserBan({
      id,
      userRole: USER_ROLES.ORG_ADMIN,
      action: 'unban',
      headers,
    });
  }

  @Put('me')
  editProfile(@Session() session: UserSession, @Body('name') name: string) {
    return this.userService.editProfile(session, name);
  }
}
