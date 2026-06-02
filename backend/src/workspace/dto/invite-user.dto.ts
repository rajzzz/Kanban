import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { WorkspaceRole } from '../../../generated/prisma/client';

export class InviteUserDto {
  @IsUUID('4', { message: 'workspaceId must be a valid UUID v4' })
  @IsNotEmpty({ message: 'workspaceId is required' })
  workspaceId: string;

  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsNotEmpty({ message: 'email is required' })
  email: string;

  @IsEnum(WorkspaceRole, { message: 'role must be a valid WorkspaceRole' })
  @IsOptional()
  role?: WorkspaceRole = WorkspaceRole.MEMBER;
}
