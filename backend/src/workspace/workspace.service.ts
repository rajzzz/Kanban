import { Injectable, ForbiddenException } from '@nestjs/common';
import { randomUUID, createHmac } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { getAccessTokenSecret } from '../auth/auth-token.config';

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async create(userId: string, dto: CreateWorkspaceDto) {
    let orgId = dto.organizationId;

    if (!orgId) {
      // Find the user's first organization where they are OWNER or ADMIN
      const orgMember = await this.prisma.organizationMember.findFirst({
        where: {
          userId,
          role: { in: ['OWNER', 'ADMIN'] },
        },
      });

      if (!orgMember) {
        throw new ForbiddenException(
          'You must be an Owner or Admin of an organization to create a workspace',
        );
      }
      orgId = orgMember.organizationId;
    } else {
      // Verify user has permission for the specified organization
      const orgMember = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: orgId,
            userId,
          },
        },
      });

      if (
        !orgMember ||
        (orgMember.role !== 'OWNER' && orgMember.role !== 'ADMIN')
      ) {
        throw new ForbiddenException(
          'You must be an Owner or Admin of this organization to create a workspace',
        );
      }
    }

    // Create the workspace and add the user as OWNER in a transaction
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: dto.name.trim(),
          organizationId: orgId,
        },
      });

      const member = await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          role: 'OWNER', // The creator becomes the owner of this workspace
        },
      });

      return {
        workspace,
        member,
      };
    });
  }

  async findAllForUserInOrg(userId: string, organizationId: string) {
    // 1. Verify user belongs to organization
    const orgMember = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    if (!orgMember) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    // 2. Fetch workspaces inside this organization that the user is a member of.
    // If user's role is OWNER or ADMIN, they have full access to all workspaces in the org.
    // If they are a regular MEMBER, they only see workspaces they are explicitly joined to.
    if (orgMember.role === 'OWNER' || orgMember.role === 'ADMIN') {
      return this.prisma.workspace.findMany({
        where: { organizationId },
        orderBy: { name: 'asc' },
      });
    } else {
      return this.prisma.workspace.findMany({
        where: {
          organizationId,
          members: {
            some: {
              userId,
            },
          },
        },
        orderBy: { name: 'asc' },
      });
    }
  }

  async findMyWorkspaces(userId: string) {
    return this.prisma.workspace.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
      include: {
        members: {
          where: {
            userId,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async inviteUser(userId: string, dto: InviteUserDto) {
    const { workspaceId, email, role } = dto;

    // 1. Generate a random prefix for the invite token
    const tokenPrefix = randomUUID().replace(/-/g, '').slice(0, 10);

    // 2. Sign a JWT payload containing workspaceId and inviteeEmail, expiring in 24 hours
    const invitePayload = {
      workspaceId,
      inviteeEmail: email,
    };
    const signedJwt = await this.jwtService.signAsync(invitePayload, {
      secret: getAccessTokenSecret(),
      expiresIn: '24h',
    });

    const inviteToken = `${tokenPrefix}.${signedJwt}`;

    // 3. Hash the invite token using HMAC-SHA256 (reusing getAccessTokenSecret for key)
    const tokenHash = createHmac('sha256', getAccessTokenSecret())
      .update(inviteToken)
      .digest('hex');

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // 4. Save invite record in database
    const invite = await this.prisma.workspaceInvite.create({
      data: {
        email,
        role: role ?? 'MEMBER',
        tokenHash,
        tokenPrefix,
        expiresAt,
        status: 'PENDING',
        workspaceId,
        invitedById: userId,
      },
    });

    // In production, we'd email the token. For this task, return it in the response.
    return {
      token: inviteToken,
      invite,
    };
  }
}
