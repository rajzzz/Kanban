import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { Workspace } from '../../../generated/prisma/client';

interface AuthenticatedRequest extends Request {
  workspace?: Workspace;
}

export const CurrentWorkspace = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Workspace | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.workspace;
  },
);
