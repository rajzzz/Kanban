import { Test, TestingModule } from '@nestjs/testing';
import { ProjectService } from './project.service';
import { PrismaService } from '../prisma/prisma.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

const mockProject = {
  create: jest.fn(),
  findMany: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockPrismaService = {
  project: mockProject,
};

const WS_ID = 'ws-abc';
const PROJ_ID = 'proj-123';

describe('ProjectService', () => {
  let service: ProjectService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────
  describe('create', () => {
    it('should create a project scoped to the given workspaceId', async () => {
      const created = {
        id: PROJ_ID,
        name: 'Sprint 1',
        description: 'First sprint',
        workspaceId: WS_ID,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockProject.create.mockResolvedValue(created);

      const result = await service.create(WS_ID, {
        name: '  Sprint 1  ',
        description: 'First sprint',
      });

      expect(result).toEqual(created);
      // workspaceId must come from param, name must be trimmed
      expect(mockProject.create).toHaveBeenCalledWith({
        data: {
          name: 'Sprint 1',
          description: 'First sprint',
          workspaceId: WS_ID,
        },
      });
    });

    it('should create a project without description when omitted', async () => {
      mockProject.create.mockResolvedValue({
        id: PROJ_ID,
        name: 'Backlog',
        description: undefined,
        workspaceId: WS_ID,
      });

      await service.create(WS_ID, { name: 'Backlog' });

      expect(mockProject.create).toHaveBeenCalledWith({
        data: {
          name: 'Backlog',
          description: undefined,
          workspaceId: WS_ID,
        },
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('should return projects with _count.tasks (no N+1)', async () => {
      const projects = [
        { id: 'p-1', name: 'A', workspaceId: WS_ID, _count: { tasks: 3 } },
        { id: 'p-2', name: 'B', workspaceId: WS_ID, _count: { tasks: 0 } },
      ];
      mockProject.findMany.mockResolvedValue(projects);

      const result = await service.findAll(WS_ID);

      expect(result).toEqual(projects);
      expect(mockProject.findMany).toHaveBeenCalledWith({
        where: { workspaceId: WS_ID },
        include: { _count: { select: { tasks: true } } },
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────
  describe('update', () => {
    it('should throw NotFoundException when project does not exist', async () => {
      mockProject.findUnique.mockResolvedValue(null);

      await expect(
        service.update(WS_ID, 'missing-proj', { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when project belongs to a different workspace', async () => {
      mockProject.findUnique.mockResolvedValue({
        id: PROJ_ID,
        workspaceId: 'other-ws',
      });

      await expect(
        service.update(WS_ID, PROJ_ID, { name: 'New' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update only the name when only name is provided', async () => {
      mockProject.findUnique.mockResolvedValue({
        id: PROJ_ID,
        workspaceId: WS_ID,
      });
      mockProject.update.mockResolvedValue({
        id: PROJ_ID,
        name: 'Updated',
        workspaceId: WS_ID,
      });

      const result = await service.update(WS_ID, PROJ_ID, {
        name: '  Updated  ',
      });

      expect(result.name).toBe('Updated');
      expect(mockProject.update).toHaveBeenCalledWith({
        where: { id: PROJ_ID },
        data: { name: 'Updated' },
      });
    });

    it('should update only the description when only description is provided', async () => {
      mockProject.findUnique.mockResolvedValue({
        id: PROJ_ID,
        workspaceId: WS_ID,
      });
      mockProject.update.mockResolvedValue({
        id: PROJ_ID,
        description: 'New desc',
        workspaceId: WS_ID,
      });

      await service.update(WS_ID, PROJ_ID, { description: 'New desc' });

      expect(mockProject.update).toHaveBeenCalledWith({
        where: { id: PROJ_ID },
        data: { description: 'New desc' },
      });
    });

    it('should update both name and description simultaneously', async () => {
      mockProject.findUnique.mockResolvedValue({
        id: PROJ_ID,
        workspaceId: WS_ID,
      });
      mockProject.update.mockResolvedValue({
        id: PROJ_ID,
        name: 'Full Update',
        description: 'and a desc',
        workspaceId: WS_ID,
      });

      await service.update(WS_ID, PROJ_ID, {
        name: 'Full Update',
        description: 'and a desc',
      });

      expect(mockProject.update).toHaveBeenCalledWith({
        where: { id: PROJ_ID },
        data: { name: 'Full Update', description: 'and a desc' },
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // remove
  // ─────────────────────────────────────────────────────────
  describe('remove', () => {
    it('should throw NotFoundException when project does not exist', async () => {
      mockProject.findUnique.mockResolvedValue(null);

      await expect(service.remove(WS_ID, 'no-proj')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when project belongs to a different workspace', async () => {
      mockProject.findUnique.mockResolvedValue({
        id: PROJ_ID,
        workspaceId: 'wrong-ws',
      });

      await expect(service.remove(WS_ID, PROJ_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should delete the project when it belongs to the workspace', async () => {
      mockProject.findUnique.mockResolvedValue({
        id: PROJ_ID,
        workspaceId: WS_ID,
      });
      mockProject.delete.mockResolvedValue({ id: PROJ_ID });

      await service.remove(WS_ID, PROJ_ID);

      expect(mockProject.delete).toHaveBeenCalledWith({
        where: { id: PROJ_ID },
      });
    });
  });
});
