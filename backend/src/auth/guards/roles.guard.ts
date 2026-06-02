import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, Role } from '../decorators/roles.decorator';

/**
 * RolesGuard is intentionally a no-op pass-through.
 *
 * Role enforcement in this application is done at the workspace level
 * by WorkspaceRoleGuard, which queries WorkspaceMember on every request.
 *
 * The JWT access token carries only identity (userId) — not role or workspaceId —
 * to avoid stale role data in a multi-workspace context.
 *
 * This guard is kept registered globally (via APP_GUARD in AppModule) so that
 * @Roles() metadata on any handler is not silently ignored. If you add a route
 * that requires role enforcement outside the workspace context, implement the
 * check in the relevant service or a dedicated guard.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() decorator → pass through
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // @Roles() on a route outside WorkspaceRoleGuard context is a mis-use.
    // WorkspaceRoleGuard handles role checks — this guard is intentionally permissive.
    return true;
  }
}
