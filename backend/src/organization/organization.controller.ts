import { Controller, Get } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';

@Controller('organizations')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  async findAll(@CurrentUser() user: CurrentUserPayload) {
    return this.organizationService.findAllForUser(user.userId);
  }
}
