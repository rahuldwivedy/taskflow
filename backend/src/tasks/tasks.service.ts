import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityEvent, Priority, TaskStatus } from '@prisma/client';
import { CreateTaskDto, UpdateTaskDto, UpdateStatusDto, TaskQueryDto } from './tasks.dto';
import { TaskGateway } from '../websocket/task.gateway';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private gateway: TaskGateway,
  ) {}

  async findAll(projectId: string, query: TaskQueryDto) {
    const { page = 1, limit = 20, status, priority, assigneeId, search, sort = 'createdAt', order = 'desc' } = query;

    const where: any = { projectId };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assigneeId) where.assigneeId = assigneeId;
    if (search) where.title = { contains: search };

    // MySQL-safe orderBy
    let orderBy: any = { createdAt: order };
    if (sort === 'dueDate') orderBy = { dueDate: order };
    else if (sort === 'priority') orderBy = { priority: order };
    else if (sort === 'createdAt') orderBy = { createdAt: order };

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip: (page - 1) * limit,
        take: Number(limit),
        orderBy,
        include: {
          assignee: { select: { id: true, name: true, email: true } },
          createdBy: { select: { id: true, name: true } },
          _count: { select: { comments: true } },
        },
      }),
      this.prisma.task.count({ where }),
    ]);

    return { tasks, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async create(projectId: string, userId: string, dto: CreateTaskDto) {
    if (dto.dueDate && new Date(dto.dueDate) < new Date()) {
      throw new BadRequestException('Due date cannot be in the past');
    }

    if (dto.assigneeId) {
      await this.assertProjectMember(projectId, dto.assigneeId, 'Assignee is not a member of this project');
    }

    const task = await this.prisma.task.create({
      data: {
        projectId,
        createdById: userId,
        title: dto.title,
        description: dto.description,
        status: dto.status || TaskStatus.TODO,
        priority: dto.priority || Priority.MEDIUM,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        assigneeId: dto.assigneeId || null,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    await this.prisma.activityLog.create({
      data: {
        projectId,
        actorId: userId,
        eventType: ActivityEvent.TASK_CREATED,
        payload: { taskId: task.id, title: task.title },
      },
    });

    if (dto.assigneeId) {
      await this.prisma.activityLog.create({
        data: {
          projectId,
          actorId: userId,
          eventType: ActivityEvent.TASK_ASSIGNED,
          payload: { taskId: task.id, title: task.title, assigneeId: dto.assigneeId },
        },
      });
    }

    this.gateway.emitToProject(projectId, 'task:created', task);

    if (task.assigneeId) {
      this.gateway.emitToUser(task.assigneeId, 'assigned:updated', { task });
    }

    return task;
  }

  async update(projectId: string, taskId: string, userId: string, dto: UpdateTaskDto) {
    const task = await this.assertTaskExists(taskId, projectId);

    if (dto.dueDate && new Date(dto.dueDate) < new Date()) {
      throw new BadRequestException('Due date cannot be in the past');
    }

    if (dto.assigneeId) {
      await this.assertProjectMember(projectId, dto.assigneeId, 'Assignee is not a member of this project');
    }

    const prevAssigneeId = task.assigneeId;

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
        ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId || null }),
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (dto.assigneeId && dto.assigneeId !== prevAssigneeId) {
      await this.prisma.activityLog.create({
        data: {
          projectId,
          actorId: userId,
          eventType: ActivityEvent.TASK_ASSIGNED,
          payload: { taskId, title: task.title, assigneeId: dto.assigneeId },
        },
      });
      this.gateway.emitToUser(dto.assigneeId, 'assigned:updated', { task: updated });
    }

    this.gateway.emitToProject(projectId, 'task:updated', updated);
    return updated;
  }

  async updateStatus(projectId: string, taskId: string, userId: string, dto: UpdateStatusDto, memberRole: string) {
    const task = await this.assertTaskExists(taskId, projectId);

    if (dto.status === TaskStatus.DONE) {
      const isOwner = memberRole === 'OWNER';
      const isAssignee = task.assigneeId === userId;
      if (!isOwner && !isAssignee) {
        throw new ForbiddenException('Only the task assignee or project owner can mark a task as Done');
      }
    }

    const prevStatus = task.status;
    const completedAt =
      dto.status === TaskStatus.DONE ? new Date() :
      prevStatus === TaskStatus.DONE ? null :
      task.completedAt;

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { status: dto.status, completedAt },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    await this.prisma.activityLog.create({
      data: {
        projectId,
        actorId: userId,
        eventType: ActivityEvent.TASK_MOVED,
        payload: { taskId, title: task.title, from: prevStatus, to: dto.status },
      },
    });

    this.gateway.emitToProject(projectId, 'task:updated', updated);
    return updated;
  }

  async delete(projectId: string, taskId: string, userId: string) {
    await this.assertTaskExists(taskId, projectId);
    await this.prisma.task.delete({ where: { id: taskId } });
    this.gateway.emitToProject(projectId, 'task:deleted', { taskId });
    return { message: 'Task deleted' };
  }

  async findAssignedToMe(userId: string) {
    const tasks = await this.prisma.task.findMany({
      where: { assigneeId: userId },
      include: {
        project: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return tasks;
  }

  private async assertTaskExists(taskId: string, projectId: string) {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, projectId } });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private async assertProjectMember(projectId: string, userId: string, message: string) {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!member) throw new BadRequestException(message);
  }
}