import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Req,
  Res,
  All,
} from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth';
import { AuthService } from './auth.service';
import { Selectable } from 'kysely';
import type { Role, User } from '../database/types';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './guards/roles.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('invite')
  async inviteUser(
    @Body('name') name: string,
    @Body('email') email: string,
    @Body('role') role: Role,
  ) {
    return this.authService.inviteUser(name, email, role);
  }

  @Post('setup-password')
  async setupPassword(
    @Body('token') token: string,
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    return this.authService.setupPassword(token, email, password);
  }

  @Post('resend-invite')
  async resendInvite(@Body('email') email: string) {
    return this.authService.resendInvite(email);
  }

  // Dummy route for Web App using Session (Cookie)
  @Get('web-profile')
  @UseGuards(SessionAuthGuard)
  getWebProfile(@Req() req: Request & { user: Selectable<User> }) {
    return {
      message: 'This is a session-protected route',
      user: req.user,
    };
  }

  // Dummy route for Desktop App using Bearer Token
  @Get('desktop-profile')
  @UseGuards(JwtAuthGuard)
  getDesktopProfile(@Req() req: Request & { user: Selectable<User> }) {
    return {
      message: 'This is a bearer-token-protected route',
      user: req.user,
    };
  }

  // Dummy route for RBAC
  @Get('admin-dashboard')
  @UseGuards(SessionAuthGuard, RolesGuard) // Checks session cookie, then checks role
  @Roles('admin', 'org-admin')
  getAdminDashboard(@Req() req: Request & { user: Selectable<User> }) {
    return {
      message: 'Welcome to the admin dashboard',
      user: req.user,
    };
  }

  // Catch-all route to expose Better Auth's native endpoints (e.g., sign-in, session, etc.)
  @All('*path')
  catchAll(@Req() req: any, @Res() res: any) {
    return toNodeHandler(auth)(req, res);
  }
}
