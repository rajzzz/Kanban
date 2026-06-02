import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForUser(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: true,
      },
      orderBy: {
        organization: {
          name: 'asc',
        },
      },
    });

    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  /**
   * List all workspaces in the user's organization (from JWT orgId).
   * Supports optional name search (case-insensitive contains).
   */
  async listOrgWorkspaces(userId: string, orgId: string, search?: string) {
    // Verify user belongs to this org
    const orgMember = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: orgId, userId },
      },
    });

    if (!orgMember) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    return this.prisma.workspace.findMany({
      where: {
        organizationId: orgId,
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Update a workspace — org-level OWNER only.
   */
  async updateWorkspace(
    userId: string,
    orgId: string,
    workspaceId: string,
    dto: UpdateWorkspaceDto,
  ) {
    await this.assertOrgOwner(userId, orgId);

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace || workspace.organizationId !== orgId) {
      throw new NotFoundException('Workspace not found in this organization');
    }

    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      },
    });
  }

  /**
   * Delete a workspace — org-level OWNER only.
   */
  async deleteWorkspace(userId: string, orgId: string, workspaceId: string) {
    await this.assertOrgOwner(userId, orgId);

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace || workspace.organizationId !== orgId) {
      throw new NotFoundException('Workspace not found in this organization');
    }

    await this.prisma.workspace.delete({ where: { id: workspaceId } });
  }

  // ─────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────

  private async assertOrgOwner(userId: string, orgId: string) {
    const orgMember = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId: orgId, userId },
      },
    });

    if (!orgMember || orgMember.role !== 'OWNER') {
      throw new ForbiddenException(
        'Only the organization OWNER can perform this action',
      );
    }
  }
}
