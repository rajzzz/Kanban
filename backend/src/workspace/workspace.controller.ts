import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';

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
