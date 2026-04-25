import { Controller, Post, Body, Get } from '@nestjs/common';
import {
  AllowAnonymous,
  Roles,
  Session,
  type UserSession,
} from '@thallesp/nestjs-better-auth';
import { UserService } from './user.service';
import type { Role } from '../database/types';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('invite')
  @Roles(['admin', 'org-admin'])
  async inviteUser(
    @Body('name') name: string,
    @Body('email') email: string,
    @Body('role') role: Role,
  ) {
    return this.userService.inviteUser(name, email, role);
  }

  @Post('setup-password')
  @AllowAnonymous()
  async setupPassword(
    @Body('token') token: string,
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    return this.userService.setupPassword(token, email, password);
  }

  @Post('resend-invite')
  @Roles(['admin', 'org-admin'])
  async resendInvite(@Body('email') email: string) {
    return this.userService.resendInvite(email);
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
  @Roles(['admin', 'org-admin'])
  getAdminDashboard(@Session() session: UserSession) {
    return {
      message: 'Welcome to the admin dashboard',
      user: session.user,
    };
  }
}
