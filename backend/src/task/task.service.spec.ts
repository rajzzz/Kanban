/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { TaskService } from './task.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TaskPriority, TaskStatus } from '../../generated/prisma/client';

const mockTask = {
  create: jest.fn(),
  findMany: jest.fn(),
  findUnique: jest.fn(),
  update: jest.fn(),
};
const mockProject = { findUnique: jest.fn() };
const mockWorkspaceMember = { findUnique: jest.fn() };

const mockPrismaService = {
  task: mockTask,
  project: mockProject,
  workspaceMember: mockWorkspaceMember,
};

const WS_ID = 'ws-abc';
const PROJ_ID = 'proj-xyz';
const TASK_ID = 'task-001';

/** A project fixture that belongs to WS_ID */
const PROJECT_IN_WS = { id: PROJ_ID, workspaceId: WS_ID };
/** A project fixture that belongs to a different workspace */
const PROJECT_OTHER_WS = { id: PROJ_ID, workspaceId: 'other-ws' };

describe('TaskService', () => {
  let service: TaskService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────
  describe('create', () => {
    it('should throw NotFoundException when project does not exist', async () => {
      mockProject.findUnique.mockResolvedValue(null);

      await expect(
        service.create(WS_ID, 'no-proj', 'user-1', { title: 'T' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when project belongs to a different workspace', async () => {
      mockProject.findUnique.mockResolvedValue(PROJECT_OTHER_WS);

      await expect(
        service.create(WS_ID, PROJ_ID, 'user-1', { title: 'T' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create a task with defaults when optional fields are omitted', async () => {
      mockProject.findUnique.mockResolvedValue(PROJECT_IN_WS);
      const created = {
        id: TASK_ID,
        title: 'My Task',
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        tags: [],
        projectId: PROJ_ID,
        creatorId: 'user-1',
        assigneeId: null,
      };
      mockTask.create.mockResolvedValue(created);

      const result = await service.create(WS_ID, PROJ_ID, 'user-1', {
        title: '  My Task  ',
      });

      expect(result.title).toBe('My Task');
      expect(mockTask.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'My Task',
            status: TaskStatus.TODO,
            tags: [],
            projectId: PROJ_ID,
            creatorId: 'user-1',
            assigneeId: null,
          }),
        }),
      );
    });

    it('should persist dueDate as a Date object when provided', async () => {
      mockProject.findUnique.mockResolvedValue(PROJECT_IN_WS);
      mockTask.create.mockResolvedValue({ id: TASK_ID });

      await service.create(WS_ID, PROJ_ID, 'user-1', {
        title: 'Dated task',
        dueDate: '2025-12-31',
      });

      expect(mockTask.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dueDate: new Date('2025-12-31'),
          }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────
  // findAll
  // ─────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('should return tasks with assignee select (no N+1)', async () => {
      mockProject.findUnique.mockResolvedValue(PROJECT_IN_WS);
      const tasks = [
        { id: 't-1', status: TaskStatus.TODO, assignee: null },
        { id: 't-2', status: TaskStatus.IN_PROGRESS, assignee: { id: 'u-1' } },
      ];
      mockTask.findMany.mockResolvedValue(tasks);

      const result = await service.findAll(WS_ID, PROJ_ID, {});

      expect(result).toEqual(tasks);
      expect(mockTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: PROJ_ID },
          include: expect.objectContaining({
            assignee: expect.objectContaining({ select: expect.any(Object) }),
          }),
        }),
      );
    });

    it('should apply status filter to the where clause', async () => {
      mockProject.findUnique.mockResolvedValue(PROJECT_IN_WS);
      mockTask.findMany.mockResolvedValue([]);

      await service.findAll(WS_ID, PROJ_ID, { status: TaskStatus.DONE });

      expect(mockTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: PROJ_ID, status: TaskStatus.DONE },
        }),
      );
    });

    it('should apply priority and assigneeId filters simultaneously', async () => {
      mockProject.findUnique.mockResolvedValue(PROJECT_IN_WS);
      mockTask.findMany.mockResolvedValue([]);

      await service.findAll(WS_ID, PROJ_ID, {
        priority: TaskPriority.HIGH,
        assigneeId: 'user-x',
      });

      expect(mockTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            projectId: PROJ_ID,
            priority: TaskPriority.HIGH,
            assigneeId: 'user-x',
          },
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────
  // assign
  // ─────────────────────────────────────────────────────────
  describe('assign', () => {
    const TASK_IN_WS = {
      id: TASK_ID,
      project: { workspaceId: WS_ID },
      status: TaskStatus.TODO,
    };

    it('should throw NotFoundException when task does not exist', async () => {
      mockTask.findUnique.mockResolvedValue(null);

      await expect(
        service.assign(WS_ID, 'no-task', { assigneeId: 'user-x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when task belongs to a different workspace', async () => {
      mockTask.findUnique.mockResolvedValue({
        id: TASK_ID,
        project: { workspaceId: 'other-ws' },
      });

      await expect(
        service.assign(WS_ID, TASK_ID, { assigneeId: 'user-x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when assignee is not a workspace member', async () => {
      mockTask.findUnique.mockResolvedValue(TASK_IN_WS);
      mockWorkspaceMember.findUnique.mockResolvedValue(null);

      await expect(
        service.assign(WS_ID, TASK_ID, { assigneeId: 'non-member' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update task assignee when all validations pass', async () => {
      mockTask.findUnique.mockResolvedValue(TASK_IN_WS);
      mockWorkspaceMember.findUnique.mockResolvedValue({ userId: 'user-x' });
      mockTask.update.mockResolvedValue({
        id: TASK_ID,
        assigneeId: 'user-x',
        assignee: { id: 'user-x', email: 'x@test.com' },
      });

      const result = await service.assign(WS_ID, TASK_ID, {
        assigneeId: 'user-x',
      });

      expect(result.assigneeId).toBe('user-x');
      expect(mockTask.update).toHaveBeenCalledWith({
        where: { id: TASK_ID },
        data: { assigneeId: 'user-x' },
        include: expect.any(Object),
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // updateStatus — state machine
  // ─────────────────────────────────────────────────────────
  describe('updateStatus', () => {
    const makeTask = (status: TaskStatus) => ({
      id: TASK_ID,
      status,
      project: { workspaceId: WS_ID },
    });

    it('should throw NotFoundException when task is not found in workspace', async () => {
      mockTask.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus(WS_ID, TASK_ID, {
          status: TaskStatus.IN_PROGRESS,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for backward transition IN_PROGRESS → TODO', async () => {
      mockTask.findUnique.mockResolvedValue(makeTask(TaskStatus.IN_PROGRESS));

      await expect(
        service.updateStatus(WS_ID, TASK_ID, { status: TaskStatus.TODO }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for skipping states TODO → IN_REVIEW', async () => {
      mockTask.findUnique.mockResolvedValue(makeTask(TaskStatus.TODO));

      await expect(
        service.updateStatus(WS_ID, TASK_ID, { status: TaskStatus.IN_REVIEW }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when task is in terminal DONE state', async () => {
      mockTask.findUnique.mockResolvedValue(makeTask(TaskStatus.DONE));

      await expect(
        service.updateStatus(WS_ID, TASK_ID, { status: TaskStatus.DONE }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow TODO → IN_PROGRESS', async () => {
      mockTask.findUnique.mockResolvedValue(makeTask(TaskStatus.TODO));
      mockTask.update.mockResolvedValue({
        id: TASK_ID,
        status: TaskStatus.IN_PROGRESS,
      });

      const result = await service.updateStatus(WS_ID, TASK_ID, {
        status: TaskStatus.IN_PROGRESS,
      });

      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should allow IN_PROGRESS → IN_REVIEW', async () => {
      mockTask.findUnique.mockResolvedValue(makeTask(TaskStatus.IN_PROGRESS));
      mockTask.update.mockResolvedValue({
        id: TASK_ID,
        status: TaskStatus.IN_REVIEW,
      });

      const result = await service.updateStatus(WS_ID, TASK_ID, {
        status: TaskStatus.IN_REVIEW,
      });

      expect(result.status).toBe(TaskStatus.IN_REVIEW);
    });

    it('should allow IN_REVIEW → DONE', async () => {
      mockTask.findUnique.mockResolvedValue(makeTask(TaskStatus.IN_REVIEW));
      mockTask.update.mockResolvedValue({
        id: TASK_ID,
        status: TaskStatus.DONE,
      });

      const result = await service.updateStatus(WS_ID, TASK_ID, {
        status: TaskStatus.DONE,
      });

      expect(result.status).toBe(TaskStatus.DONE);
    });

    it('should call task.update with the new status', async () => {
      mockTask.findUnique.mockResolvedValue(makeTask(TaskStatus.TODO));
      mockTask.update.mockResolvedValue({
        id: TASK_ID,
        status: TaskStatus.IN_PROGRESS,
      });

      await service.updateStatus(WS_ID, TASK_ID, {
        status: TaskStatus.IN_PROGRESS,
      });

      expect(mockTask.update).toHaveBeenCalledWith({
        where: { id: TASK_ID },
        data: { status: TaskStatus.IN_PROGRESS },
        include: expect.any(Object),
      });
    });
  });
});
