import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import {
  ACCESS_TOKEN_AUDIENCE,
  ACCESS_TOKEN_ISSUER,
  getAccessTokenSecret,
} from '../auth-token.config';

interface JwtPayload {
  sub: string;
  userId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
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
      secretOrKey: getAccessTokenSecret(),
      issuer: ACCESS_TOKEN_ISSUER,
      audience: ACCESS_TOKEN_AUDIENCE,
    });
  }

  validate(payload: JwtPayload) {
    return {
      userId: payload.userId ?? payload.sub,
    };
  }
}
