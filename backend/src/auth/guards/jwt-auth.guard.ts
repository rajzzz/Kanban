import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

interface JwtPayload {
  sub: string;
  userId: string;
  workspaceId: string | null;
  role: string | null;
}

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    workspaceId: string | null;
    role: string | null;
  };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractTokenFromRequest(request);

    if (!token) {
      throw new UnauthorizedException('Authentication token is missing');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
      // Attach the payload to request.user
      request.user = {
        userId: payload.userId ?? payload.sub,
        workspaceId: payload.workspaceId,
        role: payload.role,
      };
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired authentication token',
      );
    }

    return true;
  }

  private extractTokenFromRequest(
    request: AuthenticatedRequest,
  ): string | null {
    // 1. Try extracting from cookies (e.g., access_token)
    const cookieHeader = request.headers.cookie;
    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split(';').map((c) => {
          const idx = c.indexOf('=');
          return [c.slice(0, idx).trim(), c.slice(idx + 1).trim()] as [
            string,
            string,
          ];
        }),
      );

      if (cookies['access_token']) {
        return cookies['access_token'];
      }
    }

    // 2. Fallback to Authorization header (Bearer token)
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }
}
