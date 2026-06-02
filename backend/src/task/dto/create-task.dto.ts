import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { TaskPriority, TaskStatus } from '../../../generated/prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTaskDto {
  @ApiProperty({
    description: 'The title of the task',
    example: 'Setup CI/CD Pipeline',
  })
  @IsString({ message: 'title must be a string' })
  @IsNotEmpty({ message: 'title is required' })
  title: string;

  @ApiPropertyOptional({
    description: 'A detailed description of the task',
    example: 'Setup Github Actions and connect to AWS ECS',
  })
  @IsString({ message: 'description must be a string' })
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'The current status of the task',
    enum: TaskStatus,
    default: TaskStatus.TODO,
  })
  @IsEnum(TaskStatus, { message: 'status must be a valid TaskStatus' })
  @IsOptional()
  status?: TaskStatus = TaskStatus.TODO;

  @ApiPropertyOptional({
    description: 'The priority level of the task',
    enum: TaskPriority,
    default: TaskPriority.MEDIUM,
  })
  @IsEnum(TaskPriority, { message: 'priority must be a valid TaskPriority' })
  @IsOptional()
  priority?: TaskPriority = TaskPriority.MEDIUM;

  @ApiPropertyOptional({
    description: 'A list of tag labels for the task',
    example: ['devops', 'backend'],
  })
  @IsArray({ message: 'tags must be an array' })
  @IsString({ each: true, message: 'each tag must be a string' })
  @IsOptional()
  tags?: string[] = [];

  @ApiPropertyOptional({
    description: 'Due date in ISO 8601 format',
    example: '2026-12-31T23:59:59Z',
  })
  @IsDateString({}, { message: 'dueDate must be a valid ISO 8601 date string' })
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional({
    description: 'The UUID of the assignee user',
    example: 'e278943d-168f-4521-9f59-d510fd4228ee',
  })
  @IsUUID('4', { message: 'assigneeId must be a valid UUID v4' })
  @IsOptional()
  assigneeId?: string;
}
