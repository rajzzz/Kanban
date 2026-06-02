import { IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignTaskDto {
  @ApiProperty({
    description: 'The UUID of the user to assign the task to',
    example: 'e278943d-168f-4521-9f59-d510fd4228ee',
  })
  @IsUUID('4', { message: 'assigneeId must be a valid UUID v4' })
  @IsNotEmpty({ message: 'assigneeId is required' })
  assigneeId: string;
}
