import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { TaskStatus } from '../../generated/prisma/client';

/**
 * Enforced one-way state machine: TODO → IN_PROGRESS → IN_REVIEW → DONE.
 * Backward transitions are rejected with a 400.
 * DONE is a terminal state — no further transitions.
 */
const VALID_NEXT_STATUS: Partial<Record<TaskStatus, TaskStatus>> = {
  [TaskStatus.TODO]: TaskStatus.IN_PROGRESS,
  [TaskStatus.IN_PROGRESS]: TaskStatus.IN_REVIEW,
  [TaskStatus.IN_REVIEW]: TaskStatus.DONE,
};

/** Assignee fields returned on task responses — no passwordHash leakage */
const ASSIGNEE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

@Injectable()
export class TaskService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────
  // Create
  // ─────────────────────────────────────────────────────────

  /**
   * POST /workspaces/:workspaceId/projects/:projectId/tasks
   *
   * workspaceId + projectId come from route params.
   * Verifies the project belongs to this workspace before writing.
   * Any workspace member may create tasks.
   */
  async create(
    workspaceId: string,
    projectId: string,
    creatorId: string,
    dto: CreateTaskDto,
  ) {
    await this.assertProjectInWorkspace(workspaceId, projectId);

    return this.prisma.task.create({
      data: {
        title: dto.title.trim(),
        description: dto.description,
        status: dto.status ?? TaskStatus.TODO,
        priority: dto.priority,
        tags: dto.tags ?? [],
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        projectId,
        creatorId,
        assigneeId: dto.assigneeId ?? null,
      },
      include: {
        assignee: { select: ASSIGNEE_SELECT },
        creator: { select: ASSIGNEE_SELECT },
      },
    });
  }

  // ─────────────────────────────────────────────────────────
  // List with filters
  // ─────────────────────────────────────────────────────────

  /**
   * GET /workspaces/:workspaceId/projects/:projectId/tasks
   *
   * Supports ?status=, ?priority=, ?assigneeId= query params.
   * Single Prisma query — includes assignee via select (no N+1).
   */
  async findAll(
    workspaceId: string,
    projectId: string,
    query: ListTasksQueryDto,
  ) {
    await this.assertProjectInWorkspace(workspaceId, projectId);

    return this.prisma.task.findMany({
      where: {
        projectId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
        ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
      },
      include: {
        assignee: { select: ASSIGNEE_SELECT },
        creator: { select: ASSIGNEE_SELECT },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ─────────────────────────────────────────────────────────
  // Assign
  // ─────────────────────────────────────────────────────────

  /**
   * PATCH /tasks/:taskId/assign
   *
   * Validates:
   *  1. Task exists and belongs to the caller's workspace.
   *  2. The assignee is an actual member of that same workspace.
   * Cross-workspace assignment would be a data integrity bug — rejected with 403.
   */
  async assign(workspaceId: string, taskId: string, dto: AssignTaskDto) {
    const task = await this.resolveTaskInWorkspace(workspaceId, taskId);

    // Verify assignee is a member of this workspace
    const isMember = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: dto.assigneeId,
        },
      },
    });

    if (!isMember) {
      throw new ForbiddenException(
        'Assignee is not a member of this workspace',
      );
    }

    return this.prisma.task.update({
      where: { id: task.id },
      data: { assigneeId: dto.assigneeId },
      include: { assignee: { select: ASSIGNEE_SELECT } },
    });
  }

  // ─────────────────────────────────────────────────────────
  // Status transition (state machine)
  // ─────────────────────────────────────────────────────────

  /**
   * PATCH /tasks/:taskId/status
   *
   * Enforces: TODO → IN_PROGRESS → IN_REVIEW → DONE
   * Backward transitions and skipping states both rejected with 400.
   * DONE is terminal — no further transitions allowed.
   */
  async updateStatus(
    workspaceId: string,
    taskId: string,
    dto: UpdateTaskStatusDto,
  ) {
    const task = await this.resolveTaskInWorkspace(workspaceId, taskId);

    const allowedNext = VALID_NEXT_STATUS[task.status];

    if (!allowedNext) {
      throw new BadRequestException(
        `Task is in terminal state ${task.status} and cannot be transitioned further`,
      );
    }

    if (dto.status !== allowedNext) {
      throw new BadRequestException(
        `Invalid transition: ${task.status} → ${dto.status}. ` +
          `Only ${task.status} → ${allowedNext} is allowed`,
      );
    }

    return this.prisma.task.update({
      where: { id: task.id },
      data: { status: dto.status },
      include: { assignee: { select: ASSIGNEE_SELECT } },
    });
  }

  // ─────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────

  /**
   * Confirms the project exists and belongs to this workspace.
   * Throws NotFoundException / ForbiddenException accordingly.
   */
  private async assertProjectInWorkspace(
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

  /**
   * Resolves a task and validates it falls within the caller's workspace scope
   * by walking task → project → workspace.
   * Returns the full task on success, throws 404 otherwise (no workspace leakage).
   */
  private async resolveTaskInWorkspace(workspaceId: string, taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });

    // 404 for both "not found" and "wrong workspace" — avoids enumeration
    if (!task || task.project.workspaceId !== workspaceId) {
      throw new NotFoundException(`Task ${taskId} not found in this workspace`);
    }

    return task;
  }
}
