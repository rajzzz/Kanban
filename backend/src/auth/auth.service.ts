import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import {
  ACCESS_TOKEN_AUDIENCE,
  ACCESS_TOKEN_ISSUER,
  REFRESH_TOKEN_AUDIENCE,
  REFRESH_TOKEN_ISSUER,
  getAccessTokenSecret,
  getRefreshTokenSecret,
  hashRefreshTokenValue,
  matchesRefreshTokenHash,
} from './auth-token.config';

interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException(
        'A user with this email address already exists',
      );
    }

    // Hash the password with bcrypt (10 rounds)
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Set default organization name if not provided
    const organizationName =
      dto.organizationName?.trim() || `${dto.firstName || 'My'} Organization`;

    const { user } = await this.prisma.$transaction(async (tx) => {
      // 1. Create Organization
      const organization = await tx.organization.create({
        data: {
          name: organizationName,
        },
      });

      // 2. Create User
      const createdUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          firstName: dto.firstName?.trim() || null,
          lastName: dto.lastName?.trim() || null,
        },
      });

      // 3. Link user to organization as OWNER
      await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: createdUser.id,
          role: 'OWNER',
        },
      });

      return { user: createdUser };
    });

    // Omit passwordHash from the response payload
    const { passwordHash: _pw, ...safeUser } = user;
    void _pw;
    return safeUser;
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();

    // 1. Retrieve user by email (including their workspace memberships)
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          orderBy: {
            joinedAt: 'asc', // grab the earliest joined membership as default
          },
        },
      },
    });

    // 2. Validate user existence and password
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 3. Determine workspaceId and role for the payload
    // Get their primary workspace ID and role
    const primaryMembership = user.memberships[0];
    const workspaceId = primaryMembership
      ? primaryMembership.workspaceId
      : null;
    const role = primaryMembership ? primaryMembership.role : null;

    // 4. Generate Access Token JWT (15-min expiry)
    // Payload: userId, workspaceId, role
    const accessTokenPayload = {
      sub: user.id,
      userId: user.id,
      workspaceId,
      role,
    };
    const accessToken = await this.jwtService.signAsync(accessTokenPayload, {
      secret: getAccessTokenSecret(),
      expiresIn: '15m',
      issuer: ACCESS_TOKEN_ISSUER,
      audience: ACCESS_TOKEN_AUDIENCE,
    });

    // 5. Generate Refresh Token in database first
    const refreshTokenId = randomUUID();
    const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Generate signed JWT for the refresh token
    const refreshTokenValue = await this.jwtService.signAsync(
      { sub: user.id, jti: refreshTokenId },
      {
        secret: getRefreshTokenSecret(),
        expiresIn: '7d',
        issuer: REFRESH_TOKEN_ISSUER,
        audience: REFRESH_TOKEN_AUDIENCE,
      },
    );

    const refreshTokenHash = hashRefreshTokenValue(refreshTokenValue);

    // 6. Save the Refresh Token in the database
    await this.prisma.refreshToken.create({
      data: {
        id: refreshTokenId,
        tokenHash: refreshTokenHash,
        expiresAt: refreshTokenExpiry,
        userId: user.id,
      },
    });

    // Return tokens and expiries
    return {
      accessToken,
      refreshToken: refreshTokenValue,
      expiresAt: refreshTokenExpiry,
    };
  }

  async refresh(refreshTokenJwt: string) {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshTokenJwt,
        {
          secret: getRefreshTokenSecret(),
          issuer: REFRESH_TOKEN_ISSUER,
          audience: REFRESH_TOKEN_AUDIENCE,
        },
      );
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const tokenId = payload.jti;
    const { sub: userId } = payload;
    if (!tokenId || !userId) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Retrieve the token from database
    const record = await this.prisma.refreshToken.findUnique({
      where: { id: tokenId },
      include: {
        user: {
          include: {
            memberships: {
              orderBy: { joinedAt: 'asc' },
            },
          },
        },
      },
    });

    if (!record || record.revoked || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const isHashValid = matchesRefreshTokenHash(
      refreshTokenJwt,
      record.tokenHash,
    );
    if (!isHashValid) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate token - delete old token and create new pair
    const newRefreshTokenId = randomUUID();
    const newRefreshTokenExpiry = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ); // 7 days

    const primaryMembership = record.user.memberships[0];
    const workspaceId = primaryMembership
      ? primaryMembership.workspaceId
      : null;
    const role = primaryMembership ? primaryMembership.role : null;

    // Sign new Access Token
    const accessTokenPayload = {
      sub: record.userId,
      userId: record.userId,
      workspaceId,
      role,
    };
    const accessToken = await this.jwtService.signAsync(accessTokenPayload, {
      secret: getAccessTokenSecret(),
      expiresIn: '15m',
      issuer: ACCESS_TOKEN_ISSUER,
      audience: ACCESS_TOKEN_AUDIENCE,
    });

    // Sign new Refresh Token JWT
    const newRefreshTokenValue = await this.jwtService.signAsync(
      { sub: record.userId, jti: newRefreshTokenId },
      {
        secret: getRefreshTokenSecret(),
        expiresIn: '7d',
        issuer: REFRESH_TOKEN_ISSUER,
        audience: REFRESH_TOKEN_AUDIENCE,
      },
    );

    const hashedNewRefreshToken = hashRefreshTokenValue(newRefreshTokenValue);

    await this.prisma.$transaction(async (tx) => {
      // Delete old token
      await tx.refreshToken.delete({
        where: { id: tokenId },
      });

      // Insert new token
      await tx.refreshToken.create({
        data: {
          id: newRefreshTokenId,
          tokenHash: hashedNewRefreshToken,
          expiresAt: newRefreshTokenExpiry,
          userId: record.userId,
        },
      });
    });

    return {
      accessToken,
      refreshToken: newRefreshTokenValue,
    };
  }

  async logout(refreshTokenJwt: string) {
    try {
      const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(
        refreshTokenJwt,
        {
          secret: getRefreshTokenSecret(),
          issuer: REFRESH_TOKEN_ISSUER,
          audience: REFRESH_TOKEN_AUDIENCE,
        },
      );
      const tokenId = payload.jti;
      if (tokenId) {
        await this.prisma.refreshToken.deleteMany({
          where: { id: tokenId },
        });
      }
    } catch {
      // Ignore token verification errors or missing records during logout
    }
  }
}
