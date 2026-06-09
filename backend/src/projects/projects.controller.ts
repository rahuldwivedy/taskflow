import {
  Controller, Get, Post, Delete, Body, Param, UseGuards,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, InviteMemberDto } from './projects.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ProjectMemberGuard } from '../common/guards/project-member.guard';
import { CurrentUser, OwnerOnly } from '../common/decorators';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.projectsService.findAllForUser(user.id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user.id, dto);
  }

  @Get(':id')
  @UseGuards(ProjectMemberGuard)
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(ProjectMemberGuard)
  @OwnerOnly()
  delete(@Param('id') id: string) {
    return this.projectsService.delete(id);
  }

  @Post(':id/members')
  @UseGuards(ProjectMemberGuard)
  @OwnerOnly()
  inviteMember(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: InviteMemberDto,
  ) {
    return this.projectsService.inviteMember(id, user.id, dto);
  }

  @Delete(':id/members/:userId')
  @UseGuards(ProjectMemberGuard)
  @OwnerOnly()
  removeMember(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Param('userId') targetUserId: string,
  ) {
    return this.projectsService.removeMember(id, user.id, targetUserId);
  }
}
