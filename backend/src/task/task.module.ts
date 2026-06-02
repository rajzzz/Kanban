import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TaskController, TaskActionController } from './task.controller';
import { TaskService } from './task.service';

@Module({
  imports: [AuthModule],
  controllers: [TaskController, TaskActionController],
  providers: [TaskService],
})
export class TaskModule {}
