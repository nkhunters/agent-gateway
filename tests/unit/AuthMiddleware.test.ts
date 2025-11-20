import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { AuthMiddleware } from '../../src/middlewares/AuthMiddleware';
import { TokenValidationService } from '../../src/services/TokenValidationService';
import { TokenPayload } from '../../src/types/TokenPayload';

// Mock logger to avoid console output during tests
jest.mock('../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('AuthMiddleware', () => {
  let middleware: AuthMiddleware;
  let mockTokenService: jest.Mocked<TokenValidationService>;
  let mockRequest: any;
  let mockResponse: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    // Create mock token service
    mockTokenService = {
      validateToken: jest.fn() as any,
      extractTokenFromHeader: jest.fn() as any
    } as jest.Mocked<TokenValidationService>;

    middleware = new AuthMiddleware(mockTokenService);

    mockRequest = {
      headers: {},
      path: '/test'
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    mockNext = jest.fn() as jest.Mock;
  });

  test('should authenticate valid token', async () => {
    const mockPayload: TokenPayload = {
      sub: 'test-client',
      jti: 'test-jti',
      applicationName: 'TestApp',
      financialId: 'FIN-001',
      channelId: 'CH-001',
      allowedTools: ['weather'],
      allowedApis: [],
      isDeveloperPortalAPIsEnabled: false,
      iat: 1234567890,
      exp: 1234567900,
      type: 'access'
    };

    mockRequest.headers.authorization = 'Bearer test-token';

    mockTokenService.extractTokenFromHeader.mockReturnValue('test-token');
    mockTokenService.validateToken.mockResolvedValue(mockPayload);

    await middleware.use(mockRequest, mockResponse, mockNext);

    expect(mockRequest.user).toEqual(mockPayload);
    expect(mockNext).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
  });

  test('should return 401 for missing authorization header', async () => {
    await middleware.use(mockRequest, mockResponse, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'No authorization header provided'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('should return 401 for invalid token format', async () => {
    mockRequest.headers.authorization = 'InvalidFormat token';
    mockTokenService.extractTokenFromHeader.mockReturnValue(null);

    await middleware.use(mockRequest, mockResponse, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Authorization header must be "Bearer <token>"'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('should return 503 when identity-service unavailable', async () => {
    mockRequest.headers.authorization = 'Bearer test-token';
    mockTokenService.extractTokenFromHeader.mockReturnValue('test-token');
    mockTokenService.validateToken.mockRejectedValue(
      new Error('Identity service unavailable')
    );

    await middleware.use(mockRequest, mockResponse, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(503);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Service Unavailable',
      message: 'Authentication service is currently unavailable'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('should return 401 for invalid token', async () => {
    mockRequest.headers.authorization = 'Bearer invalid-token';
    mockTokenService.extractTokenFromHeader.mockReturnValue('invalid-token');
    mockTokenService.validateToken.mockRejectedValue(
      new Error('Invalid or expired token')
    );

    await middleware.use(mockRequest, mockResponse, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('should return 401 for expired token', async () => {
    mockRequest.headers.authorization = 'Bearer expired-token';
    mockTokenService.extractTokenFromHeader.mockReturnValue('expired-token');
    mockTokenService.validateToken.mockRejectedValue(
      new Error('Token expired')
    );

    await middleware.use(mockRequest, mockResponse, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Token expired'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('should return 401 for malformed token', async () => {
    mockRequest.headers.authorization = 'Bearer malformed-token';
    mockTokenService.extractTokenFromHeader.mockReturnValue('malformed-token');
    mockTokenService.validateToken.mockRejectedValue(
      new Error('Malformed token')
    );

    await middleware.use(mockRequest, mockResponse, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Malformed token'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('should return 401 for generic authentication error', async () => {
    mockRequest.headers.authorization = 'Bearer test-token';
    mockTokenService.extractTokenFromHeader.mockReturnValue('test-token');
    mockTokenService.validateToken.mockRejectedValue(
      new Error('Some other error')
    );

    await middleware.use(mockRequest, mockResponse, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Authentication failed'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('should handle request without next function', async () => {
    const mockPayload: TokenPayload = {
      sub: 'test-client',
      jti: 'test-jti',
      applicationName: 'TestApp',
      financialId: 'FIN-001',
      channelId: 'CH-001',
      allowedTools: ['weather'],
      allowedApis: [],
      isDeveloperPortalAPIsEnabled: false,
      iat: 1234567890,
      exp: 1234567900,
      type: 'access'
    };

    mockRequest.headers.authorization = 'Bearer test-token';
    mockTokenService.extractTokenFromHeader.mockReturnValue('test-token');
    mockTokenService.validateToken.mockResolvedValue(mockPayload);

    // Call without next function
    await middleware.use(mockRequest, mockResponse);

    expect(mockRequest.user).toEqual(mockPayload);
    expect(mockResponse.status).not.toHaveBeenCalled();
  });
});
