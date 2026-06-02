import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { Request } from 'express';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret';

    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtStrategy],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  describe('constructor', () => {
    it('should throw an error if JWT_SECRET is not defined', () => {
      delete process.env.JWT_SECRET;
      expect(() => new JwtStrategy()).toThrow(
        'JWT_SECRET environment variable is not defined',
      );
      process.env.JWT_SECRET = 'test-secret';
    });
  });

  describe('validate', () => {
    it('should validate and return user payload with sub as fallback', () => {
      const payload = {
        sub: 'user-id-123',
        userId: 'user-id-123',
        workspaceId: 'workspace-id-456',
        role: 'OWNER',
      };

      const result = strategy.validate(payload);

      expect(result).toEqual({
        userId: 'user-id-123',
        workspaceId: 'workspace-id-456',
        role: 'OWNER',
      });
    });
  });

  describe('jwtFromRequest cookie extractor', () => {
    // Access the internal extractor function by calling it directly
    // via strategy.validate to avoid `as any` casting.
    // Instead, we expose a testable helper by calling the strategy's
    // own cookie extraction logic through a typed helper.

    function buildRequest(cookie?: string): Request {
      return {
        headers: cookie ? { cookie } : {},
      } as unknown as Request;
    }

    // We test cookie extraction by inspecting the strategy's
    // _jwtFromRequest property which is set by passport-jwt internals.
    // We type it explicitly to avoid unsafe access.
    type JwtExtractorFn = (req: Request) => string | null;

    function getExtractor(): JwtExtractorFn {
      const s = strategy as unknown as { _jwtFromRequest: JwtExtractorFn };
      return s._jwtFromRequest;
    }

    it('should extract access_token from cookies', () => {
      const extractor = getExtractor();
      const result = extractor(
        buildRequest('access_token=mocked_cookie_jwt_value; other=val'),
      );
      expect(result).toBe('mocked_cookie_jwt_value');
    });

    it('should return null if no cookies exist', () => {
      const extractor = getExtractor();
      const result = extractor(buildRequest());
      expect(result).toBeNull();
    });

    it('should return null if access_token cookie does not exist', () => {
      const extractor = getExtractor();
      const result = extractor(buildRequest('other_token=some_value'));
      expect(result).toBeNull();
    });
  });
});
