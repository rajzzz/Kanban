import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { WorkspaceRoleGuard } from '../auth/guards/workspace-role.guard';
import { Roles, Role } from '../auth/decorators/roles.decorator';

import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Workspaces')
@ApiCookieAuth()
@Controller('workspaces')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  // ─────────────────────────────────────────────────────────
  // Workspace CRUD
  // ─────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateWorkspaceDto,
  ) {
    return this.workspaceService.create(user.userId, dto);
  }

  /** Returns all workspaces the authenticated user is a member of */
  @Get('me')
  async findMyWorkspaces(@CurrentUser() user: CurrentUserPayload) {
    return this.workspaceService.findMyWorkspaces(user.userId);
  }

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query('organizationId') organizationId: string,
  ) {
    if (!organizationId) {
      throw new BadRequestException(
        'organizationId query parameter is required',
      );
    }
    return this.workspaceService.findAllForUserInOrg(
      user.userId,
      organizationId,
    );
  }

  // ─────────────────────────────────────────────────────────
  // Invites
  // ─────────────────────────────────────────────────────────

  @Post('invite')
  @UseGuards(WorkspaceRoleGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async invite(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: InviteUserDto,
  ) {
    return this.workspaceService.inviteUser(user.userId, dto);
  }

  /**
   * Accept a workspace invite.
   * Requires authentication — the caller must be logged in.
   * The service verifies the authenticated user's email matches the invite's
   * target email, preventing a third party from consuming someone else's invite.
   */
  @Post('invite/accept')
  @HttpCode(HttpStatus.OK)
  async acceptInvite(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: AcceptInviteDto,
  ) {
    return this.workspaceService.acceptInvite(user.userId, dto);
  }

  // ─────────────────────────────────────────────────────────
  // Members
  // ─────────────────────────────────────────────────────────

  /** List all members of a workspace with user details (no N+1) */
  @Get(':workspaceId/members')
  @UseGuards(WorkspaceRoleGuard)
  async listMembers(@Param('workspaceId') workspaceId: string) {
    return this.workspaceService.listMembers(workspaceId);
  }

  /** Update a member's role — OWNER/ADMIN only; cannot demote the last OWNER */
  @Patch(':workspaceId/members/:userId/role')
  @UseGuards(WorkspaceRoleGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  async updateMemberRole(
    @Param('workspaceId') workspaceId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.workspaceService.updateMemberRole(
      workspaceId,
      targetUserId,
      dto,
    );
  }

  /** Remove a member — OWNER/ADMIN only; cannot remove self if last OWNER */
  @Delete(':workspaceId/members/:userId')
  @UseGuards(WorkspaceRoleGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @CurrentUser() user: CurrentUserPayload,
    @Param('workspaceId') workspaceId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.workspaceService.removeMember(
      workspaceId,
      user.userId,
      targetUserId,
    );
  }
}
