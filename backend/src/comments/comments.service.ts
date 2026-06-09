import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityEvent } from '@prisma/client';
import { IsString, MinLength } from 'class-validator';
import { TaskGateway } from '../websocket/task.gateway';

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  body: string;
}

@Injectable()
export class CommentsService {
  constructor(
    private prisma: PrismaService,
    private gateway: TaskGateway,
  ) {}

  async findAll(taskId: string) {
    return this.prisma.comment.findMany({
      where: { taskId },
      include: { author: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(projectId: string, taskId: string, userId: string, dto: CreateCommentDto) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, projectId } });
    if (!task) throw new NotFoundException('Task not found');

    const comment = await this.prisma.comment.create({
      data: { taskId, authorId: userId, body: dto.body },
      include: { author: { select: { id: true, name: true, email: true } } },
    });

    await this.prisma.activityLog.create({
      data: {
        projectId,
        actorId: userId,
        eventType: ActivityEvent.COMMENT_ADDED,
        payload: { taskId, taskTitle: task.title, commentId: comment.id },
      },
    });

    this.gateway.emitToProject(projectId, 'comment:added', { taskId, comment });
    return comment;
  }
}
