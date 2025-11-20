import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import mongoose from 'mongoose';
import { ToolRoutingService } from '../../src/services/ToolRoutingService';
import { MCPClientManager } from '../../src/services/MCPClientManager';
import { MCPTool } from '../../src/models/MCPTool.model';

describe('ToolRoutingService', () => {
  let service: ToolRoutingService;
  let mockClientManager: jest.Mocked<MCPClientManager>;

  beforeEach(async () => {
    // Clear database
    await MCPTool.deleteMany({});

    // Create mock MCP client manager with proper types
    mockClientManager = {
      isConnected: jest.fn(),
      callTool: jest.fn()
    } as any as jest.Mocked<MCPClientManager>;

    service = new ToolRoutingService(mockClientManager);
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  describe('routeToolCall', () => {
    test('should route tool call to backend server successfully', async () => {
      // Create test tool
      await MCPTool.create({
        toolId: 'weather-mcp:get_current',
        name: 'get_current',
        description: 'Get current weather',
        inputSchema: { type: 'object', properties: {} },
        serverId: 'weather-mcp',
        mcpServerEndpoint: 'http://localhost:8080/mcp',
        isActive: true
      });

      // Mock connected server
      (mockClientManager.isConnected as jest.Mock).mockReturnValue(true);

      // Mock tool execution
      (mockClientManager.callTool as jest.Mock<Promise<any>>).mockResolvedValue({
        content: [{ type: 'text', text: 'Weather: 72°F, Sunny' }]
      });

      const result = await service.routeToolCall('weather-mcp:get_current', {
        location: 'New York'
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('72°F');
      expect(result.isError).toBeUndefined();
      expect(mockClientManager.callTool).toHaveBeenCalledWith(
        'weather-mcp',
        'get_current',
        { location: 'New York' }
      );
    });

    test('should handle tool not found error', async () => {
      const result = await service.routeToolCall('non-existent-tool', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
      expect(mockClientManager.callTool).not.toHaveBeenCalled();
    });

    test('should handle disconnected backend server', async () => {
      await MCPTool.create({
        toolId: 'weather-mcp:get_current',
        name: 'get_current',
        description: 'Test tool',
        inputSchema: { type: 'object' },
        serverId: 'weather-mcp',
        mcpServerEndpoint: 'http://localhost:8080/mcp',
        isActive: true
      });

      // Mock disconnected server
      (mockClientManager.isConnected as jest.Mock).mockReturnValue(false);

      const result = await service.routeToolCall('weather-mcp:get_current', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not available');
      expect(mockClientManager.callTool).not.toHaveBeenCalled();
    });

    test('should handle execution timeout', async () => {
      await MCPTool.create({
        toolId: 'slow-tool:execute',
        name: 'execute',
        description: 'Slow tool',
        inputSchema: { type: 'object' },
        serverId: 'slow-tool',
        mcpServerEndpoint: 'http://localhost:8080/mcp',
        isActive: true
      });

      (mockClientManager.isConnected as jest.Mock).mockReturnValue(true);

      // Mock slow execution (never resolves)
      (mockClientManager.callTool as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100000))
      );

      const result = await service.routeToolCall(
        'slow-tool:execute',
        {},
        100 // 100ms timeout
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('timeout');
    }, 10000);

    test('should handle tool execution error', async () => {
      await MCPTool.create({
        toolId: 'error-tool:fail',
        name: 'fail',
        description: 'Error tool',
        inputSchema: { type: 'object' },
        serverId: 'error-tool',
        mcpServerEndpoint: 'http://localhost:8080/mcp',
        isActive: true
      });

      (mockClientManager.isConnected as jest.Mock).mockReturnValue(true);
      (mockClientManager.callTool as jest.Mock<Promise<any>>).mockRejectedValue(
        new Error('Tool execution failed')
      );

      const result = await service.routeToolCall('error-tool:fail', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('execution failed');
    });

    test('should format string response correctly', async () => {
      await MCPTool.create({
        toolId: 'simple:echo',
        name: 'echo',
        description: 'Echo tool',
        inputSchema: { type: 'object' },
        serverId: 'simple',
        mcpServerEndpoint: 'http://localhost:8080/mcp',
        isActive: true
      });

      (mockClientManager.isConnected as jest.Mock).mockReturnValue(true);
      (mockClientManager.callTool as jest.Mock<Promise<any>>).mockResolvedValue(
        'Hello, World!'
      );

      const result = await service.routeToolCall('simple:echo', {
        message: 'Hello'
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('Hello, World!');
      expect(result.isError).toBeUndefined();
    });

    test('should format object response correctly', async () => {
      await MCPTool.create({
        toolId: 'data:fetch',
        name: 'fetch',
        description: 'Fetch data',
        inputSchema: { type: 'object' },
        serverId: 'data',
        mcpServerEndpoint: 'http://localhost:8080/mcp',
        isActive: true
      });

      (mockClientManager.isConnected as jest.Mock).mockReturnValue(true);
      (mockClientManager.callTool as jest.Mock<Promise<any>>).mockResolvedValue({
        status: 'success',
        data: { foo: 'bar' }
      });

      const result = await service.routeToolCall('data:fetch', {});

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('"foo"');
      expect(result.content[0].text).toContain('"bar"');
    });
  });

  describe('parseToolId', () => {
    test('should parse namespaced tool ID correctly', () => {
      // Access private method for testing
      const result = (service as any).parseToolId('weather-mcp:get_current');

      expect(result.serverId).toBe('weather-mcp');
      expect(result.toolName).toBe('get_current');
    });

    test('should parse tool ID with multiple colons', () => {
      const result = (service as any).parseToolId(
        'server:namespace:tool_name'
      );

      expect(result.serverId).toBe('server');
      expect(result.toolName).toBe('namespace:tool_name');
    });

    test('should handle tool ID without namespace', () => {
      const result = (service as any).parseToolId('simple_tool');

      expect(result.serverId).toBe('');
      expect(result.toolName).toBe('simple_tool');
    });
  });

  describe('isToolAvailable', () => {
    test('should return true for available tool', async () => {
      await MCPTool.create({
        toolId: 'test-tool:available',
        name: 'available',
        description: 'Available tool',
        inputSchema: { type: 'object' },
        serverId: 'test-server',
        mcpServerEndpoint: 'http://localhost:8080/mcp',
        isActive: true
      });

      (mockClientManager.isConnected as jest.Mock).mockReturnValue(true);

      const available = await service.isToolAvailable('test-tool:available');

      expect(available).toBe(true);
    });

    test('should return false for non-existent tool', async () => {
      const available = await service.isToolAvailable('non-existent-tool');

      expect(available).toBe(false);
    });

    test('should return false for tool with disconnected server', async () => {
      await MCPTool.create({
        toolId: 'test-tool:disconnected',
        name: 'disconnected',
        description: 'Disconnected tool',
        inputSchema: { type: 'object' },
        serverId: 'offline-server',
        mcpServerEndpoint: 'http://localhost:8080/mcp',
        isActive: true
      });

      (mockClientManager.isConnected as jest.Mock).mockReturnValue(false);

      const available = await service.isToolAvailable('test-tool:disconnected');

      expect(available).toBe(false);
    });

    test('should return false for inactive tool', async () => {
      await MCPTool.create({
        toolId: 'test-tool:inactive',
        name: 'inactive',
        description: 'Inactive tool',
        inputSchema: { type: 'object' },
        serverId: 'test-server',
        mcpServerEndpoint: 'http://localhost:8080/mcp',
        isActive: false // Inactive
      });

      const available = await service.isToolAvailable('test-tool:inactive');

      expect(available).toBe(false);
    });
  });

  describe('routeMultipleToolCalls', () => {
    test('should route multiple tool calls in parallel', async () => {
      // Create multiple tools
      await MCPTool.create([
        {
          toolId: 'tool1:execute',
          name: 'execute',
          description: 'Tool 1',
          inputSchema: { type: 'object' },
          serverId: 'tool1',
          mcpServerEndpoint: 'http://localhost:8080/mcp',
          isActive: true
        },
        {
          toolId: 'tool2:execute',
          name: 'execute',
          description: 'Tool 2',
          inputSchema: { type: 'object' },
          serverId: 'tool2',
          mcpServerEndpoint: 'http://localhost:8081/mcp',
          isActive: true
        }
      ]);

      (mockClientManager.isConnected as jest.Mock).mockReturnValue(true);
      (mockClientManager.callTool as jest.Mock<Promise<any>>)
        .mockResolvedValueOnce({ content: [{ type: 'text', text: 'Result 1' }] })
        .mockResolvedValueOnce({ content: [{ type: 'text', text: 'Result 2' }] });

      const results = await service.routeMultipleToolCalls([
        { toolId: 'tool1:execute', args: {} },
        { toolId: 'tool2:execute', args: {} }
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].content[0].text).toBe('Result 1');
      expect(results[1].content[0].text).toBe('Result 2');
      expect(mockClientManager.callTool).toHaveBeenCalledTimes(2);
    });
  });
});
