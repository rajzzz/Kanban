import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceService } from './workspace.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException } from '@nestjs/common';

// Typed mock helpers — extracted so ESLint sees them as jest.Mock, not `any` members
const mockOrgMember = {
  findFirst: jest.fn(),
  findUnique: jest.fn(),
};
const mockWorkspace = {
  create: jest.fn(),
  findMany: jest.fn(),
};
const mockWorkspaceMember = { create: jest.fn() };
const mockTransaction = jest.fn();

const mockPrismaService = {
  organizationMember: mockOrgMember,
  workspace: mockWorkspace,
  workspaceMember: mockWorkspaceMember,
  $transaction: mockTransaction,
};

describe('WorkspaceService', () => {
  let service: WorkspaceService;

  beforeEach(async () => {
    mockTransaction.mockImplementation(
      (cb: (tx: typeof mockPrismaService) => Promise<unknown>) =>
        cb(mockPrismaService),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<WorkspaceService>(WorkspaceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create workspace using organizationId in DTO if user is OWNER/ADMIN', async () => {
      mockOrgMember.findUnique.mockResolvedValue({
        organizationId: 'org-id-123',
        userId: 'user-id-456',
        role: 'OWNER',
      });
      mockWorkspace.create.mockResolvedValue({
        id: 'workspace-id-789',
        name: 'My Workspace',
        organizationId: 'org-id-123',
      });
      mockWorkspaceMember.create.mockResolvedValue({
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
      expect(mockOrgMember.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_userId: {
            organizationId: 'org-id-123',
            userId: 'user-id-456',
          },
        },
      });
      expect(mockWorkspace.create).toHaveBeenCalledWith({
        data: { name: 'My Workspace', organizationId: 'org-id-123' },
      });
    });

    it('should throw ForbiddenException if user is not OWNER/ADMIN for specified organizationId', async () => {
      mockOrgMember.findUnique.mockResolvedValue({
        organizationId: 'org-id-123',
        userId: 'user-id-456',
        role: 'MEMBER',
      });

      await expect(
        service.create('user-id-456', {
          name: 'My Workspace',
          organizationId: 'org-id-123',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should find default organization if organizationId is not specified in DTO', async () => {
      mockOrgMember.findFirst.mockResolvedValue({
        organizationId: 'default-org-id',
        userId: 'user-id-456',
        role: 'OWNER',
      });
      mockWorkspace.create.mockResolvedValue({
        id: 'workspace-id-789',
        name: 'Default Workspace',
        organizationId: 'default-org-id',
      });
      mockWorkspaceMember.create.mockResolvedValue({
        id: 'member-id-abc',
        workspaceId: 'workspace-id-789',
        userId: 'user-id-456',
        role: 'OWNER',
      });

      const result = await service.create('user-id-456', {
        name: 'Default Workspace',
      });

      expect(result.workspace).toHaveProperty(
        'organizationId',
        'default-org-id',
      );
      expect(mockOrgMember.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-id-456',
          role: { in: ['OWNER', 'ADMIN'] },
        },
      });
    });

    it('should throw ForbiddenException if user is not OWNER/ADMIN of any organization and organizationId is not specified', async () => {
      mockOrgMember.findFirst.mockResolvedValue(null);

      await expect(
        service.create('user-id-456', { name: 'Default Workspace' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAllForUserInOrg', () => {
    it('should throw ForbiddenException if user does not belong to the organization', async () => {
      mockOrgMember.findUnique.mockResolvedValue(null);

      await expect(
        service.findAllForUserInOrg('user-id-456', 'org-id-123'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return all workspaces in organization if user is OWNER or ADMIN', async () => {
      mockOrgMember.findUnique.mockResolvedValue({
        organizationId: 'org-id-123',
        userId: 'user-id-456',
        role: 'OWNER',
      });

      const mockWorkspaces = [
        { id: 'w-1', name: 'Work A' },
        { id: 'w-2', name: 'Work B' },
      ];
      mockWorkspace.findMany.mockResolvedValue(mockWorkspaces);

      const result = await service.findAllForUserInOrg(
        'user-id-456',
        'org-id-123',
      );

      expect(result).toEqual(mockWorkspaces);
      expect(mockWorkspace.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-id-123' },
        orderBy: { name: 'asc' },
      });
    });

    it('should return only joined workspaces if user is a standard MEMBER', async () => {
      mockOrgMember.findUnique.mockResolvedValue({
        organizationId: 'org-id-123',
        userId: 'user-id-456',
        role: 'MEMBER',
      });

      const mockWorkspaces = [{ id: 'w-1', name: 'Work A' }];
      mockWorkspace.findMany.mockResolvedValue(mockWorkspaces);

      const result = await service.findAllForUserInOrg(
        'user-id-456',
        'org-id-123',
      );

      expect(result).toEqual(mockWorkspaces);
      expect(mockWorkspace.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-id-123',
          members: { some: { userId: 'user-id-456' } },
        },
        orderBy: { name: 'asc' },
      });
    });
  });
});
