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
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: Selectable<User> }>();

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Bearer token');
    }

    // Pass headers to Better Auth. The bearer() plugin will parse the Authorization header natively
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
      throw new UnauthorizedException('Invalid or expired Bearer token');
    }

    request.user = session.user as unknown as Selectable<User>;
    return true;
  }
}
