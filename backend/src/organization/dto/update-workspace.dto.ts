import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateWorkspaceDto {
  @IsString({ message: 'name must be a string' })
  @IsOptional()
  @MaxLength(255, { message: 'name must be at most 255 characters' })
  name?: string;
}
