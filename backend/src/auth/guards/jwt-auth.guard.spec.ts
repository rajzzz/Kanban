import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new JwtAuthGuard(reflector);
  });

  it('should return true if route is marked as public', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const mockContext = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    const superCanActivateSpy = jest
      .spyOn(AuthGuard('jwt').prototype, 'canActivate')
      .mockReturnValue(true);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith('isPublic', [
      mockContext.getHandler(),
      mockContext.getClass(),
    ]);
    expect(superCanActivateSpy).not.toHaveBeenCalled();

    superCanActivateSpy.mockRestore();
  });

  it('should delegate to super.canActivate if route is not public', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const mockContext = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    const superCanActivateSpy = jest
      .spyOn(AuthGuard('jwt').prototype, 'canActivate')
      .mockReturnValue(true);

    const result = await guard.canActivate(mockContext);

    expect(result).toBe(true);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(reflector.getAllAndOverride).toHaveBeenCalled();
    expect(superCanActivateSpy).toHaveBeenCalledWith(mockContext);

    superCanActivateSpy.mockRestore();
  });
});
