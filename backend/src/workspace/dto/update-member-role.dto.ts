import { IsEnum, IsNotEmpty } from 'class-validator';
import { WorkspaceRole } from '../../../generated/prisma/client';

export class UpdateMemberRoleDto {
  @IsEnum(WorkspaceRole, { message: 'role must be a valid WorkspaceRole' })
  @IsNotEmpty({ message: 'role is required' })
  role: WorkspaceRole;
}
