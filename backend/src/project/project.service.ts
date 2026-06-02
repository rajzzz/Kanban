import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a project inside a workspace.
   * workspaceId comes from the route param — never trusted from the body.
   * Any workspace member may create a project.
   */
  async create(workspaceId: string, dto: CreateProjectDto) {
    return this.prisma.project.create({
      data: {
        name: dto.name.trim(),
        description: dto.description,
        workspaceId,
      },
    });
  }

  /**
   * List all projects in a workspace.
   * Includes task count via Prisma _count to avoid N+1.
   */
  async findAll(workspaceId: string) {
    return this.prisma.project.findMany({
      where: { workspaceId },
      include: {
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Update a project's name/description.
   * Any workspace member may update — role enforcement is at the guard layer.
   * Service verifies the project belongs to this workspace.
   */
  async update(workspaceId: string, projectId: string, dto: UpdateProjectDto) {
    await this.assertBelongsToWorkspace(workspaceId, projectId);

    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
      },
    });
  }

  /**
   * Delete a project — OWNER/ADMIN only (enforced at the guard layer).
   * Service verifies the project belongs to this workspace.
   */
  async remove(workspaceId: string, projectId: string) {
    await this.assertBelongsToWorkspace(workspaceId, projectId);

    await this.prisma.project.delete({ where: { id: projectId } });
  }

  // ─────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────

  /**
   * Throws NotFoundException if the project does not exist,
   * ForbiddenException if it exists but belongs to a different workspace.
   * This prevents cross-workspace access even when a caller guesses a projectId.
   */
  private async assertBelongsToWorkspace(
    workspaceId: string,
    projectId: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    if (project.workspaceId !== workspaceId) {
      throw new ForbiddenException('Project does not belong to this workspace');
    }

    return project;
  }
}
