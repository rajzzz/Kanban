import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID, createHmac } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { getAccessTokenSecret } from '../auth/auth-token.config';
import { WorkspaceRole } from '../../generated/prisma/client';

interface InviteTokenPayload {
  workspaceId: string;
  inviteeEmail: string;
}

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // ─────────────────────────────────────────────────────────
  // Workspace CRUD
  // ─────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────
  // Invites
  // ─────────────────────────────────────────────────────────

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
    const publicInvite = {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
      workspaceId: invite.workspaceId,
      invitedById: invite.invitedById,
    };
    return {
      token: inviteToken,
      invite: publicInvite,
    };
  }

  async acceptInvite(userId: string, dto: AcceptInviteDto) {
    const { token } = dto;

    // 1. Validate token structure: <prefix>.<jwt>
    const dotIndex = token.indexOf('.');
    if (dotIndex === -1) {
      throw new BadRequestException('Invalid invite token format');
    }
    const tokenPrefix = token.slice(0, dotIndex);

    // 2. Verify JWT signature + expiry
    let payload: InviteTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<InviteTokenPayload>(
        token.slice(dotIndex + 1),
        { secret: getAccessTokenSecret() },
      );
    } catch {
      throw new BadRequestException('Invite token is invalid or has expired');
    }

    // 3. Recompute HMAC hash and look up the invite record by prefix + hash
    const tokenHash = createHmac('sha256', getAccessTokenSecret())
      .update(token)
      .digest('hex');

    const invite = await this.prisma.workspaceInvite.findFirst({
      where: { tokenPrefix, tokenHash },
      include: { workspace: true },
    });

    if (!invite) {
      throw new BadRequestException('Invite token not found');
    }

    if (invite.status !== 'PENDING') {
      throw new ConflictException(
        'Invite has already been accepted or revoked',
      );
    }

    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('Invite token has expired');
    }

    // 4. Resolve the userId whose email matches, or use the authenticated user
    const inviteeUser = await this.prisma.user.findUnique({
      where: { email: payload.inviteeEmail },
    });

    const memberId = inviteeUser?.id ?? userId;

    // 5. Atomic transaction: create membership + mark invite ACCEPTED
    return this.prisma.$transaction(async (tx) => {
      // Check if already a member to avoid unique constraint error
      const existing = await tx.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: invite.workspaceId,
            userId: memberId,
          },
        },
      });

      if (existing) {
        throw new ConflictException(
          'You are already a member of this workspace',
        );
      }

      // Check if they are already in the organization, if not, add them as MEMBER
      const orgId = invite.workspace.organizationId;
      const existingOrgMember = await tx.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: orgId,
            userId: memberId,
          },
        },
      });

      if (!existingOrgMember) {
        await tx.organizationMember.create({
          data: {
            organizationId: orgId,
            userId: memberId,
            role: 'MEMBER',
          },
        });
      }

      const member = await tx.workspaceMember.create({
        data: {
          workspaceId: invite.workspaceId,
          userId: memberId,
          role: invite.role,
        },
      });

      const updatedInvite = await tx.workspaceInvite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED' },
      });

      return { member, invite: updatedInvite };
    });
  }

  // ─────────────────────────────────────────────────────────
  // Members
  // ─────────────────────────────────────────────────────────

  async listMembers(workspaceId: string) {
    // Single query with user details — no N+1
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async updateMemberRole(
    workspaceId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDto,
  ) {
    // Guard: cannot demote the last OWNER
    if (dto.role !== WorkspaceRole.OWNER) {
      const ownerCount = await this.prisma.workspaceMember.count({
        where: { workspaceId, role: WorkspaceRole.OWNER },
      });

      const targetIsOwner = await this.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId, userId: targetUserId },
        },
      });

      if (ownerCount === 1 && targetIsOwner?.role === WorkspaceRole.OWNER) {
        throw new ForbiddenException(
          'Cannot demote the last OWNER of a workspace',
        );
      }
    }

    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this workspace');
    }

    return this.prisma.workspaceMember.update({
      where: {
        workspaceId_userId: { workspaceId, userId: targetUserId },
      },
      data: { role: dto.role },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  async removeMember(
    workspaceId: string,
    requestingUserId: string,
    targetUserId: string,
  ) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this workspace');
    }

    // Cannot remove self if you are the last OWNER
    if (requestingUserId === targetUserId) {
      const ownerCount = await this.prisma.workspaceMember.count({
        where: { workspaceId, role: WorkspaceRole.OWNER },
      });

      if (member.role === WorkspaceRole.OWNER && ownerCount === 1) {
        throw new ForbiddenException(
          'Cannot remove yourself as you are the last OWNER of this workspace',
        );
      }
    }

    return this.prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    });
  }
}
