import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import {
  ACCESS_TOKEN_AUDIENCE,
  ACCESS_TOKEN_ISSUER,
  REFRESH_TOKEN_AUDIENCE,
  REFRESH_TOKEN_ISSUER,
  hashRefreshTokenValue,
} from './auth-token.config';

jest.mock('bcrypt');

// Typed mock helpers
const mockUser = {
  findUnique: jest.fn(),
  create: jest.fn(),
};
const mockOrganization = { create: jest.fn() };
const mockOrganizationMember = { create: jest.fn() };
const mockWorkspace = { create: jest.fn() };
const mockWorkspaceMember = { create: jest.fn() };
const mockRefreshToken = {
  create: jest.fn(),
  findUnique: jest.fn(),
  delete: jest.fn(),
  deleteMany: jest.fn(),
};
const mockTransaction = jest.fn();

const mockPrismaService = {
  user: mockUser,
  organization: mockOrganization,
  organizationMember: mockOrganizationMember,
  workspace: mockWorkspace,
  workspaceMember: mockWorkspaceMember,
  refreshToken: mockRefreshToken,
  $transaction: mockTransaction,
};

const mockJwtSignAsync = jest.fn();
const mockJwtVerifyAsync = jest.fn();
const mockJwtService = {
  signAsync: mockJwtSignAsync,
  verifyAsync: mockJwtVerifyAsync,
};

function getCreateRefreshTokenCall(index: number): {
  data: { tokenHash: string };
} {
  const calls = mockRefreshToken.create.mock.calls as Array<
    [{ data: { tokenHash: string } }]
  >;
  return calls[index][0];
}

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret';
    mockTransaction.mockImplementation(
      (cb: (tx: typeof mockPrismaService) => Promise<unknown>) =>
        cb(mockPrismaService),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user not found', async () => {
      mockUser.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'test@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      mockUser.findUnique.mockResolvedValue({
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
      mockUser.findUnique.mockResolvedValue({
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
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_refresh_token');

      // signAsync called twice: once for access token, once for refresh token JWT
      mockJwtSignAsync
        .mockResolvedValueOnce('mock_access_token')
        .mockResolvedValueOnce('mock_refresh_token_jwt');

      mockRefreshToken.create.mockResolvedValue({ id: 'rt-id' });

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('accessToken', 'mock_access_token');
      expect(result).toHaveProperty('refreshToken', 'mock_refresh_token_jwt');
      expect(result).toHaveProperty('expiresAt');
      expect(mockUser.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        include: { memberships: { orderBy: { joinedAt: 'asc' } } },
      });
      expect(mockJwtSignAsync).toHaveBeenNthCalledWith(
        1,
        {
          sub: 'user-id-123',
          userId: 'user-id-123',
          workspaceId: 'workspace-id-456',
          role: 'OWNER',
        },
        {
          secret: 'test-secret',
          expiresIn: '15m',
          issuer: ACCESS_TOKEN_ISSUER,
          audience: ACCESS_TOKEN_AUDIENCE,
        },
      );
      expect(mockRefreshToken.create).toHaveBeenCalled();
      expect(getCreateRefreshTokenCall(0).data.tokenHash).toBe(
        hashRefreshTokenValue('mock_refresh_token_jwt'),
      );
    });
  });

  describe('refresh', () => {
    it('should throw UnauthorizedException if token verification fails', async () => {
      mockJwtVerifyAsync.mockRejectedValue(new Error('Invalid token'));

      await expect(service.refresh('invalid_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if refresh token is not found in DB', async () => {
      mockJwtVerifyAsync.mockResolvedValue({
        sub: 'user-id-123',
        jti: 'token-id-123',
      });
      mockRefreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh('token_value')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if refresh token hash does not match', async () => {
      mockJwtVerifyAsync.mockResolvedValue({
        sub: 'user-id-123',
        jti: 'token-id-123',
      });
      mockRefreshToken.findUnique.mockResolvedValue({
        id: 'token-id-123',
        tokenHash: 'different_hash',
        expiresAt: new Date(Date.now() + 100000),
        revoked: false,
        user: { memberships: [] },
      });

      await expect(service.refresh('token_value')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should rotate tokens and delete old token on successful refresh', async () => {
      mockJwtVerifyAsync.mockResolvedValue({
        sub: 'user-id-123',
        jti: 'token-id-123',
      });
      mockRefreshToken.findUnique.mockResolvedValue({
        id: 'token-id-123',
        tokenHash: hashRefreshTokenValue('token_value'),
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
      });

      mockJwtSignAsync
        .mockResolvedValueOnce('mock_new_access_token')
        .mockResolvedValueOnce('mock_new_refresh_token_jwt');

      const result = await service.refresh('token_value');

      expect(result).toEqual({
        accessToken: 'mock_new_access_token',
        refreshToken: 'mock_new_refresh_token_jwt',
      });
      expect(mockJwtVerifyAsync).toHaveBeenCalledWith('token_value', {
        secret: 'test-secret',
        issuer: REFRESH_TOKEN_ISSUER,
        audience: REFRESH_TOKEN_AUDIENCE,
      });
      expect(mockRefreshToken.delete).toHaveBeenCalledWith({
        where: { id: 'token-id-123' },
      });
      expect(mockRefreshToken.create).toHaveBeenCalled();
      expect(getCreateRefreshTokenCall(0).data.tokenHash).toBe(
        hashRefreshTokenValue('mock_new_refresh_token_jwt'),
      );
    });
  });

  describe('logout', () => {
    it('should delete the refresh token from the database if verification succeeds', async () => {
      mockJwtVerifyAsync.mockResolvedValue({
        sub: 'user-id-123',
        jti: 'token-id-123',
      });
      mockRefreshToken.deleteMany.mockResolvedValue({ count: 1 });

      await service.logout('valid_token_value');

      expect(mockJwtVerifyAsync).toHaveBeenCalledWith('valid_token_value', {
        secret: 'test-secret',
        issuer: REFRESH_TOKEN_ISSUER,
        audience: REFRESH_TOKEN_AUDIENCE,
      });
      expect(mockRefreshToken.deleteMany).toHaveBeenCalledWith({
        where: { id: 'token-id-123' },
      });
    });

    it('should swallow any exceptions and return void if verification fails', async () => {
      mockJwtVerifyAsync.mockRejectedValue(new Error('Invalid token'));

      await expect(
        service.logout('invalid_token_value'),
      ).resolves.not.toThrow();
      expect(mockRefreshToken.deleteMany).not.toHaveBeenCalled();
    });
  });
});
