import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new RolesGuard(reflector);
  });

  function createMockContext(user?: { role: string | null }): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should return true if no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const context = createMockContext();
    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should return true if empty roles array is required', () => {
    reflector.getAllAndOverride.mockReturnValue([]);

    const context = createMockContext();
    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should throw ForbiddenException if roles are required but user is not in request', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

    // Context with no user object
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({}),
      }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(
      new ForbiddenException('Access denied: insufficient permissions'),
    );
  });

  it('should throw ForbiddenException if roles are required but user role is null', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);

    const context = createMockContext({ role: null });

    expect(() => guard.canActivate(context)).toThrow(
      new ForbiddenException('Access denied: insufficient permissions'),
    );
  });

  it('should throw ForbiddenException if user role does not match required roles', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.OWNER, Role.ADMIN]);

    const context = createMockContext({ role: Role.MEMBER });

    expect(() => guard.canActivate(context)).toThrow(
      new ForbiddenException('Access denied: insufficient permissions'),
    );
  });

  it('should return true if user role matches one of the required roles', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.OWNER, Role.ADMIN]);

    const context = createMockContext({ role: Role.ADMIN });
    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });
});
