/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceService } from './workspace.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ForbiddenException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WorkspaceRole } from '../../generated/prisma/client';

// Typed mock helpers — extracted so ESLint sees them as jest.Mock, not `any` members
const mockOrgMember = {
  findFirst: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
};
const mockWorkspace = {
  create: jest.fn(),
  findMany: jest.fn(),
};
const mockWorkspaceMember = {
  create: jest.fn(),
  findMany: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
};
const mockWorkspaceInvite = {
  create: jest.fn(),
  findFirst: jest.fn(),
  update: jest.fn(),
};
const mockUser = { findUnique: jest.fn() };
const mockTransaction = jest.fn();

const mockPrismaService = {
  organizationMember: mockOrgMember,
  workspace: mockWorkspace,
  workspaceMember: mockWorkspaceMember,
  workspaceInvite: mockWorkspaceInvite,
  user: mockUser,
  $transaction: mockTransaction,
};

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  let mockJwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret';
    mockTransaction.mockImplementation(
      (cb: (tx: typeof mockPrismaService) => Promise<unknown>) =>
        cb(mockPrismaService),
    );

    mockJwtService = {
      signAsync: jest.fn().mockResolvedValue('mocked-signed-jwt'),
      verifyAsync: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<WorkspaceService>(WorkspaceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────
  // findMyWorkspaces
  // ─────────────────────────────────────────────────────────
  describe('findMyWorkspaces', () => {
    it('should query workspaces for the specified user and include their membership details', async () => {
      const mockWorkspaces = [
        {
          id: 'w-1',
          name: 'Workspace A',
          members: [{ role: 'ADMIN' }],
        },
      ];
      mockWorkspace.findMany.mockResolvedValue(mockWorkspaces);

      const result = await service.findMyWorkspaces('user-id-456');

      expect(result).toEqual(mockWorkspaces);
      expect(mockWorkspace.findMany).toHaveBeenCalledWith({
        where: {
          members: {
            some: {
              userId: 'user-id-456',
            },
          },
        },
        include: {
          members: {
            where: {
              userId: 'user-id-456',
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // findAllForUserInOrg
  // ─────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────
  // inviteUser
  // ─────────────────────────────────────────────────────────
  describe('inviteUser', () => {
    it('should generate a token, save hashed invite to DB, and return token', async () => {
      const mockInviteRecord = {
        id: 'invite-id-uuid',
        email: 'invitee@example.com',
        role: 'MEMBER',
        tokenHash: 'some-hmac-sha256-hash',
        tokenPrefix: 'abc123xyz8',
        expiresAt: new Date(),
        createdAt: new Date(),
        status: 'PENDING',
        workspaceId: 'ws-123',
        invitedById: 'user-456',
      };
      mockWorkspaceInvite.create.mockResolvedValue(mockInviteRecord);

      const result = await service.inviteUser('user-456', {
        workspaceId: 'ws-123',
        email: 'invitee@example.com',
        role: WorkspaceRole.MEMBER,
      });

      expect(result.token).toContain('mocked-signed-jwt');
      expect(result.invite).toEqual({
        id: mockInviteRecord.id,
        email: mockInviteRecord.email,
        role: mockInviteRecord.role,
        status: mockInviteRecord.status,
        expiresAt: mockInviteRecord.expiresAt,
        createdAt: mockInviteRecord.createdAt,
        workspaceId: mockInviteRecord.workspaceId,
        invitedById: mockInviteRecord.invitedById,
      });
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        {
          workspaceId: 'ws-123',
          inviteeEmail: 'invitee@example.com',
        },
        expect.objectContaining({
          expiresIn: '24h',
        }),
      );
      expect(mockWorkspaceInvite.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'invitee@example.com',
          role: 'MEMBER',
          workspaceId: 'ws-123',
          invitedById: 'user-456',
          status: 'PENDING',
        }),
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // acceptInvite
  // ─────────────────────────────────────────────────────────
  describe('acceptInvite', () => {
    const VALID_TOKEN = 'prefix1234.valid-jwt-part';
    const FUTURE_DATE = new Date(Date.now() + 1_000_000);

    it('should throw BadRequestException for tokens without a dot separator', async () => {
      await expect(
        service.acceptInvite('user-1', { token: 'nodotatall' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when JWT verification fails', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(
        service.acceptInvite('user-1', { token: VALID_TOKEN }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when invite record is not found', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        workspaceId: 'ws-1',
        inviteeEmail: 'user@test.com',
      });
      mockWorkspaceInvite.findFirst.mockResolvedValue(null);

      await expect(
        service.acceptInvite('user-1', { token: VALID_TOKEN }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when invite is already accepted', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        workspaceId: 'ws-1',
        inviteeEmail: 'user@test.com',
      });
      mockWorkspaceInvite.findFirst.mockResolvedValue({
        id: 'inv-1',
        status: 'ACCEPTED',
        workspaceId: 'ws-1',
        role: WorkspaceRole.MEMBER,
        expiresAt: FUTURE_DATE,
      });

      await expect(
        service.acceptInvite('user-1', { token: VALID_TOKEN }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create membership and mark invite ACCEPTED atomically', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        workspaceId: 'ws-1',
        inviteeEmail: 'invitee@test.com',
      });
      mockWorkspaceInvite.findFirst.mockResolvedValue({
        id: 'inv-1',
        status: 'PENDING',
        workspaceId: 'ws-1',
        role: WorkspaceRole.MEMBER,
        expiresAt: FUTURE_DATE,
        workspace: {
          organizationId: 'org-1',
        },
      });
      mockUser.findUnique.mockResolvedValue({ id: 'user-abc' });
      mockWorkspaceMember.findUnique.mockResolvedValue(null); // not already a member
      mockOrgMember.findUnique.mockResolvedValue(null); // not already an org member
      mockOrgMember.create.mockResolvedValue({
        organizationId: 'org-1',
        userId: 'user-abc',
        role: 'MEMBER',
      });
      mockWorkspaceMember.create.mockResolvedValue({
        workspaceId: 'ws-1',
        userId: 'user-abc',
        role: WorkspaceRole.MEMBER,
      });
      mockWorkspaceInvite.update.mockResolvedValue({
        id: 'inv-1',
        status: 'ACCEPTED',
      });

      const result = await service.acceptInvite('user-1', {
        token: VALID_TOKEN,
      });

      expect(result.member).toHaveProperty('workspaceId', 'ws-1');
      expect(result.invite).toHaveProperty('status', 'ACCEPTED');
      expect(mockWorkspaceMember.create).toHaveBeenCalledWith({
        data: {
          workspaceId: 'ws-1',
          userId: 'user-abc',
          role: WorkspaceRole.MEMBER,
        },
      });
      expect(mockOrgMember.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_userId: {
            organizationId: 'org-1',
            userId: 'user-abc',
          },
        },
      });
      expect(mockOrgMember.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-1',
          userId: 'user-abc',
          role: 'MEMBER',
        },
      });
      expect(mockWorkspaceInvite.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { status: 'ACCEPTED' },
      });
    });

    it('should not create organization membership if already a member of the organization', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        workspaceId: 'ws-1',
        inviteeEmail: 'invitee@test.com',
      });
      mockWorkspaceInvite.findFirst.mockResolvedValue({
        id: 'inv-1',
        status: 'PENDING',
        workspaceId: 'ws-1',
        role: WorkspaceRole.MEMBER,
        expiresAt: FUTURE_DATE,
        workspace: {
          organizationId: 'org-1',
        },
      });
      mockUser.findUnique.mockResolvedValue({ id: 'user-abc' });
      mockWorkspaceMember.findUnique.mockResolvedValue(null);
      mockOrgMember.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        userId: 'user-abc',
        role: 'MEMBER',
      });
      mockWorkspaceMember.create.mockResolvedValue({
        workspaceId: 'ws-1',
        userId: 'user-abc',
        role: WorkspaceRole.MEMBER,
      });
      mockWorkspaceInvite.update.mockResolvedValue({
        id: 'inv-1',
        status: 'ACCEPTED',
      });

      const result = await service.acceptInvite('user-1', {
        token: VALID_TOKEN,
      });

      expect(result.member).toHaveProperty('workspaceId', 'ws-1');
      expect(mockOrgMember.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_userId: {
            organizationId: 'org-1',
            userId: 'user-abc',
          },
        },
      });
      expect(mockOrgMember.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if user is already a member', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        workspaceId: 'ws-1',
        inviteeEmail: 'invitee@test.com',
      });
      mockWorkspaceInvite.findFirst.mockResolvedValue({
        id: 'inv-1',
        status: 'PENDING',
        workspaceId: 'ws-1',
        role: WorkspaceRole.MEMBER,
        expiresAt: FUTURE_DATE,
        workspace: {
          organizationId: 'org-1',
        },
      });
      mockUser.findUnique.mockResolvedValue({ id: 'user-abc' });
      mockWorkspaceMember.findUnique.mockResolvedValue({
        workspaceId: 'ws-1',
        userId: 'user-abc',
        role: WorkspaceRole.MEMBER,
      });

      await expect(
        service.acceptInvite('user-1', { token: VALID_TOKEN }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─────────────────────────────────────────────────────────
  // listMembers
  // ─────────────────────────────────────────────────────────
  describe('listMembers', () => {
    it('should return all members with user details using a single query', async () => {
      const mockMembers = [
        { userId: 'u-1', role: 'OWNER', user: { id: 'u-1', email: 'a@b.com' } },
        {
          userId: 'u-2',
          role: 'MEMBER',
          user: { id: 'u-2', email: 'c@d.com' },
        },
      ];
      mockWorkspaceMember.findMany.mockResolvedValue(mockMembers);

      const result = await service.listMembers('ws-1');

      expect(result).toEqual(mockMembers);
      expect(mockWorkspaceMember.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: { joinedAt: 'asc' },
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // updateMemberRole
  // ─────────────────────────────────────────────────────────
  describe('updateMemberRole', () => {
    it('should throw ForbiddenException when demoting the last OWNER', async () => {
      mockWorkspaceMember.count.mockResolvedValue(1);
      mockWorkspaceMember.findUnique.mockResolvedValue({
        role: WorkspaceRole.OWNER,
      });

      await expect(
        service.updateMemberRole('ws-1', 'u-1', { role: WorkspaceRole.MEMBER }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when target user is not in workspace', async () => {
      mockWorkspaceMember.count.mockResolvedValue(2);
      mockWorkspaceMember.findUnique
        .mockResolvedValueOnce({ role: WorkspaceRole.OWNER }) // count check finds target
        .mockResolvedValueOnce(null); // second findUnique for existence check

      await expect(
        service.updateMemberRole('ws-1', 'u-missing', {
          role: WorkspaceRole.MEMBER,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update role successfully when multiple owners exist', async () => {
      mockWorkspaceMember.count.mockResolvedValue(2);
      mockWorkspaceMember.findUnique.mockResolvedValue({
        role: WorkspaceRole.OWNER,
      });
      mockWorkspaceMember.update.mockResolvedValue({
        userId: 'u-1',
        role: WorkspaceRole.MEMBER,
        user: { id: 'u-1' },
      });

      const result = await service.updateMemberRole('ws-1', 'u-1', {
        role: WorkspaceRole.MEMBER,
      });

      expect(result.role).toBe(WorkspaceRole.MEMBER);
      expect(mockWorkspaceMember.update).toHaveBeenCalledWith({
        where: { workspaceId_userId: { workspaceId: 'ws-1', userId: 'u-1' } },
        data: { role: WorkspaceRole.MEMBER },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // removeMember
  // ─────────────────────────────────────────────────────────
  describe('removeMember', () => {
    it('should throw NotFoundException when target member does not exist', async () => {
      mockWorkspaceMember.findUnique.mockResolvedValue(null);

      await expect(
        service.removeMember('ws-1', 'req-user', 'missing-user'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when removing self as last OWNER', async () => {
      mockWorkspaceMember.findUnique.mockResolvedValue({
        role: WorkspaceRole.OWNER,
      });
      mockWorkspaceMember.count.mockResolvedValue(1);

      await expect(
        service.removeMember('ws-1', 'u-owner', 'u-owner'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should delete the member record when removal is valid', async () => {
      mockWorkspaceMember.findUnique.mockResolvedValue({
        role: WorkspaceRole.MEMBER,
      });
      mockWorkspaceMember.delete.mockResolvedValue({
        userId: 'u-2',
        workspaceId: 'ws-1',
      });

      await service.removeMember('ws-1', 'u-owner', 'u-2');

      expect(mockWorkspaceMember.delete).toHaveBeenCalledWith({
        where: { workspaceId_userId: { workspaceId: 'ws-1', userId: 'u-2' } },
      });
    });
  });
});
