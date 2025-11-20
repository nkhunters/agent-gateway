import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import mongoose from 'mongoose';
import { ToolAggregator } from '../../src/services/ToolAggregator';
import { MCPClientManager } from '../../src/services/MCPClientManager';
import { MCPServer } from '../../src/models/MCPServer.model';
import { MCPTool } from '../../src/models/MCPTool.model';

// Mock MCP SDK
jest.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: (jest.fn() as any).mockResolvedValue(undefined),
    listTools: (jest.fn() as any).mockResolvedValue({ tools: [] }),
    callTool: (jest.fn() as any).mockResolvedValue({ content: [] })
  }))
}));

jest.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: jest.fn()
}));

describe('ToolAggregator', () => {
  let aggregator: ToolAggregator;
  let mockClientManager: MCPClientManager;

  beforeAll(async () => {
    await mongoose.connect('mongodb://localhost:27017/agent-gateway-test');
  });

  afterAll(async () => {
    await MCPServer.deleteMany({});
    await MCPTool.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await MCPServer.deleteMany({});
    await MCPTool.deleteMany({});

    mockClientManager = {
      listToolsFromServer: jest.fn()
    } as any;

    aggregator = new ToolAggregator(mockClientManager);
  });

  describe('syncToolsFromServer', () => {
    test('should sync tools from server', async () => {
      const mockTools = [
        {
          name: 'get_weather',
          description: 'Get weather info',
          inputSchema: { type: 'object' }
        },
        {
          name: 'get_forecast',
          description: 'Get forecast',
          inputSchema: { type: 'object' }
        }
      ];

      (mockClientManager.listToolsFromServer as any).mockResolvedValue(mockTools);

      const result = await aggregator.syncToolsFromServer(
        'weather-mcp',
        'http://localhost:8080/mcp'
      );

      expect(result.success).toBe(true);
      expect(result.toolsCount).toBe(2);

      // Verify tools in database
      const tools = await MCPTool.find({ serverId: 'weather-mcp' });
      expect(tools).toHaveLength(2);
      expect(tools[0].toolId).toBe('weather-mcp:get_weather');
    });

    test('should handle sync errors', async () => {
      (mockClientManager.listToolsFromServer as any).mockRejectedValue(
        new Error('Connection failed')
      );

      const result = await aggregator.syncToolsFromServer(
        'failing-server',
        'http://localhost:9999/mcp'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection failed');
    });

    test('should update existing tools on re-sync', async () => {
      // First sync
      const mockTools = [
        {
          name: 'get_weather',
          description: 'Get weather info',
          inputSchema: { type: 'object' }
        }
      ];

      (mockClientManager.listToolsFromServer as any).mockResolvedValue(mockTools);

      await aggregator.syncToolsFromServer(
        'weather-mcp',
        'http://localhost:8080/mcp'
      );

      // Second sync with updated description
      const updatedTools = [
        {
          name: 'get_weather',
          description: 'Get current weather information',
          inputSchema: { type: 'object', properties: { location: { type: 'string' } } }
        }
      ];

      (mockClientManager.listToolsFromServer as any).mockResolvedValue(updatedTools);

      await aggregator.syncToolsFromServer(
        'weather-mcp',
        'http://localhost:8080/mcp'
      );

      // Verify only one tool exists with updated description
      const tools = await MCPTool.find({ serverId: 'weather-mcp' });
      expect(tools).toHaveLength(1);
      expect(tools[0].description).toBe('Get current weather information');
      expect(tools[0].inputSchema).toEqual({
        type: 'object',
        properties: { location: { type: 'string' } }
      });
    });
  });

  describe('syncAllTools', () => {
    test('should sync from all active servers', async () => {
      // Create test servers
      await MCPServer.create([
        {
          serverId: 'server1',
          name: 'Server 1',
          description: 'Test',
          endpoint: 'http://localhost:8080/mcp',
          isActive: true
        },
        {
          serverId: 'server2',
          name: 'Server 2',
          description: 'Test',
          endpoint: 'http://localhost:8081/mcp',
          isActive: true
        }
      ]);

      // Mock tools for each server
      (mockClientManager.listToolsFromServer as any)
        .mockResolvedValueOnce([
          { name: 'tool1', description: 'Tool 1', inputSchema: { type: 'object' } }
        ])
        .mockResolvedValueOnce([
          { name: 'tool2', description: 'Tool 2', inputSchema: { type: 'object' } }
        ]);

      const result = await aggregator.syncAllTools();

      expect(result.totalServers).toBe(2);
      expect(result.successfulServers).toBe(2);
      expect(result.totalToolsSynced).toBe(2);
    });

    test('should handle partial failures gracefully', async () => {
      // Create test servers
      await MCPServer.create([
        {
          serverId: 'server1',
          name: 'Server 1',
          description: 'Test',
          endpoint: 'http://localhost:8080/mcp',
          isActive: true
        },
        {
          serverId: 'server2',
          name: 'Server 2',
          description: 'Test',
          endpoint: 'http://localhost:8081/mcp',
          isActive: true
        }
      ]);

      // Mock first server success, second server failure
      (mockClientManager.listToolsFromServer as any)
        .mockResolvedValueOnce([
          { name: 'tool1', description: 'Tool 1', inputSchema: { type: 'object' } }
        ])
        .mockRejectedValueOnce(new Error('Connection timeout'));

      const result = await aggregator.syncAllTools();

      expect(result.totalServers).toBe(2);
      expect(result.successfulServers).toBe(1);
      expect(result.failedServers).toBe(1);
      expect(result.totalToolsSynced).toBe(1);
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].error).toContain('Connection timeout');
    });
  });

  describe('removeToolsForServer', () => {
    test('should remove all tools for server', async () => {
      // Create test tools
      await MCPTool.create([
        {
          toolId: 'test-server:tool1',
          name: 'tool1',
          description: 'Test',
          inputSchema: { type: 'object' },
          serverId: 'test-server',
          mcpServerEndpoint: 'http://localhost:8080/mcp'
        },
        {
          toolId: 'test-server:tool2',
          name: 'tool2',
          description: 'Test',
          inputSchema: { type: 'object' },
          serverId: 'test-server',
          mcpServerEndpoint: 'http://localhost:8080/mcp'
        }
      ]);

      const count = await aggregator.removeToolsForServer('test-server');

      expect(count).toBe(2);

      const remaining = await MCPTool.find({ serverId: 'test-server' });
      expect(remaining).toHaveLength(0);
    });

    test('should return 0 when no tools exist for server', async () => {
      const count = await aggregator.removeToolsForServer('non-existent-server');
      expect(count).toBe(0);
    });
  });

  describe('deactivateToolsForServer', () => {
    test('should mark tools as inactive for server', async () => {
      // Create test tools
      await MCPTool.create([
        {
          toolId: 'test-server:tool1',
          name: 'tool1',
          description: 'Test',
          inputSchema: { type: 'object' },
          serverId: 'test-server',
          mcpServerEndpoint: 'http://localhost:8080/mcp',
          isActive: true
        },
        {
          toolId: 'test-server:tool2',
          name: 'tool2',
          description: 'Test',
          inputSchema: { type: 'object' },
          serverId: 'test-server',
          mcpServerEndpoint: 'http://localhost:8080/mcp',
          isActive: true
        }
      ]);

      const count = await aggregator.deactivateToolsForServer('test-server');

      expect(count).toBe(2);

      // Verify tools still exist but are inactive
      const tools = await MCPTool.find({ serverId: 'test-server' });
      expect(tools).toHaveLength(2);
      expect(tools[0].isActive).toBe(false);
      expect(tools[1].isActive).toBe(false);
    });
  });

  describe('getSyncStatus', () => {
    test('should return sync status summary', async () => {
      // Create test tools
      await MCPTool.create([
        {
          toolId: 'server1:tool1',
          name: 'tool1',
          description: 'Test',
          inputSchema: { type: 'object' },
          serverId: 'server1',
          mcpServerEndpoint: 'http://localhost:8080/mcp',
          isActive: true,
          lastSyncedAt: new Date()
        },
        {
          toolId: 'server2:tool2',
          name: 'tool2',
          description: 'Test',
          inputSchema: { type: 'object' },
          serverId: 'server2',
          mcpServerEndpoint: 'http://localhost:8081/mcp',
          isActive: false,
          lastSyncedAt: new Date()
        }
      ]);

      const status = await aggregator.getSyncStatus();

      expect(status.totalTools).toBe(2);
      expect(status.activeTools).toBe(1);
      expect(status.toolsByServer).toHaveLength(1);
      expect(status.toolsByServer[0].serverId).toBe('server1');
    });

    test('should identify stale tools', async () => {
      // Create tool with old sync timestamp
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      await MCPTool.create([
        {
          toolId: 'server1:stale-tool',
          name: 'stale-tool',
          description: 'Test',
          inputSchema: { type: 'object' },
          serverId: 'server1',
          mcpServerEndpoint: 'http://localhost:8080/mcp',
          isActive: true,
          lastSyncedAt: twoHoursAgo
        },
        {
          toolId: 'server2:fresh-tool',
          name: 'fresh-tool',
          description: 'Test',
          inputSchema: { type: 'object' },
          serverId: 'server2',
          mcpServerEndpoint: 'http://localhost:8081/mcp',
          isActive: true,
          lastSyncedAt: new Date()
        }
      ]);

      const status = await aggregator.getSyncStatus();

      expect(status.staleTools).toBe(1);
    });
  });
});
