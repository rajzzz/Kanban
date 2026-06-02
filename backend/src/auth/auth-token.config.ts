import { createHmac, timingSafeEqual } from 'crypto';

export const ACCESS_TOKEN_ISSUER =
  process.env.JWT_ISSUER?.trim() || 'kanban-backend';
export const ACCESS_TOKEN_AUDIENCE =
  process.env.JWT_AUDIENCE?.trim() || 'kanban-api';
export const REFRESH_TOKEN_ISSUER =
  process.env.JWT_REFRESH_ISSUER?.trim() || ACCESS_TOKEN_ISSUER;
export const REFRESH_TOKEN_AUDIENCE =
  process.env.JWT_REFRESH_AUDIENCE?.trim() || 'kanban-refresh';

export function getAccessTokenSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not defined');
  }
  return secret;
}

export function getRefreshTokenSecret(): string {
  return process.env.JWT_REFRESH_SECRET?.trim() || getAccessTokenSecret();
}

function getRefreshTokenHashSecret(): string {
  return (
    process.env.REFRESH_TOKEN_HASH_SECRET?.trim() || getRefreshTokenSecret()
  );
}

export function hashRefreshTokenValue(token: string): string {
  return createHmac('sha256', getRefreshTokenHashSecret())
    .update(token)
    .digest('hex');
}

export function matchesRefreshTokenHash(
  token: string,
  expectedHash: string,
): boolean {
  const tokenHash = Buffer.from(hashRefreshTokenValue(token), 'hex');
  const storedHash = Buffer.from(expectedHash, 'hex');

  if (tokenHash.length !== storedHash.length) {
    return false;
  }

  return timingSafeEqual(tokenHash, storedHash);
}
