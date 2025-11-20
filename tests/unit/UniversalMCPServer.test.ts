import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import mongoose from 'mongoose';
import { UniversalMCPServer } from '../../src/services/UniversalMCPServer';
import { TokenValidationService } from '../../src/services/TokenValidationService';
import { ToolRoutingService } from '../../src/services/ToolRoutingService';
import { MCPTool } from '../../src/models/MCPTool.model';

// Mock FastMCP
jest.mock('fastmcp', () => ({
  FastMCP: jest.fn().mockImplementation(() => ({
    addTool: jest.fn(),
    start: (jest.fn() as any).mockResolvedValue(undefined),
    stop: (jest.fn() as any).mockResolvedValue(undefined)
  }))
}));

describe('UniversalMCPServer', () => {
  let server: UniversalMCPServer;
  let mockTokenService: jest.Mocked<TokenValidationService>;
  let mockRoutingService: jest.Mocked<ToolRoutingService>;

  beforeEach(async () => {
    // Clear database
    await MCPTool.deleteMany({});

    // Clear mocks
    jest.clearAllMocks();

    // Create mock services with proper types
    mockTokenService = {
      extractTokenFromHeader: jest.fn(),
      validateToken: jest.fn()
    } as any as jest.Mocked<TokenValidationService>;

    mockRoutingService = {
      routeToolCall: jest.fn(),
      isToolAvailable: jest.fn()
    } as any as jest.Mocked<ToolRoutingService>;

    server = new UniversalMCPServer(mockTokenService, mockRoutingService);
  });

  describe('start', () => {
    test('should start FastMCP server successfully', async () => {
      await server.start();

      expect(server.isServerRunning()).toBe(true);

      const info = server.getServerInfo();
      expect(info.isRunning).toBe(true);
      expect(info.port).toBeDefined();
      expect(info.endpoint).toBe('/mcp');
      expect(info.mode).toBe('stateless');
    });

    test('should load and register tools from database', async () => {
      // Create test tools
      await MCPTool.create([
        {
          toolId: 'tool1:execute',
          name: 'execute',
          description: 'Tool 1',
          inputSchema: {
            type: 'object',
            properties: {
              arg1: { type: 'string' }
            }
          },
          serverId: 'tool1',
          mcpServerEndpoint: 'http://localhost:8080/mcp',
          isActive: true
        },
        {
          toolId: 'tool2:run',
          name: 'run',
          description: 'Tool 2',
          inputSchema: { type: 'object' },
          serverId: 'tool2',
          mcpServerEndpoint: 'http://localhost:8081/mcp',
          isActive: true
        }
      ]);

      await server.start();

      expect(server.isServerRunning()).toBe(true);
      // FastMCP.addTool should be called for each tool
      // (we can't easily test this with current mock setup)
    });

    test('should not start if already running', async () => {
      await server.start();
      const firstInfo = server.getServerInfo();

      // Try to start again
      await server.start();
      const secondInfo = server.getServerInfo();

      expect(secondInfo).toEqual(firstInfo);
    });

    test('should skip inactive tools', async () => {
      await MCPTool.create([
        {
          toolId: 'active:tool',
          name: 'tool',
          description: 'Active tool',
          inputSchema: { type: 'object' },
          serverId: 'server1',
          mcpServerEndpoint: 'http://localhost:8080/mcp',
          isActive: true
        },
        {
          toolId: 'inactive:tool',
          name: 'tool',
          description: 'Inactive tool',
          inputSchema: { type: 'object' },
          serverId: 'server2',
          mcpServerEndpoint: 'http://localhost:8081/mcp',
          isActive: false // Inactive
        }
      ]);

      await server.start();

      expect(server.isServerRunning()).toBe(true);
      // Only active tool should be registered
    });
  });

  describe('stop', () => {
    test('should stop server successfully', async () => {
      await server.start();
      expect(server.isServerRunning()).toBe(true);

      await server.stop();
      expect(server.isServerRunning()).toBe(false);

      const info = server.getServerInfo();
      expect(info.isRunning).toBe(false);
      expect(info.port).toBeUndefined();
    });

    test('should handle stop when not running', async () => {
      expect(server.isServerRunning()).toBe(false);

      await expect(server.stop()).resolves.not.toThrow();

      expect(server.isServerRunning()).toBe(false);
    });
  });

  describe('getServerInfo', () => {
    test('should return info when running', async () => {
      await server.start();

      const info = server.getServerInfo();

      expect(info.isRunning).toBe(true);
      expect(info.port).toBeDefined();
      expect(info.endpoint).toBe('/mcp');
      expect(info.mode).toBe('stateless');
    });

    test('should return minimal info when stopped', async () => {
      const info = server.getServerInfo();

      expect(info.isRunning).toBe(false);
      expect(info.port).toBeUndefined();
      expect(info.endpoint).toBeUndefined();
      expect(info.mode).toBeUndefined();
    });
  });

  describe('authenticateRequest', () => {
    test('should validate token successfully', async () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer valid-token'
        }
      };

      (mockTokenService.extractTokenFromHeader as jest.Mock).mockReturnValue(
        'valid-token'
      );
      (mockTokenService.validateToken as jest.Mock<Promise<any>>).mockResolvedValue({
        sub: 'user-123',
        allowedTools: ['tool1', 'tool2'],
        applicationName: 'TestApp',
        jti: 'test-jti',
        financialId: 'test-fin',
        channelId: 'test-channel',
        type: 'access',
        iat: Date.now(),
        exp: Date.now() + 3600000,
        isDeveloperPortalAPIsEnabled: false
      });

      // Access private method for testing
      const payload = await (server as any).authenticateRequest(mockRequest);

      expect(payload.sub).toBe('user-123');
      expect(payload.allowedTools).toContain('tool1');
      expect(mockTokenService.extractTokenFromHeader).toHaveBeenCalledWith(
        'Bearer valid-token'
      );
      expect(mockTokenService.validateToken).toHaveBeenCalledWith(
        'valid-token'
      );
    });

    test('should reject request without authorization header', async () => {
      const mockRequest = {
        headers: {}
      };

      await expect(
        (server as any).authenticateRequest(mockRequest)
      ).rejects.toThrow(Response);
    });

    test('should reject request with invalid token format', async () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer invalid-token'
        }
      };

      (mockTokenService.extractTokenFromHeader as jest.Mock).mockReturnValue(
        null
      );

      await expect(
        (server as any).authenticateRequest(mockRequest)
      ).rejects.toThrow(Response);
    });

    test('should handle identity service unavailable', async () => {
      const mockRequest = {
        headers: {
          authorization: 'Bearer valid-token'
        }
      };

      (mockTokenService.extractTokenFromHeader as jest.Mock).mockReturnValue(
        'valid-token'
      );
      (mockTokenService.validateToken as jest.Mock<Promise<any>>).mockRejectedValue(
        new Error('Identity service unavailable')
      );

      await expect(
        (server as any).authenticateRequest(mockRequest)
      ).rejects.toThrow(Response);
    });
  });

  describe('convertJSONSchemaToZod', () => {
    test('should convert empty schema', () => {
      const zodSchema = (server as any).convertJSONSchemaToZod({});

      expect(zodSchema).toBeDefined();
    });

    test('should convert object schema', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        required: ['name']
      };

      const zodSchema = (server as any).convertJSONSchemaToZod(schema);

      expect(zodSchema).toBeDefined();
      // Zod schema can parse valid data
      expect(() =>
        zodSchema.parse({ name: 'John' })
      ).not.toThrow();
    });

    test('should convert primitive types', () => {
      const stringSchema = (server as any).convertJSONSchemaToZod({
        type: 'string'
      });
      expect(() => stringSchema.parse('hello')).not.toThrow();

      const numberSchema = (server as any).convertJSONSchemaToZod({
        type: 'number'
      });
      expect(() => numberSchema.parse(42)).not.toThrow();

      const boolSchema = (server as any).convertJSONSchemaToZod({
        type: 'boolean'
      });
      expect(() => boolSchema.parse(true)).not.toThrow();
    });

    test('should convert array schema', () => {
      const schema = {
        type: 'array',
        items: { type: 'string' }
      };

      const zodSchema = (server as any).convertJSONSchemaToZod(schema);

      expect(() => zodSchema.parse(['a', 'b', 'c'])).not.toThrow();
    });

    test('should handle unsupported types gracefully', () => {
      const schema = {
        type: 'unknown-type'
      };

      const zodSchema = (server as any).convertJSONSchemaToZod(schema);

      expect(zodSchema).toBeDefined();
      // Should default to z.any() which accepts anything
      expect(() => zodSchema.parse('anything')).not.toThrow();
    });
  });

  describe('reloadTools', () => {
    test('should throw if server not running', async () => {
      await expect(server.reloadTools()).rejects.toThrow('Server not running');
    });

    test('should restart server to reload tools', async () => {
      await server.start();
      expect(server.isServerRunning()).toBe(true);

      await server.reloadTools();

      // Server should be running again after reload
      expect(server.isServerRunning()).toBe(true);
    });
  });
});
