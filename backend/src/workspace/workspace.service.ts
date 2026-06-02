import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

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

      if (!orgMember || (orgMember.role !== 'OWNER' && orgMember.role !== 'ADMIN')) {
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
          organizationId: orgId!,
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
}
