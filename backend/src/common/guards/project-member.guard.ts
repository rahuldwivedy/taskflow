import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';

// Use this on routes that need owner-only access
export const OWNER_ONLY_KEY = 'ownerOnly';

@Injectable()
export class ProjectMemberGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId = req.user?.id;
    const projectId = req.params?.projectId || req.params?.id;

    if (!userId || !projectId) return false;

    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });

    if (!member) throw new ForbiddenException('You are not a member of this project');

    // Attach membership info to request for downstream use
    req.membership = member;

    const ownerOnly = this.reflector.get<boolean>(OWNER_ONLY_KEY, context.getHandler());
    if (ownerOnly && member.role !== 'OWNER') {
      throw new ForbiddenException('Only the project owner can perform this action');
    }

    return true;
  }
}
