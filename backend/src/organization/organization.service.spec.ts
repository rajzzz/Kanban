import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationService } from './organization.service';
import { PrismaService } from '../prisma/prisma.service';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let prisma: PrismaService;

  const mockPrismaService = {
    organizationMember: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<OrganizationService>(OrganizationService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAllForUser', () => {
    it('should return mapped organizations for user', async () => {
      const mockMemberships = [
        {
          id: 'mem-1',
          role: 'OWNER',
          joinedAt: new Date(),
          organization: {
            id: 'org-1',
            name: 'Org A',
          },
        },
        {
          id: 'mem-2',
          role: 'MEMBER',
          joinedAt: new Date(),
          organization: {
            id: 'org-2',
            name: 'Org B',
          },
        },
      ];
      mockPrismaService.organizationMember.findMany.mockResolvedValue(mockMemberships);

      const result = await service.findAllForUser('user-id-123');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'org-1',
        name: 'Org A',
        role: 'OWNER',
        joinedAt: mockMemberships[0].joinedAt,
      });
      expect(mockPrismaService.organizationMember.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-id-123' },
        include: { organization: true },
        orderBy: { organization: { name: 'asc' } },
      });
    });
  });
});
