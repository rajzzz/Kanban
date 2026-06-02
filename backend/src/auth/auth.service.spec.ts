import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwt: JwtService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    organization: {
      create: jest.fn(),
    },
    organizationMember: {
      create: jest.fn(),
    },
    workspace: {
      create: jest.fn(),
    },
    workspaceMember: {
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwt = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'test@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id-123',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        memberships: [],
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return tokens and set up refresh token on successful login', async () => {
      const mockUser = {
        id: 'user-id-123',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
        memberships: [
          {
            workspaceId: 'workspace-id-456',
            role: 'OWNER',
            joinedAt: new Date(),
          },
        ],
      };
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_refresh_token');
      
      // signAsync called twice: once for access token, once for refresh token JWT
      mockJwtService.signAsync
        .mockResolvedValueOnce('mock_access_token')
        .mockResolvedValueOnce('mock_refresh_token_jwt');

      mockPrismaService.refreshToken.create.mockResolvedValue({ id: 'rt-id' });

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('accessToken', 'mock_access_token');
      expect(result).toHaveProperty('refreshToken', 'mock_refresh_token_jwt');
      expect(result).toHaveProperty('expiresAt');
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        include: {
          memberships: {
            orderBy: { joinedAt: 'asc' },
          },
        },
      });
      expect(mockJwtService.signAsync).toHaveBeenNthCalledWith(
        1,
        {
          sub: 'user-id-123',
          userId: 'user-id-123',
          workspaceId: 'workspace-id-456',
          role: 'OWNER',
        },
        { expiresIn: '15m' },
      );
      expect(mockPrismaService.refreshToken.create).toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('should throw UnauthorizedException if token verification fails', async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      await expect(service.refresh('invalid_token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if refresh token is not found in DB', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 'user-id-123', tokenId: 'token-id-123' });
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh('token_value')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if bcrypt hash does not match', async () => {
      mockJwtService.verifyAsync.mockResolvedValue({ sub: 'user-id-123', tokenId: 'token-id-123' });
      mockPrismaService.refreshToken.findUnique.mockResolvedValue({
        id: 'token-id-123',
        tokenHash: 'different_hash',
        expiresAt: new Date(Date.now() + 100000),
        revoked: false,
        user: { memberships: [] },
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.refresh('token_value')).rejects.toThrow(UnauthorizedException);
    });

    it('should rotate tokens and delete old token on successful refresh', async () => {
      const mockRecord = {
        id: 'token-id-123',
        tokenHash: 'hashed_token',
        expiresAt: new Date(Date.now() + 100000),
        revoked: false,
        userId: 'user-id-123',
        user: {
          memberships: [
            {
              workspaceId: 'workspace-id-456',
              role: 'OWNER',
              joinedAt: new Date(),
            },
          ],
        },
      };

      mockJwtService.verifyAsync.mockResolvedValue({ sub: 'user-id-123', tokenId: 'token-id-123' });
      mockPrismaService.refreshToken.findUnique.mockResolvedValue(mockRecord);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_new_refresh_token');

      mockJwtService.signAsync
        .mockResolvedValueOnce('mock_new_access_token')
        .mockResolvedValueOnce('mock_new_refresh_token_jwt');

      const result = await service.refresh('token_value');

      expect(result).toEqual({
        accessToken: 'mock_new_access_token',
        refreshToken: 'mock_new_refresh_token_jwt',
      });
      expect(mockPrismaService.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: 'token-id-123' },
      });
      expect(mockPrismaService.refreshToken.create).toHaveBeenCalled();
    });
  });
});
