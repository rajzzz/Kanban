import { IsEnum, IsNotEmpty } from 'class-validator';
import { WorkspaceRole } from '../../../generated/prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMemberRoleDto {
  @ApiProperty({
    description: 'The new workspace role for the member',
    enum: WorkspaceRole,
    example: WorkspaceRole.ADMIN,
  })
  @IsEnum(WorkspaceRole, { message: 'role must be a valid WorkspaceRole' })
  @IsNotEmpty({ message: 'role is required' })
  role: WorkspaceRole;
}
