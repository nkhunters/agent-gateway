import { describe, test, expect, beforeEach, afterEach, jest, beforeAll, afterAll } from '@jest/globals';
import { MCPClientManager } from '../../src/services/MCPClientManager';
import { MCPServer } from '../../src/models/MCPServer.model';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../../src/config/database';

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

describe('MCPClientManager', () => {
  let manager: MCPClientManager;

  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    manager = new MCPClientManager();
    await MCPServer.deleteMany({});
  });

  describe('connectToServer', () => {
    test('should connect to MCP server', async () => {
      const server = await MCPServer.create({
        serverId: 'test-server',
        name: 'Test Server',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp'
      });

      await manager.connectToServer(server);

      expect(manager.isConnected('test-server')).toBe(true);
      expect(manager.getConnectionStatus('test-server')).toBe('connected');
    });

    test('should handle connection failure', async () => {
      // Mock connection failure by importing and mocking the Client
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      const MockedClient = Client as jest.MockedFunction<any>;

      MockedClient.mockImplementationOnce(() => ({
        connect: (jest.fn() as any).mockRejectedValue(new Error('Connection failed'))
      }) as any);

      const server = await MCPServer.create({
        serverId: 'failing-server',
        name: 'Failing Server',
        description: 'Test',
        endpoint: 'http://localhost:9999/mcp'
      });

      await expect(manager.connectToServer(server)).rejects.toThrow();
      expect(manager.getConnectionStatus('failing-server')).toBe('error');
    });
  });

  describe('getClient', () => {
    test('should return client for connected server', async () => {
      const server = await MCPServer.create({
        serverId: 'test-server',
        name: 'Test',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp'
      });

      await manager.connectToServer(server);
      const client = manager.getClient('test-server');

      expect(client).toBeTruthy();
    });

    test('should return null for non-existent server', () => {
      const client = manager.getClient('non-existent');

      expect(client).toBeNull();
    });

    test('should return null for disconnected server', async () => {
      const server = await MCPServer.create({
        serverId: 'test-server',
        name: 'Test',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp'
      });

      await manager.connectToServer(server);
      await manager.disconnectFromServer('test-server');

      const client = manager.getClient('test-server');
      expect(client).toBeNull();
    });
  });

  describe('listToolsFromServer', () => {
    test('should list tools from connected server', async () => {
      const server = await MCPServer.create({
        serverId: 'test-server',
        name: 'Test',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp'
      });

      await manager.connectToServer(server);

      // Mock listTools response
      const client = manager.getClient('test-server');
      const mockListTools = client!.listTools as jest.MockedFunction<any>;
      mockListTools.mockResolvedValue({
        tools: [
          { name: 'tool1', description: 'Tool 1', inputSchema: { type: 'object' } }
        ]
      });

      const tools = await manager.listToolsFromServer('test-server');

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('tool1');
    });

    test('should throw error for disconnected server', async () => {
      await expect(
        manager.listToolsFromServer('disconnected-server')
      ).rejects.toThrow('No active connection');
    });

    test('should mark connection as error on failure', async () => {
      const server = await MCPServer.create({
        serverId: 'test-server',
        name: 'Test',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp'
      });

      await manager.connectToServer(server);

      // Mock listTools to fail
      const client = manager.getClient('test-server');
      const mockListTools = client!.listTools as jest.MockedFunction<any>;
      mockListTools.mockRejectedValue(new Error('Network error'));

      await expect(manager.listToolsFromServer('test-server')).rejects.toThrow();
      expect(manager.getConnectionStatus('test-server')).toBe('error');
    });
  });

  describe('listAllTools', () => {
    test('should list tools from all connected servers', async () => {
      const server1 = await MCPServer.create({
        serverId: 'server-1',
        name: 'Server 1',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp'
      });

      const server2 = await MCPServer.create({
        serverId: 'server-2',
        name: 'Server 2',
        description: 'Test',
        endpoint: 'http://localhost:8081/mcp'
      });

      await manager.connectToServer(server1);
      await manager.connectToServer(server2);

      // Mock listTools responses
      const client1 = manager.getClient('server-1');
      const mockListTools1 = client1!.listTools as jest.MockedFunction<any>;
      mockListTools1.mockResolvedValue({
        tools: [{ name: 'tool1', description: 'Tool 1', inputSchema: { type: 'object' } }]
      });

      const client2 = manager.getClient('server-2');
      const mockListTools2 = client2!.listTools as jest.MockedFunction<any>;
      mockListTools2.mockResolvedValue({
        tools: [{ name: 'tool2', description: 'Tool 2', inputSchema: { type: 'object' } }]
      });

      const allTools = await manager.listAllTools();

      expect(allTools).toHaveLength(2);
      expect(allTools[0].serverId).toBe('server-1');
      expect(allTools[0].tools).toHaveLength(1);
      expect(allTools[1].serverId).toBe('server-2');
      expect(allTools[1].tools).toHaveLength(1);
    });

    test('should skip disconnected servers', async () => {
      const server = await MCPServer.create({
        serverId: 'test-server',
        name: 'Test',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp'
      });

      await manager.connectToServer(server);
      await manager.disconnectFromServer('test-server');

      const allTools = await manager.listAllTools();

      expect(allTools).toHaveLength(0);
    });
  });

  describe('callTool', () => {
    test('should call tool on connected server', async () => {
      const server = await MCPServer.create({
        serverId: 'test-server',
        name: 'Test',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp'
      });

      await manager.connectToServer(server);

      // Mock callTool response
      const client = manager.getClient('test-server');
      const mockCallTool = client!.callTool as jest.MockedFunction<any>;
      mockCallTool.mockResolvedValue({
        content: [{ type: 'text', text: 'Success' }]
      });

      const result = await manager.callTool('test-server', 'test-tool', { arg: 'value' });

      expect(result.content).toBeDefined();
      expect(mockCallTool).toHaveBeenCalledWith({
        name: 'test-tool',
        arguments: { arg: 'value' }
      });
    });

    test('should throw error for disconnected server', async () => {
      await expect(
        manager.callTool('disconnected-server', 'test-tool', {})
      ).rejects.toThrow('No active connection');
    });
  });

  describe('healthCheck', () => {
    test('should identify healthy servers', async () => {
      const server = await MCPServer.create({
        serverId: 'healthy-server',
        name: 'Healthy',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp'
      });

      await manager.connectToServer(server);

      const result = await manager.healthCheck();

      expect(result.healthy).toContain('healthy-server');
      expect(result.unhealthy).toHaveLength(0);
    });

    test('should identify unhealthy servers', async () => {
      const server = await MCPServer.create({
        serverId: 'unhealthy-server',
        name: 'Unhealthy',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp'
      });

      await manager.connectToServer(server);

      // Mock listTools to fail
      const client = manager.getClient('unhealthy-server');
      const mockListTools = client!.listTools as jest.MockedFunction<any>;
      mockListTools.mockRejectedValue(new Error('Health check failed'));

      const result = await manager.healthCheck();

      expect(result.unhealthy).toContain('unhealthy-server');
      expect(result.healthy).toHaveLength(0);
    });
  });

  describe('initializeFromDatabase', () => {
    test('should initialize connections from database', async () => {
      await MCPServer.create({
        serverId: 'server-1',
        name: 'Server 1',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp',
        isActive: true
      });

      await MCPServer.create({
        serverId: 'server-2',
        name: 'Server 2',
        description: 'Test',
        endpoint: 'http://localhost:8081/mcp',
        isActive: true
      });

      await manager.initializeFromDatabase();

      expect(manager.isConnected('server-1')).toBe(true);
      expect(manager.isConnected('server-2')).toBe(true);
    });

    test('should skip inactive servers', async () => {
      await MCPServer.create({
        serverId: 'inactive-server',
        name: 'Inactive',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp',
        isActive: false
      });

      await manager.initializeFromDatabase();

      expect(manager.isConnected('inactive-server')).toBe(false);
    });
  });

  describe('shutdown', () => {
    test('should disconnect all clients', async () => {
      const server1 = await MCPServer.create({
        serverId: 'server-1',
        name: 'Server 1',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp'
      });

      const server2 = await MCPServer.create({
        serverId: 'server-2',
        name: 'Server 2',
        description: 'Test',
        endpoint: 'http://localhost:8081/mcp'
      });

      await manager.connectToServer(server1);
      await manager.connectToServer(server2);

      expect(manager.isConnected('server-1')).toBe(true);
      expect(manager.isConnected('server-2')).toBe(true);

      await manager.shutdown();

      expect(manager.isConnected('server-1')).toBe(false);
      expect(manager.isConnected('server-2')).toBe(false);
    });
  });

  describe('getAllConnectionStatuses', () => {
    test('should return all connection statuses', async () => {
      const server = await MCPServer.create({
        serverId: 'test-server',
        name: 'Test',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp'
      });

      await manager.connectToServer(server);

      const statuses = manager.getAllConnectionStatuses();

      expect(statuses).toHaveLength(1);
      expect(statuses[0].serverId).toBe('test-server');
      expect(statuses[0].status).toBe('connected');
      expect(statuses[0].endpoint).toBe('http://localhost:8080/mcp');
    });
  });
});
