import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserSession } from '@thallesp/nestjs-better-auth';
import { auth } from '../../auth';
import { DEFAULT_BANNED_MESSAGE } from '../../constants';

type AuthenticatedRequest = Request & {
  session: UserSession<typeof auth> | null;
};

@Injectable()
export class UserStatusGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>('PUBLIC', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request?.session?.user;

    if (user?.isDeleted) {
      throw new ForbiddenException('This account has been deleted');
    }

    if (user?.banned) {
      throw new ForbiddenException(DEFAULT_BANNED_MESSAGE);
    }

    return true;
  }
}
