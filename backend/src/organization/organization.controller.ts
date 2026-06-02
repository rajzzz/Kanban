import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';

@ApiTags('Organizations')
@ApiCookieAuth()
@Controller('organizations')
export class OrganizationController {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  /** List all organizations the authenticated user belongs to */
  @Get()
  async findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.organizationService.findAllForUser(user.userId);
  }

  // ─────────────────────────────────────────────────────────
  // Org-scoped workspace endpoints
  // Route: /organizations/:orgId/workspaces[/:workspaceId]
  // ─────────────────────────────────────────────────────────

  /**
   * GET /organizations/:orgId/workspaces
   * Lists all workspaces in the org; optional ?search= for debounced filtering.
   * Requires org membership (service validates).
   */
  @Get(':orgId/workspaces')
  async listOrgWorkspaces(
    @CurrentUser() user: CurrentUserPayload,
    @Param('orgId') orgId: string,
    @Query('search') search?: string,
  ) {
    return this.organizationService.listOrgWorkspaces(
      user.userId,
      orgId,
      search,
    );
  }

  /**
   * PATCH /organizations/:orgId/workspaces/:workspaceId
   * Update workspace name — org OWNER only.
   * Delegates to WorkspaceService — the Workspace BC owns this aggregate.
   */
  @Patch(':orgId/workspaces/:workspaceId')
  async updateWorkspace(
    @CurrentUser() user: CurrentUserPayload,
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspaceService.updateWorkspace(
      user.userId,
      orgId,
      workspaceId,
      dto,
    );
  }

  /**
   * DELETE /organizations/:orgId/workspaces/:workspaceId
   * Delete a workspace — org OWNER only.
   * Delegates to WorkspaceService — the Workspace BC owns this aggregate.
   */
  @Delete(':orgId/workspaces/:workspaceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWorkspace(
    @CurrentUser() user: CurrentUserPayload,
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.workspaceService.removeWorkspace(
      user.userId,
      orgId,
      workspaceId,
    );
  }
}
