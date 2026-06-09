import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityEvent, Role } from '@prisma/client';
import { CreateProjectDto, InviteMemberDto } from './projects.dto';
import { TaskGateway } from '../websocket/task.gateway';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private gateway: TaskGateway,
  ) {}

  async findAllForUser(userId: string) {
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId },
      include: {
        project: {
          include: {
            _count: { select: { tasks: true, members: true } },
          },
        },
      },
    });
    return memberships.map((m) => ({ ...m.project, role: m.role }));
  }

  async create(userId: string, dto: CreateProjectDto) {
    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        ownerId: userId,
        members: { create: { userId, role: Role.OWNER } },
      },
    });
    return project;
  }

  async findOne(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async delete(projectId: string) {
    await this.prisma.project.delete({ where: { id: projectId } });
  }

  async inviteMember(projectId: string, actorId: string, dto: InviteMemberDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new NotFoundException(`No user found with email ${dto.email}`);

    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    if (existing) throw new BadRequestException('User is already a member');

    const member = await this.prisma.projectMember.create({
      data: { projectId, userId: user.id, role: Role.MEMBER },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    await this.prisma.activityLog.create({
      data: {
        projectId,
        actorId,
        eventType: ActivityEvent.MEMBER_INVITED,
        payload: { userId: user.id, name: user.name, email: user.email },
      },
    });

    // Add their socket to the project room if online
    this.gateway.addUserToProjectRoom(user.id, projectId);

    return member;
  }

  async removeMember(projectId: string, actorId: string, targetUserId: string) {
    const target = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: targetUserId } },
      include: { user: true },
    });
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === Role.OWNER) throw new ForbiddenException('Cannot remove the project owner');

    // Unassign their tasks in this project
    await this.prisma.task.updateMany({
      where: { projectId, assigneeId: targetUserId },
      data: { assigneeId: null },
    });

    await this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    });

    await this.prisma.activityLog.create({
      data: {
        projectId,
        actorId,
        eventType: ActivityEvent.MEMBER_REMOVED,
        payload: { userId: targetUserId, name: target.user.name },
      },
    });

    // Remove their socket from the project room
    this.gateway.removeUserFromProjectRoom(targetUserId, projectId);

    // Emit update so board refreshes for all members
    this.gateway.emitToProject(projectId, 'member:removed', { userId: targetUserId });

    return { message: 'Member removed' };
  }
}
