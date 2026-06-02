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
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';

@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

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
   */
  @Patch(':orgId/workspaces/:workspaceId')
  async updateWorkspace(
    @CurrentUser() user: CurrentUserPayload,
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.organizationService.updateWorkspace(
      user.userId,
      orgId,
      workspaceId,
      dto,
    );
  }

  /**
   * DELETE /organizations/:orgId/workspaces/:workspaceId
   * Delete a workspace — org OWNER only.
   */
  @Delete(':orgId/workspaces/:workspaceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWorkspace(
    @CurrentUser() user: CurrentUserPayload,
    @Param('orgId') orgId: string,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.organizationService.deleteWorkspace(
      user.userId,
      orgId,
      workspaceId,
    );
  }
}
