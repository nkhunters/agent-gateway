import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { MCPTool, IMCPTool } from '../../src/models/MCPTool.model';

describe('MCPTool Model', () => {
  beforeAll(async () => {
    await mongoose.connect('mongodb://localhost:27017/agent-gateway-test');
  });

  afterAll(async () => {
    await MCPTool.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await MCPTool.deleteMany({});
  });

  describe('Validation', () => {
    test('should create a valid tool', async () => {
      const toolData: Partial<IMCPTool> = {
        toolId: 'weather:get-current',
        name: 'get_current_weather',
        description: 'Get current weather for a location',
        inputSchema: {
          type: 'object',
          properties: {
            location: { type: 'string' }
          },
          required: ['location']
        },
        serverId: 'weather-mcp',
        mcpServerEndpoint: 'http://localhost:8080/mcp',
        lastSyncedAt: new Date()
      };

      const tool = await MCPTool.create(toolData);

      expect(tool.toolId).toBe('weather:get-current');
      expect(tool.name).toBe('get_current_weather');
      expect(tool.serverId).toBe('weather-mcp');
    });

    test('should require toolId', async () => {
      const toolData = {
        name: 'test_tool',
        description: 'Test',
        inputSchema: { type: 'object' },
        serverId: 'test-server',
        mcpServerEndpoint: 'http://localhost:8080/mcp'
      };

      await expect(MCPTool.create(toolData)).rejects.toThrow();
    });

    test('should require unique toolId', async () => {
      const toolData = {
        toolId: 'duplicate-tool',
        name: 'tool1',
        description: 'Description',
        inputSchema: { type: 'object' },
        serverId: 'test-server',
        mcpServerEndpoint: 'http://localhost:8080/mcp'
      };

      await MCPTool.create(toolData);

      await expect(
        MCPTool.create({ ...toolData, name: 'tool2' })
      ).rejects.toThrow();
    });

    test('should convert toolId to lowercase', async () => {
      const tool = await MCPTool.create({
        toolId: 'UPPERCASE:TOOL',
        name: 'test_tool',
        description: 'Test',
        inputSchema: { type: 'object' },
        serverId: 'test-server',
        mcpServerEndpoint: 'http://localhost:8080/mcp'
      });

      expect(tool.toolId).toBe('uppercase:tool');
    });

    test('should validate inputSchema format', async () => {
      const invalidData = {
        toolId: 'test-tool',
        name: 'test',
        description: 'Test',
        inputSchema: { type: 'string' }, // Invalid: must be object
        serverId: 'test-server',
        mcpServerEndpoint: 'http://localhost:8080/mcp'
      };

      await expect(MCPTool.create(invalidData)).rejects.toThrow();
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      await MCPTool.create([
        {
          toolId: 'weather:get-current',
          name: 'get_weather',
          description: 'Get weather',
          inputSchema: { type: 'object' },
          serverId: 'weather-mcp',
          mcpServerEndpoint: 'http://localhost:8080/mcp',
          isActive: true
        },
        {
          toolId: 'calculator:add',
          name: 'add',
          description: 'Add numbers',
          inputSchema: { type: 'object' },
          serverId: 'calculator-mcp',
          mcpServerEndpoint: 'http://localhost:8081/mcp',
          isActive: false
        },
        {
          toolId: 'calculator:subtract',
          name: 'subtract',
          description: 'Subtract numbers',
          inputSchema: { type: 'object' },
          serverId: 'calculator-mcp',
          mcpServerEndpoint: 'http://localhost:8081/mcp',
          isActive: true
        }
      ]);
    });

    test('should find all active tools', async () => {
      const active = await MCPTool.findActive();

      expect(active).toHaveLength(2);
      expect(active.every(t => t.isActive)).toBe(true);
    });

    test('should find tools by serverId', async () => {
      const tools = await MCPTool.findByServerId('calculator-mcp');

      expect(tools).toHaveLength(1); // Only active tools
      expect(tools[0].toolId).toBe('calculator:subtract');
    });

    test('should find tools by toolIds', async () => {
      const toolIds = ['weather:get-current', 'calculator:subtract'];
      const tools = await MCPTool.findByToolIds(toolIds);

      expect(tools).toHaveLength(2);
      expect(tools.map(t => t.toolId)).toContain('weather:get-current');
      expect(tools.map(t => t.toolId)).toContain('calculator:subtract');
    });

    test('should handle case-insensitive toolId lookup', async () => {
      const tools = await MCPTool.findByToolIds(['WEATHER:GET-CURRENT']);

      expect(tools).toHaveLength(1);
      expect(tools[0].toolId).toBe('weather:get-current');
    });

    test('should find stale tools', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      await MCPTool.create({
        toolId: 'stale:tool',
        name: 'stale_tool',
        description: 'Stale',
        inputSchema: { type: 'object' },
        serverId: 'test-server',
        mcpServerEndpoint: 'http://localhost:8080/mcp',
        lastSyncedAt: twoHoursAgo
      });

      const stale = await MCPTool.findStale();

      expect(stale).toHaveLength(1);
      expect(stale[0].toolId).toBe('stale:tool');
    });
  });

  describe('Instance Methods', () => {
    test('should check if sync is stale', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const tool = await MCPTool.create({
        toolId: 'test:tool',
        name: 'test',
        description: 'Test',
        inputSchema: { type: 'object' },
        serverId: 'test-server',
        mcpServerEndpoint: 'http://localhost:8080/mcp',
        lastSyncedAt: twoHoursAgo
      });

      expect(tool.isSyncStale()).toBe(true);
    });

    test('should return false for fresh sync', async () => {
      const tool = await MCPTool.create({
        toolId: 'test:tool',
        name: 'test',
        description: 'Test',
        inputSchema: { type: 'object' },
        serverId: 'test-server',
        mcpServerEndpoint: 'http://localhost:8080/mcp',
        lastSyncedAt: new Date()
      });

      expect(tool.isSyncStale()).toBe(false);
    });

    test('should convert to MCP format', async () => {
      const tool = await MCPTool.create({
        toolId: 'test:tool',
        name: 'test_tool',
        title: 'Test Tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: { input: { type: 'string' } }
        },
        serverId: 'test-server',
        mcpServerEndpoint: 'http://localhost:8080/mcp'
      });

      const mcpFormat = tool.toMCPFormat();

      expect(mcpFormat).toEqual({
        name: 'test_tool',
        title: 'Test Tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: { input: { type: 'string' } }
        }
      });
    });
  });
});
