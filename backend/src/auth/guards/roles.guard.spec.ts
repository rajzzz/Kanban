import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '../decorators/roles.decorator';

/**
 * RolesGuard is a documented pass-through guard.
 * Role enforcement is delegated to WorkspaceRoleGuard which
 * re-queries WorkspaceMember on every request.
 *
 * These tests verify the guard returns true in all cases
 * (it no longer inspects the JWT role).
 */
describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new RolesGuard(reflector);
  });

  function createMockContext(): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({}),
      }),
    } as unknown as ExecutionContext;
  }

  it('should return true when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(createMockContext())).toBe(true);
  });

  it('should return true when empty roles array', () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    expect(guard.canActivate(createMockContext())).toBe(true);
  });

  it('should return true even when @Roles() is set — WorkspaceRoleGuard handles enforcement', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    expect(guard.canActivate(createMockContext())).toBe(true);
  });

  it('should return true regardless of required roles — enforcement is in WorkspaceRoleGuard', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.OWNER, Role.ADMIN]);
    expect(guard.canActivate(createMockContext())).toBe(true);
  });
});
