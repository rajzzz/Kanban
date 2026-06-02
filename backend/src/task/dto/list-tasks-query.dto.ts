import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TaskPriority, TaskStatus } from '../../../generated/prisma/client';

export class ListTasksQueryDto {
  @IsEnum(TaskStatus, { message: 'status must be a valid TaskStatus' })
  @IsOptional()
  status?: TaskStatus;

  @IsEnum(TaskPriority, { message: 'priority must be a valid TaskPriority' })
  @IsOptional()
  priority?: TaskPriority;

  @IsUUID('4', { message: 'assigneeId must be a valid UUID v4' })
  @IsOptional()
  assigneeId?: string;
}
