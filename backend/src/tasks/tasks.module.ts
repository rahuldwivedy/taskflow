import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController, AssignedController } from './tasks.controller';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [WebsocketModule],
  providers: [TasksService, ProjectMemberGuard],
  controllers: [TasksController, AssignedController],
})
export class TasksModule {}
