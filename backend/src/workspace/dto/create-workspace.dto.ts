import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWorkspaceDto {
  @ApiProperty({
    description: 'The name of the workspace',
    example: 'Product Engineering',
  })
  @IsString({ message: 'Workspace name must be a string' })
  @IsNotEmpty({ message: 'Workspace name is required' })
  name: string;

  @ApiPropertyOptional({
    description: 'The target organization ID',
    example: 'org-uuid-123',
  })
  @IsString()
  @IsOptional()
  organizationId?: string;
}
