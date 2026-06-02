import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({
    description: 'The name of the project',
    example: 'Q3 Product Launch',
  })
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name is required' })
  @MaxLength(255, { message: 'name must be at most 255 characters' })
  name: string;

  @ApiPropertyOptional({
    description: 'Optional project description detail',
    example: 'Planning and execution for the upcoming Q3 release.',
  })
  @IsString({ message: 'description must be a string' })
  @IsOptional()
  description?: string;
}
