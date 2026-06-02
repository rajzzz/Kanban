import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceService } from './workspace.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  let prisma: PrismaService;

  const mockPrismaService = {
    organizationMember: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    workspace: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    workspaceMember: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<WorkspaceService>(WorkspaceService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create workspace using organizationId in DTO if user is OWNER/ADMIN', async () => {
      mockPrismaService.organizationMember.findUnique.mockResolvedValue({
        organizationId: 'org-id-123',
        userId: 'user-id-456',
        role: 'OWNER',
      });
      mockPrismaService.workspace.create.mockResolvedValue({
        id: 'workspace-id-789',
        name: 'My Workspace',
        organizationId: 'org-id-123',
      });
      mockPrismaService.workspaceMember.create.mockResolvedValue({
        id: 'member-id-abc',
        workspaceId: 'workspace-id-789',
        userId: 'user-id-456',
        role: 'OWNER',
      });

      const result = await service.create('user-id-456', {
        name: 'My Workspace',
        organizationId: 'org-id-123',
      });

      expect(result.workspace).toHaveProperty('id', 'workspace-id-789');
      expect(result.member).toHaveProperty('role', 'OWNER');
      expect(mockPrismaService.organizationMember.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_userId: {
            organizationId: 'org-id-123',
            userId: 'user-id-456',
          },
        },
      });
      expect(mockPrismaService.workspace.create).toHaveBeenCalledWith({
        data: {
          name: 'My Workspace',
          organizationId: 'org-id-123',
        },
      });
    });

    it('should throw ForbiddenException if user is not OWNER/ADMIN for specified organizationId', async () => {
      mockPrismaService.organizationMember.findUnique.mockResolvedValue({
        organizationId: 'org-id-123',
        userId: 'user-id-456',
        role: 'MEMBER', // Not owner/admin
      });

      await expect(
        service.create('user-id-456', {
          name: 'My Workspace',
          organizationId: 'org-id-123',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should find default organization if organizationId is not specified in DTO', async () => {
      mockPrismaService.organizationMember.findFirst.mockResolvedValue({
        organizationId: 'default-org-id',
        userId: 'user-id-456',
        role: 'OWNER',
      });
      mockPrismaService.workspace.create.mockResolvedValue({
        id: 'workspace-id-789',
        name: 'Default Workspace',
        organizationId: 'default-org-id',
      });
      mockPrismaService.workspaceMember.create.mockResolvedValue({
        id: 'member-id-abc',
        workspaceId: 'workspace-id-789',
        userId: 'user-id-456',
        role: 'OWNER',
      });

      const result = await service.create('user-id-456', {
        name: 'Default Workspace',
      });

      expect(result.workspace).toHaveProperty('organizationId', 'default-org-id');
      expect(mockPrismaService.organizationMember.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-id-456',
          role: { in: ['OWNER', 'ADMIN'] },
        },
      });
    });

    it('should throw ForbiddenException if user is not OWNER/ADMIN of any organization and organizationId is not specified', async () => {
      mockPrismaService.organizationMember.findFirst.mockResolvedValue(null);

      await expect(
        service.create('user-id-456', {
          name: 'Default Workspace',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAllForUserInOrg', () => {
    it('should throw ForbiddenException if user does not belong to the organization', async () => {
      mockPrismaService.organizationMember.findUnique.mockResolvedValue(null);

      await expect(
        service.findAllForUserInOrg('user-id-456', 'org-id-123'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return all workspaces in organization if user is OWNER or ADMIN', async () => {
      mockPrismaService.organizationMember.findUnique.mockResolvedValue({
        organizationId: 'org-id-123',
        userId: 'user-id-456',
        role: 'OWNER',
      });
      
      const mockWorkspaces = [{ id: 'w-1', name: 'Work A' }, { id: 'w-2', name: 'Work B' }];
      mockPrismaService.workspace.findMany.mockResolvedValue(mockWorkspaces);

      const result = await service.findAllForUserInOrg('user-id-456', 'org-id-123');

      expect(result).toEqual(mockWorkspaces);
      expect(mockPrismaService.workspace.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-id-123' },
        orderBy: { name: 'asc' },
      });
    });

    it('should return only joined workspaces if user is a standard MEMBER', async () => {
      mockPrismaService.organizationMember.findUnique.mockResolvedValue({
        organizationId: 'org-id-123',
        userId: 'user-id-456',
        role: 'MEMBER',
      });
      
      const mockWorkspaces = [{ id: 'w-1', name: 'Work A' }];
      mockPrismaService.workspace.findMany.mockResolvedValue(mockWorkspaces);

      const result = await service.findAllForUserInOrg('user-id-456', 'org-id-123');

      expect(result).toEqual(mockWorkspaces);
      expect(mockPrismaService.workspace.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-id-123',
          members: {
            some: {
              userId: 'user-id-456',
            },
          },
        },
        orderBy: { name: 'asc' },
      });
    });
  });
});
