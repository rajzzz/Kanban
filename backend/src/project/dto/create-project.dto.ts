import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name is required' })
  @MaxLength(255, { message: 'name must be at most 255 characters' })
  name: string;

  @IsString({ message: 'description must be a string' })
  @IsOptional()
  description?: string;
}
