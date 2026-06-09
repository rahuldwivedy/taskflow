import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto, UpdateStatusDto, TaskQueryDto } from './tasks.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';
import { CurrentUser, Membership } from '../common/decorators';

@Controller('projects/:projectId/tasks')
@UseGuards(JwtAuthGuard, ProjectMemberGuard)
export class TasksController {
  constructor(private tasksService: TasksService) {}

  @Get()
  findAll(@Param('projectId') projectId: string, @Query() query: TaskQueryDto) {
    return this.tasksService.findAll(projectId, query);
  }

  @Post()
  create(
    @Param('projectId') projectId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(projectId, user.id, dto);
  }

  @Patch(':taskId')
  update(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(projectId, taskId, user.id, dto);
  }

  @Patch(':taskId/status')
  updateStatus(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: any,
    @Membership() membership: any,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.tasksService.updateStatus(projectId, taskId, user.id, dto, membership.role);
  }

  @Delete(':taskId')
  delete(
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.delete(projectId, taskId, user.id);
  }
}

// Separate controller for "assigned to me"
import { Controller as Ctrl2 } from '@nestjs/common';

@Ctrl2('me/assigned')
@UseGuards(JwtAuthGuard)
export class AssignedController {
  constructor(private tasksService: TasksService) {}

  @Get()
  findAssigned(@CurrentUser() user: any) {
    return this.tasksService.findAssignedToMe(user.id);
  }
}
