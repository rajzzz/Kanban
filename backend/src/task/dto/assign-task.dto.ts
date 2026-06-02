import { IsUUID, IsNotEmpty } from 'class-validator';

export class AssignTaskDto {
  @IsUUID('4', { message: 'assigneeId must be a valid UUID v4' })
  @IsNotEmpty({ message: 'assigneeId is required' })
  assigneeId: string;
}
