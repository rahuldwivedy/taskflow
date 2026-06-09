import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { CommentsService, CreateCommentDto } from './comments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';
import { CurrentUser } from '../common/decorators';
import { Module } from '@nestjs/common';
import { ProjectMemberGuard as PMG } from '../common/guards/project-member.guard';
import { WebsocketModule } from '../websocket/websocket.module';

@Controller('projects/:projectId/tasks/:taskId/comments')
@UseGuards(JwtAuthGuard, ProjectMemberGuard)
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  @Get()
  findAll(@Param('taskId') taskId: string) {
    return this.commentsService.findAll(taskId);
  }

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateCommentDto,
  ) {
    return this.commentsService.create(projectId, taskId, user.id, dto);
  }
}

@Module({
  imports: [WebsocketModule],
  providers: [CommentsService, PMG],
  controllers: [CommentsController],
})
export class CommentsModule {}
