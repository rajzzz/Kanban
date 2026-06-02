import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString({ message: 'Workspace name must be a string' })
  @IsNotEmpty({ message: 'Workspace name is required' })
  name: string;

  @IsString()
  @IsOptional()
  organizationId?: string;
}
