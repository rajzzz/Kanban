import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { WorkspaceRoleGuard } from '../auth/guards/workspace-role.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';

/**
 * Two route groups:
 *
 * 1. /workspaces/:workspaceId/projects/:projectId/tasks
 *    — creation and listing, nested under workspace + project
 *
 * 2. /tasks/:taskId/assign  and  /tasks/:taskId/status
 *    — operate on an existing task; workspace is resolved from the task itself
 *      via resolveTaskInWorkspace() in the service (prevents cross-workspace access).
 *
 * NOTE ON SPEC DEVIATION:
 *   The original spec listed "POST /tasks/:taskId/assign" as the task-creation route.
 *   This is a malformed URL — a taskId cannot exist before the task is created.
 *   We implement creation at POST /workspaces/:workspaceId/projects/:projectId/tasks
 *   (the standard RESTful pattern) and use PATCH /tasks/:taskId/assign for assignment,
 *   which matches the spec's intent. See README § "Route Decisions" for full rationale.
 */

// ─────────────────────────────────────────────────────────
// Nested task routes: creation + listing
// ─────────────────────────────────────────────────────────
@ApiTags('Tasks')
@ApiCookieAuth()
@Controller('workspaces/:workspaceId/projects/:projectId/tasks')
@UseGuards(WorkspaceRoleGuard)
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  /**
   * POST /workspaces/:workspaceId/projects/:projectId/tasks
   * Any workspace member can create a task.
   * workspaceId + projectId always from route — never body.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateTaskDto,
  ) {
    return this.taskService.create(workspaceId, projectId, user.userId, dto);
  }

  /**
   * GET /workspaces/:workspaceId/projects/:projectId/tasks
   * Supports ?status=, ?priority=, ?assigneeId= — all optional.
   * Single query with assignee select — no N+1.
   */
  @Get()
  findAll(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Query() query: ListTasksQueryDto,
  ) {
    return this.taskService.findAll(workspaceId, projectId, query);
  }
}

// ─────────────────────────────────────────────────────────
// Flat task routes: assign + status transition
// These don't have workspaceId in the URL; the service resolves
// workspace scope from task → project → workspace internally.
// ─────────────────────────────────────────────────────────
@ApiTags('Tasks')
@ApiCookieAuth()
@Controller('tasks')
export class TaskActionController {
  constructor(private readonly taskService: TaskService) {}

  /**
   * PATCH /tasks/:taskId/assign
   * Assigns (or reassigns) a task to a workspace member.
   * Service validates that the assignee belongs to the task's workspace.
   */
  @Patch(':taskId/assign')
  assign(
    @CurrentUser() user: CurrentUserPayload,
    @Param('taskId') taskId: string,
    @Body() dto: AssignTaskDto,
  ) {
    // workspaceId comes from the JWT user context — the workspace the caller is scoped to.
    // resolveTaskInWorkspace then checks the task actually lives in that workspace.
    return this.taskService.assign(user.workspaceId ?? '', taskId, dto);
  }

  /**
   * PATCH /tasks/:taskId/status
   * Enforced state machine: TODO → IN_PROGRESS → IN_REVIEW → DONE.
   * Backward or skipped transitions → 400.
   */
  @Patch(':taskId/status')
  updateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.taskService.updateStatus(user.workspaceId ?? '', taskId, dto);
  }
}
