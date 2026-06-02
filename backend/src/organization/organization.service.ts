import {
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

}
