import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Selectable } from 'kysely';
import { User } from '../../database/types';
import { auth } from '../auth';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: Selectable<User> }>();

    // Ensure this is treated as a session request (cookie-based)
    if (!request.headers.get('cookie')) {
      throw new UnauthorizedException('No session cookie found');
    }

    const headers = new Headers();
    Object.entries(request.headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        headers.append(key, value);
      } else if (Array.isArray(value)) {
        value.forEach((v: string) => headers.append(key, v));
      }
    });

    const session = await auth.api.getSession({
      headers,
    });

    if (!session || !session.user) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // Attach the user to the request for subsequent guards (like RolesGuard)
    request.user = session.user as unknown as Selectable<User>;
    return true;
  }
}
