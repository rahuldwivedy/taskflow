import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Controller, Get, Param, UseGuards, Module } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';

@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  async getProjectActivity(projectId: string, page = 1, limit = 30) {
    const [logs, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where: { projectId },
        include: { actor: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.activityLog.count({ where: { projectId } }),
    ]);
    return { logs, total };
  }
}

@Controller('projects/:id/activity')
@UseGuards(JwtAuthGuard, ProjectMemberGuard)
export class ActivityController {
  constructor(private activityService: ActivityService) {}

  @Get()
  getActivity(@Param('id') id: string) {
    return this.activityService.getProjectActivity(id);
  }
}

@Module({
  providers: [ActivityService, ProjectMemberGuard],
  controllers: [ActivityController],
  exports: [ActivityService],
})
export class ActivityModule {}
