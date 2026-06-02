import { Controller, Get, UseGuards } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@CurrentUser() user: any) {
    return this.organizationService.findAllForUser(user.userId);
  }
}
