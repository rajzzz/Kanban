import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { WorkspaceRole } from '../../../generated/prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InviteUserDto {
  @ApiProperty({
    description: 'The workspace UUID',
    example: '7eabb514-fdf1-4750-9d0a-3389a78fdc0d',
  })
  @IsUUID('4', { message: 'workspaceId must be a valid UUID v4' })
  @IsNotEmpty({ message: 'workspaceId is required' })
  workspaceId: string;

  @ApiProperty({
    description: 'The email address of the invitee',
    example: 'user@company.com',
  })
  @IsEmail({}, { message: 'email must be a valid email address' })
  @IsNotEmpty({ message: 'email is required' })
  email: string;

  @ApiPropertyOptional({
    description: 'The role assigned to the invitee in the workspace',
    enum: WorkspaceRole,
    default: WorkspaceRole.MEMBER,
  })
  @IsEnum(WorkspaceRole, { message: 'role must be a valid WorkspaceRole' })
  @IsOptional()
  role?: WorkspaceRole = WorkspaceRole.MEMBER;
}
