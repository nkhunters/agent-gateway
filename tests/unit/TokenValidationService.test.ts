import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { TokenValidationService } from '../../src/services/TokenValidationService';
import { identityServiceClient } from '../../src/utils/httpClient';
import { AxiosError } from 'axios';

// Mock axios client
jest.mock('../../src/utils/httpClient', () => ({
  identityServiceClient: {
    post: jest.fn()
  },
  isAxiosError: jest.fn()
}));

// Mock logger to avoid console output during tests
jest.mock('../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('TokenValidationService', () => {
  let service: TokenValidationService;

  beforeEach(() => {
    service = new TokenValidationService();
    jest.clearAllMocks();
  });

  describe('validateToken', () => {
    test('should validate token and return payload', async () => {
      // Mock successful response
      const mockResponse = {
        data: {
          valid: true,
          payload: {
            clientId: 'test-client',
            jti: 'test-jti',
            applicationName: 'TestApp',
            financialId: 'FIN-001',
            channelId: 'CH-001',
            allowedTools: ['weather', 'calculator'],
            allowedApis: ['/api/users'],
            isDeveloperPortalAPIsEnabled: false,
            issuedAt: '2025-11-19T10:00:00Z',
            expiresAt: '2025-11-19T10:15:00Z'
          }
        }
      };

      (identityServiceClient.post as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

      const result = await service.validateToken('test-token');

      expect(result.sub).toBe('test-client');
      expect(result.allowedTools).toEqual(['weather', 'calculator']);
      expect(identityServiceClient.post).toHaveBeenCalledWith(
        '/oauth/verify',
        { token: 'test-token' }
      );
    });

    test('should throw error for invalid token', async () => {
      // Mock invalid token response
      const mockResponse = {
        data: {
          valid: false,
          error: 'Token expired'
        }
      };

      (identityServiceClient.post as jest.MockedFunction<any>).mockResolvedValue(mockResponse);

      await expect(service.validateToken('invalid-token')).rejects.toThrow(
        'Token expired'
      );
    });

    test('should throw error when identity-service unavailable (connection refused)', async () => {
      // Mock connection error
      (identityServiceClient.post as jest.MockedFunction<any>).mockRejectedValue(
        new Error('Identity service unavailable (connection refused)')
      );

      await expect(service.validateToken('test-token')).rejects.toThrow(
        'Identity service unavailable'
      );
    });

    test('should throw error on timeout', async () => {
      (identityServiceClient.post as jest.MockedFunction<any>).mockRejectedValue(
        new Error('Identity service unavailable (timeout)')
      );

      await expect(service.validateToken('test-token')).rejects.toThrow(
        'Identity service unavailable'
      );
    });

    test('should handle 401 unauthorized response', async () => {
      const { isAxiosError } = require('../../src/utils/httpClient');

      const axiosError = {
        isAxiosError: true,
        message: 'Request failed with status code 401',
        response: {
          status: 401,
          data: { error: 'Unauthorized' }
        }
      } as AxiosError;

      (identityServiceClient.post as jest.MockedFunction<any>).mockRejectedValue(axiosError);
      (isAxiosError as jest.MockedFunction<any>).mockReturnValue(true);

      await expect(service.validateToken('test-token')).rejects.toThrow(
        'Invalid or expired token'
      );
    });

    test('should handle 400 bad request response', async () => {
      const { isAxiosError } = require('../../src/utils/httpClient');

      const axiosError = {
        isAxiosError: true,
        message: 'Request failed with status code 400',
        response: {
          status: 400,
          data: { error: 'Bad request' }
        }
      } as AxiosError;

      (identityServiceClient.post as jest.MockedFunction<any>).mockRejectedValue(axiosError);
      (isAxiosError as jest.MockedFunction<any>).mockReturnValue(true);

      await expect(service.validateToken('test-token')).rejects.toThrow(
        'Malformed token'
      );
    });

    test('should handle other server errors', async () => {
      const { isAxiosError } = require('../../src/utils/httpClient');

      const axiosError = {
        isAxiosError: true,
        message: 'Request failed with status code 500',
        response: {
          status: 500,
          data: { error: 'Internal server error' }
        }
      } as AxiosError;

      (identityServiceClient.post as jest.MockedFunction<any>).mockRejectedValue(axiosError);
      (isAxiosError as jest.MockedFunction<any>).mockReturnValue(true);

      await expect(service.validateToken('test-token')).rejects.toThrow(
        'Identity service error'
      );
    });
  });

  describe('extractTokenFromHeader', () => {
    test('should extract token from valid Bearer header', () => {
      const token = service.extractTokenFromHeader('Bearer test-token-123');

      expect(token).toBe('test-token-123');
    });

    test('should return null for missing header', () => {
      const token = service.extractTokenFromHeader(undefined);

      expect(token).toBeNull();
    });

    test('should return null for invalid format', () => {
      const token = service.extractTokenFromHeader('InvalidFormat token');

      expect(token).toBeNull();
    });

    test('should return null for empty token', () => {
      const token = service.extractTokenFromHeader('Bearer ');

      expect(token).toBeNull();
    });

    test('should return null for whitespace-only token', () => {
      const token = service.extractTokenFromHeader('Bearer   ');

      expect(token).toBeNull();
    });
  });
});
