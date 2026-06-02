import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationService } from './organization.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

const mockOrgMember = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
};
const mockWorkspace = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockPrismaService = {
  organizationMember: mockOrgMember,
  workspace: mockWorkspace,
};

describe('OrganizationService', () => {
  let service: OrganizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────
  // findAllForUser
  // ─────────────────────────────────────────────────────────
  describe('findAllForUser', () => {
    it('should return mapped organizations for user', async () => {
      const joinedAt = new Date();
      const mockMemberships = [
        {
          id: 'mem-1',
          role: 'OWNER',
          joinedAt,
          organization: { id: 'org-1', name: 'Org A' },
        },
        {
          id: 'mem-2',
          role: 'MEMBER',
          joinedAt,
          organization: { id: 'org-2', name: 'Org B' },
        },
      ];
      mockOrgMember.findMany.mockResolvedValue(mockMemberships);

      const result = await service.findAllForUser('user-id-123');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'org-1',
        name: 'Org A',
        role: 'OWNER',
        joinedAt,
      });
      expect(mockOrgMember.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-id-123' },
        include: { organization: true },
        orderBy: { organization: { name: 'asc' } },
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // listOrgWorkspaces
  // ─────────────────────────────────────────────────────────
  describe('listOrgWorkspaces', () => {
    it('should throw ForbiddenException if user is not a member of the org', async () => {
      mockOrgMember.findUnique.mockResolvedValue(null);

      await expect(
        service.listOrgWorkspaces('user-1', 'org-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return all workspaces in org without search filter', async () => {
      mockOrgMember.findUnique.mockResolvedValue({ role: 'MEMBER' });
      const workspaces = [
        { id: 'ws-1', name: 'Alpha' },
        { id: 'ws-2', name: 'Beta' },
      ];
      mockWorkspace.findMany.mockResolvedValue(workspaces);

      const result = await service.listOrgWorkspaces('user-1', 'org-1');

      expect(result).toEqual(workspaces);
      expect(mockWorkspace.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        orderBy: { name: 'asc' },
      });
    });

    it('should apply case-insensitive search filter when search param is provided', async () => {
      mockOrgMember.findUnique.mockResolvedValue({ role: 'OWNER' });
      mockWorkspace.findMany.mockResolvedValue([{ id: 'ws-1', name: 'Alpha' }]);

      await service.listOrgWorkspaces('user-1', 'org-1', 'alph');

      expect(mockWorkspace.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          name: { contains: 'alph', mode: 'insensitive' },
        },
        orderBy: { name: 'asc' },
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // updateWorkspace
  // ─────────────────────────────────────────────────────────
  describe('updateWorkspace', () => {
    it('should throw ForbiddenException if user is not org OWNER', async () => {
      mockOrgMember.findUnique.mockResolvedValue({ role: 'ADMIN' });

      await expect(
        service.updateWorkspace('user-1', 'org-1', 'ws-1', { name: 'New' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if workspace does not belong to org', async () => {
      mockOrgMember.findUnique.mockResolvedValue({ role: 'OWNER' });
      mockWorkspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        organizationId: 'other-org',
      });

      await expect(
        service.updateWorkspace('user-1', 'org-1', 'ws-1', { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if workspace does not exist', async () => {
      mockOrgMember.findUnique.mockResolvedValue({ role: 'OWNER' });
      mockWorkspace.findUnique.mockResolvedValue(null);

      await expect(
        service.updateWorkspace('user-1', 'org-1', 'ws-missing', {
          name: 'New',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update workspace name when user is org OWNER', async () => {
      mockOrgMember.findUnique.mockResolvedValue({ role: 'OWNER' });
      mockWorkspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        organizationId: 'org-1',
      });
      mockWorkspace.update.mockResolvedValue({
        id: 'ws-1',
        name: 'New Name',
        organizationId: 'org-1',
      });

      const result = await service.updateWorkspace('user-1', 'org-1', 'ws-1', {
        name: 'New Name',
      });

      expect(result.name).toBe('New Name');
      expect(mockWorkspace.update).toHaveBeenCalledWith({
        where: { id: 'ws-1' },
        data: { name: 'New Name' },
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // deleteWorkspace
  // ─────────────────────────────────────────────────────────
  describe('deleteWorkspace', () => {
    it('should throw ForbiddenException if user is not org OWNER', async () => {
      mockOrgMember.findUnique.mockResolvedValue({ role: 'MEMBER' });

      await expect(
        service.deleteWorkspace('user-1', 'org-1', 'ws-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if workspace does not belong to org', async () => {
      mockOrgMember.findUnique.mockResolvedValue({ role: 'OWNER' });
      mockWorkspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        organizationId: 'different-org',
      });

      await expect(
        service.deleteWorkspace('user-1', 'org-1', 'ws-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete workspace when user is org OWNER and workspace belongs to org', async () => {
      mockOrgMember.findUnique.mockResolvedValue({ role: 'OWNER' });
      mockWorkspace.findUnique.mockResolvedValue({
        id: 'ws-1',
        organizationId: 'org-1',
      });
      mockWorkspace.delete.mockResolvedValue({ id: 'ws-1' });

      await service.deleteWorkspace('user-1', 'org-1', 'ws-1');

      expect(mockWorkspace.delete).toHaveBeenCalledWith({
        where: { id: 'ws-1' },
      });
    });
  });
});
