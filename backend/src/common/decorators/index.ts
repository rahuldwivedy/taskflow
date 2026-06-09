import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { OWNER_ONLY_KEY } from '../guards/project-member.guard';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user,
);

export const Membership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().membership,
);

export const OwnerOnly = () => SetMetadata(OWNER_ONLY_KEY, true);
