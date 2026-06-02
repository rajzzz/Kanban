import { IsEnum, IsNotEmpty } from 'class-validator';
import { TaskStatus } from '../../../generated/prisma/client';

export class UpdateTaskStatusDto {
  @IsEnum(TaskStatus, { message: 'status must be a valid TaskStatus' })
  @IsNotEmpty({ message: 'status is required' })
  status: TaskStatus;
}
