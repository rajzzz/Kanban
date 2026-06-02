/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspaceRoleGuard } from './workspace-role.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '../decorators/roles.decorator';

describe('WorkspaceRoleGuard', () => {
  let guard: WorkspaceRoleGuard;
  let reflector: jest.Mocked<Reflector>;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    prisma = {
      workspaceMember: {
        findUnique: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    guard = new WorkspaceRoleGuard(reflector, prisma);
  });

  function createMockContext(
    params: Record<string, string | undefined>,
    user?: { userId: string } | null,
    body?: Record<string, unknown>,
  ): ExecutionContext {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          params,
          user,
          body,
        }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should throw BadRequestException if workspaceId is missing from route params and request body', async () => {
    const context = createMockContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(
      new BadRequestException(
        'workspaceId is missing from route parameters or request body',
      ),
    );
  });

  it('should resolve workspaceId from request body if missing from route params', async () => {
    const context = createMockContext(
      {},
      { userId: 'user-456' },
      { workspaceId: 'ws-123' },
    );
    jest.spyOn(prisma.workspaceMember, 'findUnique').mockResolvedValue({
      id: 'member-789',
      workspaceId: 'ws-123',
      userId: 'user-456',
      role: 'MEMBER',
      joinedAt: new Date(),
      workspace: { id: 'ws-123', name: 'WS' } as any,
    } as any);

    reflector.getAllAndOverride.mockReturnValue(undefined);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException if user is not authenticated', async () => {
    const context = createMockContext({ workspaceId: 'ws-123' }, null);
    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException('Access denied: user is not authenticated'),
    );
  });

  it('should throw ForbiddenException if user is not a member of the workspace', async () => {
    const context = createMockContext(
      { workspaceId: 'ws-123' },
      { userId: 'user-456' },
    );
    jest.spyOn(prisma.workspaceMember, 'findUnique').mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException('Access denied: not a member of this workspace'),
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(prisma.workspaceMember.findUnique).toHaveBeenCalledWith({
      where: {
        workspaceId_userId: {
          workspaceId: 'ws-123',
          userId: 'user-456',
        },
      },
      include: {
        workspace: true,
      },
    });
  });

  it('should return true if user is a member and no roles are required', async () => {
    const context = createMockContext(
      { workspaceId: 'ws-123' },
      { userId: 'user-456' },
    );
    const mockWorkspace = {
      id: 'ws-123',
      name: 'Test Workspace',
      description: null,
      organizationId: 'org-456',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    jest.spyOn(prisma.workspaceMember, 'findUnique').mockResolvedValue({
      id: 'member-789',
      workspaceId: 'ws-123',
      userId: 'user-456',
      role: 'MEMBER',
      joinedAt: new Date(),
      workspace: mockWorkspace,
    } as any);
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);

    const request = context.switchToHttp().getRequest<any>();
    expect(request.workspace).toEqual(mockWorkspace);
  });

  it('should throw ForbiddenException if user role does not match required roles', async () => {
    const context = createMockContext(
      { workspaceId: 'ws-123' },
      { userId: 'user-456' },
    );
    const mockWorkspace = {
      id: 'ws-123',
      name: 'Test Workspace',
      description: null,
      organizationId: 'org-456',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    jest.spyOn(prisma.workspaceMember, 'findUnique').mockResolvedValue({
      id: 'member-789',
      workspaceId: 'ws-123',
      userId: 'user-456',
      role: 'VIEWER',
      joinedAt: new Date(),
      workspace: mockWorkspace,
    } as any);
    reflector.getAllAndOverride.mockReturnValue([Role.OWNER, Role.ADMIN]);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException('Access denied: insufficient permissions'),
    );

    const request = context.switchToHttp().getRequest<any>();
    expect(request.workspace).toEqual(mockWorkspace);
  });

  it('should return true if user role matches one of the required roles', async () => {
    const context = createMockContext(
      { workspaceId: 'ws-123' },
      { userId: 'user-456' },
    );
    const mockWorkspace = {
      id: 'ws-123',
      name: 'Test Workspace',
      description: null,
      organizationId: 'org-456',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    jest.spyOn(prisma.workspaceMember, 'findUnique').mockResolvedValue({
      id: 'member-789',
      workspaceId: 'ws-123',
      userId: 'user-456',
      role: 'ADMIN',
      joinedAt: new Date(),
      workspace: mockWorkspace,
    } as any);
    reflector.getAllAndOverride.mockReturnValue([Role.OWNER, Role.ADMIN]);

    const result = await guard.canActivate(context);
    expect(result).toBe(true);

    const request = context.switchToHttp().getRequest<any>();
    expect(request.workspace).toEqual(mockWorkspace);
  });
});
