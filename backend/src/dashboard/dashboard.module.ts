import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Controller, Get, UseGuards, Module } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators';
import { TaskStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(userId: string) {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const [
      projectCount,
      assignedTasks,
      completedThisWeek,
      recentActivity,
    ] = await Promise.all([
      this.prisma.projectMember.count({ where: { userId } }),

      this.prisma.task.groupBy({
        by: ['status'],
        where: { assigneeId: userId },
        _count: { status: true },
      }),

      this.prisma.task.count({
        where: {
          assigneeId: userId,
          status: TaskStatus.DONE,
          completedAt: { gte: startOfWeek },
        },
      }),

      this.prisma.activityLog.findMany({
        where: {
          project: { members: { some: { userId } } },
        },
        include: {
          actor: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    // Project with most open tasks
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    });
    const projectIds = memberships.map((m) => m.projectId);

    const tasksByProject = await this.prisma.task.groupBy({
      by: ['projectId'],
      where: {
        projectId: { in: projectIds },
        status: { not: TaskStatus.DONE },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 1,
    });

    let busiestProject = null;
    if (tasksByProject.length > 0) {
      busiestProject = await this.prisma.project.findUnique({
        where: { id: tasksByProject[0].projectId },
        select: { id: true, name: true },
      });
    }

    const tasksByStatus = assignedTasks.reduce((acc, g) => {
      acc[g.status] = g._count.status;
      return acc;
    }, {} as Record<string, number>);

    return {
      projectCount,
      tasksByStatus,
      completedThisWeek,
      busiestProject,
      recentActivity,
    };
  }
}

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get()
  getDashboard(@CurrentUser() user: any) {
    return this.dashboardService.getDashboard(user.id);
  }
}

@Module({
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
