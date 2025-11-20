import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { MCPServer, IMCPServer } from '../../src/models/MCPServer.model';

describe('MCPServer Model', () => {
  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect('mongodb://localhost:27017/agent-gateway-test');
  });

  afterAll(async () => {
    // Clean up and disconnect
    await MCPServer.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear collection before each test
    await MCPServer.deleteMany({});
  });

  describe('Validation', () => {
    test('should create a valid MCP server', async () => {
      const serverData: Partial<IMCPServer> = {
        serverId: 'weather-mcp',
        name: 'Weather MCP Server',
        description: 'Provides weather information tools',
        endpoint: 'http://localhost:8080/mcp',
        isActive: true
      };

      const server = await MCPServer.create(serverData);

      expect(server.serverId).toBe('weather-mcp');
      expect(server.name).toBe('Weather MCP Server');
      expect(server.isActive).toBe(true);
      expect(server.createdAt).toBeInstanceOf(Date);
      expect(server.updatedAt).toBeInstanceOf(Date);
    });

    test('should require serverId', async () => {
      const serverData = {
        name: 'Test Server',
        description: 'Test description',
        endpoint: 'http://localhost:8080/mcp'
      };

      await expect(MCPServer.create(serverData)).rejects.toThrow();
    });

    test('should require unique serverId', async () => {
      const serverData = {
        serverId: 'duplicate-server',
        name: 'Server 1',
        description: 'Description',
        endpoint: 'http://localhost:8080/mcp'
      };

      await MCPServer.create(serverData);

      await expect(
        MCPServer.create({ ...serverData, name: 'Server 2' })
      ).rejects.toThrow();
    });

    test('should convert serverId to lowercase', async () => {
      const server = await MCPServer.create({
        serverId: 'UPPERCASE-SERVER',
        name: 'Test',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp'
      });

      expect(server.serverId).toBe('uppercase-server');
    });

    test('should validate endpoint URL format', async () => {
      const invalidData = {
        serverId: 'test-server',
        name: 'Test',
        description: 'Test',
        endpoint: 'not-a-url'
      };

      await expect(MCPServer.create(invalidData)).rejects.toThrow();
    });

    test('should reject invalid serverId format', async () => {
      const invalidData = {
        serverId: 'invalid server!',
        name: 'Test',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp'
      };

      await expect(MCPServer.create(invalidData)).rejects.toThrow();
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test data
      await MCPServer.create([
        {
          serverId: 'weather-mcp',
          name: 'Weather',
          description: 'Weather tools',
          endpoint: 'http://localhost:8080/mcp',
          isActive: true
        },
        {
          serverId: 'calculator-mcp',
          name: 'Calculator',
          description: 'Math tools',
          endpoint: 'http://localhost:8081/mcp',
          isActive: false
        },
        {
          serverId: 'search-mcp',
          name: 'Search',
          description: 'Search tools',
          endpoint: 'http://localhost:8082/mcp',
          isActive: true
        }
      ]);
    });

    test('should find all active servers', async () => {
      const active = await MCPServer.findActive();

      expect(active).toHaveLength(2);
      expect(active.every(s => s.isActive)).toBe(true);
    });

    test('should find server by serverId', async () => {
      const server = await MCPServer.findByServerId('weather-mcp');

      expect(server).toBeTruthy();
      expect(server!.serverId).toBe('weather-mcp');
    });

    test('should handle case-insensitive serverId lookup', async () => {
      const server = await MCPServer.findByServerId('WEATHER-MCP');

      expect(server).toBeTruthy();
      expect(server!.serverId).toBe('weather-mcp');
    });
  });

  describe('Instance Methods', () => {
    test('should check if server is healthy', async () => {
      const server = await MCPServer.create({
        serverId: 'test-server',
        name: 'Test',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp',
        lastHealthCheck: new Date()
      });

      expect(server.isHealthy()).toBe(true);
    });

    test('should return false for stale health check', async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const server = await MCPServer.create({
        serverId: 'test-server',
        name: 'Test',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp',
        lastHealthCheck: tenMinutesAgo
      });

      expect(server.isHealthy()).toBe(false);
    });
  });

  describe('toJSON', () => {
    test('should transform _id to id', async () => {
      const server = await MCPServer.create({
        serverId: 'test-server',
        name: 'Test',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp'
      });

      const json: any = server.toJSON();

      expect(json.id).toBeDefined();
      expect(json._id).toBeUndefined();
      expect(json.__v).toBeUndefined();
    });
  });
});
