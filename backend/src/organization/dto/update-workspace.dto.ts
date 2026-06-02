import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({
    description: 'The updated name of the workspace',
    example: 'Product Operations',
  })
  @IsString({ message: 'name must be a string' })
  @IsOptional()
  @MaxLength(255, { message: 'name must be at most 255 characters' })
  name?: string;
}
