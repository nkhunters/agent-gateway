# PRP 03: Identity Service Integration

## Goal

Integrate with the Identity Service for token validation via API calls, implementing a fail-closed security model. No JWT secrets will be stored in the agent-gateway; all validation happens through the Identity Service's `/oauth/verify` endpoint.

## Why

- **Security**: JWT secrets remain in identity-service only (single source of truth)
- **Centralized Logic**: Token validation logic stays in one place
- **Simpler Updates**: Changes to validation don't require agent-gateway updates
- **Fail-Closed**: If identity-service is unavailable, reject requests immediately (most secure)
- **No Caching**: Always validate with identity-service (prevents stale/revoked tokens)

## What

### Deliverables
1. ✅ HTTP client utility configured for identity-service
2. ✅ TokenValidationService (calls POST /oauth/verify)
3. ✅ AuthMiddleware for routing-controllers
4. ✅ Error handling (401, 503, timeouts)
5. ✅ Unit tests with mocked API responses

### Success Criteria
- [ ] Can call identity-service `/oauth/verify` endpoint
- [ ] Returns TokenPayload on success
- [ ] Throws appropriate errors on failure (401, 503)
- [ ] Handles network timeouts gracefully
- [ ] AuthMiddleware integrates with routing-controllers
- [ ] Unit tests pass with 80%+ coverage
- [ ] No JWT secrets in codebase

## Context & References

### Identity Service API
- **Endpoint**: POST `/oauth/verify`
- **Reference**: `/Users/avinashkumar/Desktop/identity-service/src/controllers/OAuthController.ts:84-156`
- **Request**: `{ "token": "jwt-string" }`
- **Success Response**: `{ "valid": true, "payload": { allowedTools: [...], ... } }`
- **Error Response**: `{ "valid": false, "error": "...", "message": "..." }`

### Auth Middleware Pattern
- **Reference**: `/Users/avinashkumar/Desktop/identity-service/src/middlewares/AuthMiddleware.ts:1-122`
- Pattern: Extract token, validate, attach to request

### Documentation
- Axios: https://axios-http.com/docs/intro
- routing-controllers Middleware: https://github.com/typestack/routing-controllers#using-middlewares

## Implementation Tasks

### Task 1: Create HTTP Client Utility

**File**: `src/utils/httpClient.ts`

**Purpose**: Configured axios instance for calling identity-service

```typescript
import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from './logger';
import { env } from '../config/env';

/**
 * Axios instance configured for Identity Service API calls
 *
 * Features:
 * - Base URL from environment
 * - 5-second timeout (fail-fast)
 * - Request/response logging
 * - Error transformation
 */
export const identityServiceClient: AxiosInstance = axios.create({
  baseURL: env.IDENTITY_SERVICE_URL,
  timeout: 5000, // 5 seconds - fail fast
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

/**
 * Request interceptor: Log outgoing requests
 */
identityServiceClient.interceptors.request.use(
  (config) => {
    logger.debug(
      {
        method: config.method,
        url: config.url,
        baseURL: config.baseURL
      },
      'Outgoing request to identity-service'
    );
    return config;
  },
  (error) => {
    logger.error({ error }, 'Request interceptor error');
    return Promise.reject(error);
  }
);

/**
 * Response interceptor: Log responses and transform errors
 */
identityServiceClient.interceptors.response.use(
  (response) => {
    logger.debug(
      {
        status: response.status,
        url: response.config.url
      },
      'Response from identity-service'
    );
    return response;
  },
  (error: AxiosError) => {
    if (error.code === 'ECONNREFUSED') {
      logger.error(
        {
          url: error.config?.url,
          baseURL: error.config?.baseURL
        },
        'Identity service connection refused'
      );
      return Promise.reject(
        new Error('Identity service unavailable (connection refused)')
      );
    }

    if (error.code === 'ETIMEDOUT') {
      logger.error(
        {
          url: error.config?.url,
          timeout: error.config?.timeout
        },
        'Identity service request timeout'
      );
      return Promise.reject(
        new Error('Identity service unavailable (timeout)')
      );
    }

    if (error.response) {
      // Server responded with error status
      logger.warn(
        {
          status: error.response.status,
          data: error.response.data,
          url: error.config?.url
        },
        'Identity service error response'
      );
    }

    return Promise.reject(error);
  }
);

/**
 * Helper to check if error is axios error
 */
export function isAxiosError(error: any): error is AxiosError {
  return error.isAxiosError === true;
}
```

**Key Features**:
- ✅ 5-second timeout (fail-fast)
- ✅ Automatic base URL from environment
- ✅ Request/response logging
- ✅ Error transformation for connection failures
- ✅ TypeScript error type guards

---

### Task 2: Create TokenValidationService

**File**: `src/services/TokenValidationService.ts`

**Purpose**: Validate JWT tokens via identity-service API

```typescript
import { Service } from 'typedi';
import { TokenPayload } from '../types/TokenPayload';
import { IdentityServiceVerifyResponse } from '../types/IdentityServiceResponse';
import { identityServiceClient, isAxiosError } from '../utils/httpClient';
import { logger } from '../utils/logger';

/**
 * Token Validation Service
 *
 * Validates JWT tokens by calling Identity Service API
 * NO JWT secrets stored locally - all validation via API
 */
@Service()
export class TokenValidationService {
  /**
   * Validate JWT token via Identity Service /oauth/verify endpoint
   *
   * @param token - JWT token string
   * @returns TokenPayload if valid
   * @throws Error if token invalid or identity-service unavailable
   */
  async validateToken(token: string): Promise<TokenPayload> {
    try {
      logger.debug('Validating token with identity-service');

      // Call POST /oauth/verify
      const response = await identityServiceClient.post<IdentityServiceVerifyResponse>(
        '/oauth/verify',
        { token }
      );

      const data = response.data;

      // Check if valid
      if (!data.valid || !data.payload) {
        logger.warn(
          {
            error: data.error,
            message: data.message
          },
          'Token validation failed'
        );

        // Return specific error message
        throw new Error(data.error || 'Token validation failed');
      }

      // Convert response payload to TokenPayload
      const payload: TokenPayload = {
        sub: data.payload.clientId,
        jti: data.payload.jti,
        applicationName: data.payload.applicationName,
        financialId: data.payload.financialId,
        channelId: data.payload.channelId,
        allowedTools: data.payload.allowedTools,
        allowedApis: data.payload.allowedApis,
        isDeveloperPortalAPIsEnabled: data.payload.isDeveloperPortalAPIsEnabled,
        threeScaleClientId: data.payload.threeScaleClientId,
        iat: new Date(data.payload.issuedAt).getTime() / 1000,
        exp: new Date(data.payload.expiresAt).getTime() / 1000,
        type: 'access' // Assuming access tokens only for agent-gateway
      };

      logger.info(
        {
          clientId: payload.sub,
          allowedToolsCount: payload.allowedTools.length
        },
        'Token validated successfully'
      );

      return payload;

    } catch (error: any) {
      // Handle network/connection errors (fail-closed)
      if (
        error.message.includes('unavailable') ||
        error.message.includes('timeout') ||
        error.message.includes('connection refused')
      ) {
        logger.error(
          { error: error.message },
          'Identity service unavailable - failing closed'
        );
        throw new Error('Identity service unavailable');
      }

      // Handle axios errors
      if (isAxiosError(error)) {
        if (error.response) {
          // Server responded with error
          const status = error.response.status;

          if (status === 401) {
            logger.warn('Token validation failed: Unauthorized');
            throw new Error('Invalid or expired token');
          }

          if (status === 400) {
            logger.warn('Token validation failed: Bad request');
            throw new Error('Malformed token');
          }

          // Other server errors
          logger.error(
            { status, data: error.response.data },
            'Identity service error'
          );
          throw new Error('Identity service error');
        }
      }

      // Re-throw other errors
      logger.error({ error: error.message }, 'Token validation failed');
      throw error;
    }
  }

  /**
   * Extract token from Authorization header
   *
   * @param authHeader - Authorization header value
   * @returns Token string or null
   */
  extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null;
    }

    // Check Bearer format
    if (!authHeader.startsWith('Bearer ')) {
      return null;
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer '

    if (!token || token.trim() === '') {
      return null;
    }

    return token;
  }
}
```

**Key Features**:
- ✅ Calls POST /oauth/verify on identity-service
- ✅ Converts response to TokenPayload format
- ✅ Fail-closed: throws if identity-service unavailable
- ✅ Specific error messages for different failure modes
- ✅ Helper method to extract token from header
- ✅ Comprehensive logging

---

### Task 3: Create AuthMiddleware for routing-controllers

**File**: `src/middlewares/AuthMiddleware.ts`

**Pattern**: Mirror identity-service AuthMiddleware
**Reference**: `/Users/avinashkumar/Desktop/identity-service/src/middlewares/AuthMiddleware.ts:1-122`

```typescript
import { Request, Response, NextFunction } from 'express';
import { MiddlewareInterface } from 'routing-controllers';
import { Service } from 'typedi';
import { TokenValidationService } from '../services/TokenValidationService';
import { TokenPayload } from '../types/TokenPayload';
import { logger } from '../utils/logger';

/**
 * Extend Express Request to include user payload
 */
export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

/**
 * Authentication Middleware
 *
 * Validates JWT tokens via Identity Service API
 * Attaches decoded payload to request.user for downstream use
 *
 * Returns 401 for:
 * - Missing authorization header
 * - Invalid Bearer token format
 * - Invalid/expired token
 *
 * Returns 503 for:
 * - Identity service unavailable
 */
@Service()
export class AuthMiddleware implements MiddlewareInterface {
  constructor(private tokenValidationService: TokenValidationService) {}

  async use(req: any, res: any, next?: (err?: any) => any): Promise<any> {
    try {
      // Extract Authorization header
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        logger.warn({ path: req.path }, 'No authorization header provided');
        res.status(401).json({
          error: 'Unauthorized',
          message: 'No authorization header provided'
        });
        return;
      }

      // Extract token from header
      const token = this.tokenValidationService.extractTokenFromHeader(authHeader);

      if (!token) {
        logger.warn({ path: req.path }, 'Invalid authorization format');
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authorization header must be "Bearer <token>"'
        });
        return;
      }

      // Validate token via identity-service API
      const payload = await this.tokenValidationService.validateToken(token);

      // Attach payload to request
      (req as AuthenticatedRequest).user = payload;

      logger.debug(
        {
          clientId: payload.sub,
          path: req.path
        },
        'Request authenticated'
      );

      if (next) next();

    } catch (error: any) {
      logger.warn(
        {
          path: req.path,
          error: error.message
        },
        'Authentication failed'
      );

      // Handle identity service unavailable (fail-closed with 503)
      if (error.message.includes('Identity service unavailable')) {
        res.status(503).json({
          error: 'Service Unavailable',
          message: 'Authentication service is currently unavailable'
        });
        return;
      }

      // Handle invalid/expired tokens (401)
      if (
        error.message.includes('Invalid') ||
        error.message.includes('expired') ||
        error.message.includes('Malformed')
      ) {
        res.status(401).json({
          error: 'Unauthorized',
          message: error.message
        });
        return;
      }

      // Generic authentication error (401)
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication failed'
      });
    }
  }
}
```

**Key Features**:
- ✅ Integrates with routing-controllers middleware system
- ✅ Uses TokenValidationService (calls identity-service API)
- ✅ Extends Request type to include `user` property
- ✅ Returns 401 for invalid tokens
- ✅ Returns 503 for identity-service unavailable (fail-closed)
- ✅ Comprehensive logging
- ✅ TypeDI service injection

---

### Task 4: Update Types for AuthenticatedRequest

**File**: `src/types/AuthenticatedRequest.ts`

```typescript
import { Request } from 'express';
import { TokenPayload } from './TokenPayload';

/**
 * Express Request with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}
```

Update `src/types/index.ts`:
```typescript
export * from './TokenPayload';
export * from './IdentityServiceResponse';
export * from './MCPToolDefinition';
export * from './AuthenticatedRequest'; // ← Add this
```

---

### Task 5: Create Unit Tests

**File**: `tests/unit/TokenValidationService.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenValidationService } from '../../src/services/TokenValidationService';
import { identityServiceClient } from '../../src/utils/httpClient';

// Mock axios client
vi.mock('../../src/utils/httpClient', () => ({
  identityServiceClient: {
    post: vi.fn()
  },
  isAxiosError: vi.fn()
}));

describe('TokenValidationService', () => {
  let service: TokenValidationService;

  beforeEach(() => {
    service = new TokenValidationService();
    vi.clearAllMocks();
  });

  describe('validateToken', () => {
    it('should validate token and return payload', async () => {
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

      vi.mocked(identityServiceClient.post).mockResolvedValue(mockResponse);

      const result = await service.validateToken('test-token');

      expect(result.sub).toBe('test-client');
      expect(result.allowedTools).toEqual(['weather', 'calculator']);
      expect(identityServiceClient.post).toHaveBeenCalledWith(
        '/oauth/verify',
        { token: 'test-token' }
      );
    });

    it('should throw error for invalid token', async () => {
      // Mock invalid token response
      const mockResponse = {
        data: {
          valid: false,
          error: 'Token expired'
        }
      };

      vi.mocked(identityServiceClient.post).mockResolvedValue(mockResponse);

      await expect(service.validateToken('invalid-token')).rejects.toThrow(
        'Token expired'
      );
    });

    it('should throw error when identity-service unavailable', async () => {
      // Mock connection error
      vi.mocked(identityServiceClient.post).mockRejectedValue(
        new Error('Identity service unavailable (connection refused)')
      );

      await expect(service.validateToken('test-token')).rejects.toThrow(
        'Identity service unavailable'
      );
    });

    it('should throw error on timeout', async () => {
      vi.mocked(identityServiceClient.post).mockRejectedValue(
        new Error('Identity service unavailable (timeout)')
      );

      await expect(service.validateToken('test-token')).rejects.toThrow(
        'Identity service unavailable'
      );
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      const token = service.extractTokenFromHeader('Bearer test-token-123');

      expect(token).toBe('test-token-123');
    });

    it('should return null for missing header', () => {
      const token = service.extractTokenFromHeader(undefined);

      expect(token).toBeNull();
    });

    it('should return null for invalid format', () => {
      const token = service.extractTokenFromHeader('InvalidFormat token');

      expect(token).toBeNull();
    });

    it('should return null for empty token', () => {
      const token = service.extractTokenFromHeader('Bearer ');

      expect(token).toBeNull();
    });
  });
});
```

---

**File**: `tests/unit/AuthMiddleware.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthMiddleware } from '../../src/middlewares/AuthMiddleware';
import { TokenValidationService } from '../../src/services/TokenValidationService';
import { TokenPayload } from '../../src/types/TokenPayload';

describe('AuthMiddleware', () => {
  let middleware: AuthMiddleware;
  let mockTokenService: TokenValidationService;
  let mockRequest: any;
  let mockResponse: any;
  let mockNext: any;

  beforeEach(() => {
    mockTokenService = {
      validateToken: vi.fn(),
      extractTokenFromHeader: vi.fn()
    } as any;

    middleware = new AuthMiddleware(mockTokenService);

    mockRequest = {
      headers: {},
      path: '/test'
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    mockNext = vi.fn();
  });

  it('should authenticate valid token', async () => {
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

    vi.mocked(mockTokenService.extractTokenFromHeader).mockReturnValue('test-token');
    vi.mocked(mockTokenService.validateToken).mockResolvedValue(mockPayload);

    await middleware.use(mockRequest, mockResponse, mockNext);

    expect(mockRequest.user).toEqual(mockPayload);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should return 401 for missing authorization header', async () => {
    await middleware.use(mockRequest, mockResponse, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'No authorization header provided'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 for invalid token format', async () => {
    mockRequest.headers.authorization = 'InvalidFormat token';
    vi.mocked(mockTokenService.extractTokenFromHeader).mockReturnValue(null);

    await middleware.use(mockRequest, mockResponse, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
  });

  it('should return 503 when identity-service unavailable', async () => {
    mockRequest.headers.authorization = 'Bearer test-token';
    vi.mocked(mockTokenService.extractTokenFromHeader).mockReturnValue('test-token');
    vi.mocked(mockTokenService.validateToken).mockRejectedValue(
      new Error('Identity service unavailable')
    );

    await middleware.use(mockRequest, mockResponse, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(503);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Service Unavailable',
      message: 'Authentication service is currently unavailable'
    });
  });

  it('should return 401 for invalid token', async () => {
    mockRequest.headers.authorization = 'Bearer invalid-token';
    vi.mocked(mockTokenService.extractTokenFromHeader).mockReturnValue('invalid-token');
    vi.mocked(mockTokenService.validateToken).mockRejectedValue(
      new Error('Invalid or expired token')
    );

    await middleware.use(mockRequest, mockResponse, mockNext);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
  });
});
```

---

## Validation

### Level 1: Unit Tests
```bash
npm test tests/unit/TokenValidationService.test.ts
npm test tests/unit/AuthMiddleware.test.ts
```
**Expected**: All tests pass

### Level 2: Integration Test with Identity Service

**Prerequisites**: Identity service must be running at `IDENTITY_SERVICE_URL`

Create a test script: `tests/integration/identity-service.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { TokenValidationService } from '../../src/services/TokenValidationService';

describe('Identity Service Integration', () => {
  let service: TokenValidationService;
  let validToken: string;

  beforeAll(async () => {
    service = new TokenValidationService();

    // TODO: Get valid token from identity-service
    // For now, this is a manual test - run identity-service and generate token
    validToken = process.env.TEST_TOKEN || 'replace-with-real-token';
  });

  it('should validate real token from identity-service', async () => {
    if (validToken === 'replace-with-real-token') {
      console.log('Skipping integration test - no valid token provided');
      return;
    }

    const payload = await service.validateToken(validToken);

    expect(payload.sub).toBeDefined();
    expect(payload.allowedTools).toBeInstanceOf(Array);
  }, 10000); // 10 second timeout
});
```

Run:
```bash
# Start identity-service first
cd /Users/avinashkumar/Desktop/identity-service
npm run dev

# Get a token, then test
cd /Users/avinashkumar/Desktop/agent-gateway
TEST_TOKEN="your-token-here" npm test tests/integration/identity-service.test.ts
```

---

## Known Gotchas

### 1. No JWT Secrets
⚠️ **CRITICAL**: Do NOT add `JWT_ACCESS_SECRET` to environment
- All validation happens via identity-service API
- No local JWT verification
- Fail-closed if identity-service unavailable

### 2. HTTP Client Timeout
- Default: 5 seconds
- Adjust in `src/utils/httpClient.ts` if needed
- Balance between responsiveness and reliability

### 3. Fail-Closed Security Model
- Returns 503 if identity-service unavailable
- Does not cache validation results
- Every request calls identity-service API

### 4. Error Handling
- 401: Token invalid/expired (client error)
- 503: Identity service unavailable (service error)
- Different status codes for different failure modes

### 5. Request Context
- AuthMiddleware attaches `user` to request
- Use `AuthenticatedRequest` type in controllers
- Access with `req.user` or `@CurrentUser()` decorator

---

## Next Steps

After completing this PRP:
1. ✅ HTTP client configured for identity-service
2. ✅ TokenValidationService calls /oauth/verify
3. ✅ AuthMiddleware integrates with routing-controllers
4. ✅ Fail-closed security model implemented
5. ✅ Unit tests passing

**Proceed to**: [PRP 04: MCP Client Management](./04-mcp-client-management.md)

---

## Checklist

- [ ] HTTP client utility created with timeout/logging
- [ ] TokenValidationService calls identity-service API
- [ ] AuthMiddleware created for routing-controllers
- [ ] Returns 401 for invalid tokens
- [ ] Returns 503 for identity-service unavailable
- [ ] Unit tests pass with 80%+ coverage
- [ ] No JWT secrets in codebase
- [ ] Integration test works with real identity-service
- [ ] Error messages are clear and specific
- [ ] Logging comprehensive for debugging

---

**Status**: 🟢 Ready for Implementation
**Estimated Time**: 1 day
**Dependencies**: PRP 01
**Next PRP**: 04 - MCP Client Management
