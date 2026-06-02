import { IsEnum, IsNotEmpty } from 'class-validator';
import { TaskStatus } from '../../../generated/prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTaskStatusDto {
  @ApiProperty({
    description: 'The new status of the task',
    enum: TaskStatus,
    example: TaskStatus.IN_PROGRESS,
  })
  @IsEnum(TaskStatus, { message: 'status must be a valid TaskStatus' })
  @IsNotEmpty({ message: 'status is required' })
  status: TaskStatus;
}
