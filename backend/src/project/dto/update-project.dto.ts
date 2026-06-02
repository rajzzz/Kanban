import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProjectDto {
  @ApiPropertyOptional({
    description: 'The updated name of the project',
    example: 'Q4 Product Launch',
  })
  @IsString({ message: 'name must be a string' })
  @IsOptional()
  @MaxLength(255, { message: 'name must be at most 255 characters' })
  name?: string;

  @ApiPropertyOptional({
    description: 'The updated description of the project',
    example: 'Planning and execution for the upcoming Q4 release.',
  })
  @IsString({ message: 'description must be a string' })
  @IsOptional()
  description?: string;
}
