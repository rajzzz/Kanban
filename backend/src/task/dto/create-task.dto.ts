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

export class CreateTaskDto {
  @IsString({ message: 'title must be a string' })
  @IsNotEmpty({ message: 'title is required' })
  title: string;

  @IsString({ message: 'description must be a string' })
  @IsOptional()
  description?: string;

  @IsEnum(TaskStatus, { message: 'status must be a valid TaskStatus' })
  @IsOptional()
  status?: TaskStatus = TaskStatus.TODO;

  @IsEnum(TaskPriority, { message: 'priority must be a valid TaskPriority' })
  @IsOptional()
  priority?: TaskPriority = TaskPriority.MEDIUM;

  @IsArray({ message: 'tags must be an array' })
  @IsString({ each: true, message: 'each tag must be a string' })
  @IsOptional()
  tags?: string[] = [];

  @IsDateString({}, { message: 'dueDate must be a valid ISO 8601 date string' })
  @IsOptional()
  dueDate?: string;

  @IsUUID('4', { message: 'assigneeId must be a valid UUID v4' })
  @IsOptional()
  assigneeId?: string;
}
