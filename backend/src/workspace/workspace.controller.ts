import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { WorkspaceRoleGuard } from '../auth/guards/workspace-role.guard';
import { Roles, Role } from '../auth/decorators/roles.decorator';

@Controller('workspaces')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateWorkspaceDto,
  ) {
    return this.workspaceService.create(user.userId, dto);
  }

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
}
