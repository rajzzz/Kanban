import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY, Role } from '../decorators/roles.decorator';
import { CurrentUserPayload } from '../decorators/current-user.decorator';
import { Workspace } from '../../../generated/prisma/client';

interface AuthenticatedRequest extends Request {
  user?: CurrentUserPayload;
  workspace?: Workspace;
}

@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // 1. Read workspaceId from route params or request body
    const params = request.params as Record<string, string | undefined>;
    let workspaceId = params?.workspaceId;
    if (!workspaceId && request.body) {
      const body = request.body as Record<string, unknown>;
      if (typeof body.workspaceId === 'string') {
        workspaceId = body.workspaceId;
      }
    }

    if (!workspaceId) {
      throw new BadRequestException(
        'workspaceId is missing from route parameters or request body',
      );
    }

    // 2. Extract requesting user
    const user = request.user;
    if (!user || !user.userId) {
      throw new ForbiddenException('Access denied: user is not authenticated');
    }

    // 3. Query WorkspaceMember table to verify the requesting user is a member
    // and include the associated Workspace entity.
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: user.userId,
        },
      },
      include: {
        workspace: true,
      },
    });

    if (!member) {
      throw new ForbiddenException(
        'Access denied: not a member of this workspace',
      );
    }

    // Attach resolved Workspace entity to the request context
    request.workspace = member.workspace;

    // 4. Retrieve roles metadata from handler/class
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles are defined by @Roles() decorator, member access is sufficient
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // 5. Check member role against @Roles() metadata
    const hasRole = requiredRoles.includes(member.role as Role);
    if (!hasRole) {
      throw new ForbiddenException('Access denied: insufficient permissions');
    }

    return true;
  }
}
