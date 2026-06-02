import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromRequest(request);

    if (!token) {
      throw new UnauthorizedException('Authentication token is missing');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
      // Attach the payload to request.user
      request.user = {
        userId: payload.userId || payload.sub,
        workspaceId: payload.workspaceId,
        role: payload.role,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }

    return true;
  }

  private extractTokenFromRequest(request: any): string | null {
    // 1. Try extracting from cookies (e.g., access_token)
    if (request.headers.cookie) {
      const cookies = request.headers.cookie.split(';').reduce((acc, cookie) => {
        const [key, ...valueParts] = cookie.trim().split('=');
        if (key) {
          acc[key] = valueParts.join('=');
        }
        return acc;
      }, {} as Record<string, string>);

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
