import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { WorkspaceRoleGuard } from '../auth/guards/workspace-role.guard';
import { Roles, Role } from '../auth/decorators/roles.decorator';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';

/**
 * All routes are nested under /workspaces/:workspaceId/projects.
 * WorkspaceRoleGuard is applied at the controller level so every route
 * automatically verifies workspace membership and attaches req.workspace.
 * Role restrictions are added per-route where needed.
 */
@ApiTags('Projects')
@ApiCookieAuth()
@Controller('workspaces/:workspaceId/projects')
@UseGuards(WorkspaceRoleGuard)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  /**
   * POST /workspaces/:workspaceId/projects
   * Any workspace member can create a project.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectService.create(workspaceId, dto);
  }

  /**
   * GET /workspaces/:workspaceId/projects
   * Any workspace member can list projects.
   * Response includes taskCount (_count.tasks) per project.
   */
  @Get()
  findAll(@Param('workspaceId') workspaceId: string) {
    return this.projectService.findAll(workspaceId);
  }

  /**
   * PATCH /workspaces/:workspaceId/projects/:projectId
   * Any workspace member can update name/description.
   */
  @Patch(':projectId')
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectService.update(workspaceId, projectId, dto);
  }

  /**
   * DELETE /workspaces/:workspaceId/projects/:projectId
   * OWNER or ADMIN only.
   */
  @Delete(':projectId')
  @Roles(Role.OWNER, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.projectService.remove(workspaceId, projectId);
  }
}
