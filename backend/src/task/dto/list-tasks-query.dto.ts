import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TaskPriority, TaskStatus } from '../../../generated/prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListTasksQueryDto {
  @ApiPropertyOptional({
    description: 'Filter tasks by status',
    enum: TaskStatus,
  })
  @IsEnum(TaskStatus, { message: 'status must be a valid TaskStatus' })
  @IsOptional()
  status?: TaskStatus;

  @ApiPropertyOptional({
    description: 'Filter tasks by priority',
    enum: TaskPriority,
  })
  @IsEnum(TaskPriority, { message: 'priority must be a valid TaskPriority' })
  @IsOptional()
  priority?: TaskPriority;

  @ApiPropertyOptional({
    description: 'Filter tasks assigned to a specific user UUID',
    example: 'e278943d-168f-4521-9f59-d510fd4228ee',
  })
  @IsUUID('4', { message: 'assigneeId must be a valid UUID v4' })
  @IsOptional()
  assigneeId?: string;
}
