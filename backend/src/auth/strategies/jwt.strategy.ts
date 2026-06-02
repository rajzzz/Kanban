import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

interface JwtPayload {
  sub: string;
  userId: string;
  workspaceId: string | null;
  role: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is not defined');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          const cookieHeader = request.headers.cookie;
          if (cookieHeader) {
            const cookies = Object.fromEntries(
              cookieHeader.split(';').map((c) => {
                const idx = c.indexOf('=');
                if (idx === -1) return [c.trim(), ''];
                return [c.slice(0, idx).trim(), c.slice(idx + 1).trim()];
              }),
            );
            return cookies['access_token'] || null;
          }
          return null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload) {
    return {
      userId: payload.userId ?? payload.sub,
      workspaceId: payload.workspaceId,
      role: payload.role,
    };
  }
}
