import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) { }

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('A user with this email address already exists');
    }

    // Hash the password with bcrypt (10 rounds)
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Set default organization name if not provided
    const organizationName = dto.organizationName?.trim() || `${dto.firstName || 'My'} Organization`;

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
    const { passwordHash: _, ...safeUser } = user;
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

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 3. Determine workspaceId and role for the payload
    // Get their primary workspace ID and role
    const primaryMembership = user.memberships[0];
    const workspaceId = primaryMembership ? primaryMembership.workspaceId : null;
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
      expiresIn: '15m',
    });

    // 5. Generate a random UUID Refresh Token (7-day expiry)
    const refreshTokenValue = randomUUID();
    const refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Hash the Refresh Token with bcrypt (10 rounds)
    const refreshTokenHash = await bcrypt.hash(refreshTokenValue, 10);

    // 6. Save the Refresh Token in the database
    await this.prisma.refreshToken.create({
      data: {
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
}
