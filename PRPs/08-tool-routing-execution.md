# PRP 08: Tool Routing & Execution

## Goal

Create the ToolRoutingService that routes tool execution requests to the appropriate backend MCP server. Parses tool IDs, looks up which server provides the tool, and executes the tool via MCPClientManager.

## Why

- **Request Routing**: Direct tool calls to correct backend MCP server
- **Error Handling**: Handle backend server failures gracefully
- **Response Formatting**: Convert backend responses to MCP format
- **Timeout Management**: Prevent hanging requests

## What

### Deliverables

1. ✅ ToolRoutingService with TypeDI
2. ✅ Parse tool ID to find serverId
3. ✅ Route to MCPClientManager.callTool()
4. ✅ Handle execution errors
5. ✅ Format responses consistently
6. ✅ Timeout handling
7. ✅ Unit tests with mocked MCP client

### Success Criteria

- [ ] Can route tool calls to correct backend server
- [ ] Handles tool ID parsing (namespace:toolName format)
- [ ] Returns formatted MCP response
- [ ] Handles backend server errors gracefully
- [ ] Implements timeout (30 seconds default)
- [ ] Unit tests pass (80%+ coverage)

## Context & References

### MCP Tool Call Response Format

- **Specification**: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- Response contains `content` array with text/image/resource items
- Optional `isError` flag

### Dependencies

- MCPClientManager (PRP 04) - execute tools on backend servers
- MCPTool model (PRP 02) - look up tool metadata

## Implementation Tasks

### Task 1: Create ToolRoutingService

**File**: `src/services/ToolRoutingService.ts`

```typescript
import { Service, Inject } from 'typedi';
import { MCPClientManager } from './MCPClientManager';
import { MCPTool } from '../models/MCPTool.model';
import { logger } from '../utils/logger';

/**
 * Tool execution result
 */
interface ToolExecutionResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

/**
 * Tool Routing Service
 *
 * Routes tool execution requests to appropriate backend MCP servers
 */
@Service()
export class ToolRoutingService {
  // Default timeout for tool execution (30 seconds)
  private readonly DEFAULT_TIMEOUT = 30000;

  constructor(private mcpClientManager: MCPClientManager) {}

  /**
   * Route tool call to appropriate backend MCP server
   *
   * @param toolId - Full tool identifier (e.g., "weather-mcp:get_current")
   * @param args - Tool arguments
   * @param timeout - Optional timeout in milliseconds
   * @returns Tool execution result in MCP format
   */
  async routeToolCall(
    toolId: string,
    args: any,
    timeout: number = this.DEFAULT_TIMEOUT
  ): Promise<ToolExecutionResult> {
    try {
      logger.info({ toolId, args, timeout }, 'Routing tool call');

      // 1. Look up tool in database to find serverId
      const tool = await MCPTool.findOne({ toolId, isActive: true });

      if (!tool) {
        logger.warn({ toolId }, 'Tool not found');

        return {
          content: [
            {
              type: 'text',
              text: `Tool '${toolId}' not found`
            }
          ],
          isError: true
        };
      }

      // 2. Parse serverId and actual tool name
      const { serverId, toolName } = this.parseToolId(toolId);

      logger.debug({ toolId, serverId, toolName }, 'Parsed tool ID');

      // 3. Check if MCP client is connected
      if (!this.mcpClientManager.isConnected(serverId)) {
        logger.warn({ serverId, toolId }, 'Backend MCP server not connected');

        return {
          content: [
            {
              type: 'text',
              text: `Backend server '${serverId}' is not available`
            }
          ],
          isError: true
        };
      }

      // 4. Execute tool with timeout
      const result = await this.executeWithTimeout(
        serverId,
        toolName,
        args,
        timeout
      );

      logger.info({ toolId, serverId }, 'Tool call successful');

      return result;
    } catch (error) {
      logger.error({ err: error, toolId, args }, 'Tool routing failed');

      return {
        content: [
          {
            type: 'text',
            text: `Tool execution failed: ${(error as Error).message}`
          }
        ],
        isError: true
      };
    }
  }

  /**
   * Execute tool with timeout
   *
   * Wraps MCPClientManager.callTool with Promise.race for timeout
   */
  private async executeWithTimeout(
    serverId: string,
    toolName: string,
    args: any,
    timeout: number
  ): Promise<ToolExecutionResult> {
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Tool execution timeout after ${timeout}ms`));
      }, timeout);
    });

    // Create execution promise
    const executionPromise = this.mcpClientManager.callTool(
      serverId,
      toolName,
      args
    );

    try {
      // Race between execution and timeout
      const result = await Promise.race([executionPromise, timeoutPromise]);

      // Convert result to MCP format
      return this.formatMCPResponse(result);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Parse tool ID into serverId and toolName
   *
   * Supports formats:
   * - "serverId:toolName" → { serverId, toolName }
   * - "toolName" → { serverId: 'default', toolName }
   */
  private parseToolId(toolId: string): {
    serverId: string;
    toolName: string;
  } {
    if (toolId.includes(':')) {
      const [serverId, ...toolNameParts] = toolId.split(':');
      const toolName = toolNameParts.join(':'); // Handle tool names with ':'

      return { serverId, toolName };
    }

    // If no namespace, assume it's just the tool name
    // and use the toolId to look up serverId from database
    return {
      serverId: '', // Will be looked up from database
      toolName: toolId
    };
  }

  /**
   * Format MCP response
   *
   * Converts backend MCP server response to standard format
   */
  private formatMCPResponse(result: any): ToolExecutionResult {
    // If result already in MCP format, return as-is
    if (result.content && Array.isArray(result.content)) {
      return result as ToolExecutionResult;
    }

    // If result is a simple value, wrap in content array
    if (typeof result === 'string') {
      return {
        content: [
          {
            type: 'text',
            text: result
          }
        ]
      };
    }

    // If result is an object, JSON stringify
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  /**
   * Batch route multiple tool calls
   *
   * Useful for parallel tool execution
   */
  async routeMultipleToolCalls(
    calls: Array<{ toolId: string; args: any }>
  ): Promise<ToolExecutionResult[]> {
    logger.info({ callCount: calls.length }, 'Routing multiple tool calls');

    const promises = calls.map((call) =>
      this.routeToolCall(call.toolId, call.args)
    );

    return await Promise.all(promises);
  }

  /**
   * Check if tool is available (server connected)
   */
  async isToolAvailable(toolId: string): Promise<boolean> {
    const tool = await MCPTool.findOne({ toolId, isActive: true });

    if (!tool) {
      return false;
    }

    return this.mcpClientManager.isConnected(tool.serverId);
  }
}
```

**Key Features**:

- ✅ Routes tool calls to correct backend server
- ✅ Parses tool ID (namespace:toolName format)
- ✅ Timeout handling with Promise.race
- ✅ Handles backend server unavailability
- ✅ Formats responses in MCP format
- ✅ Batch execution support
- ✅ Comprehensive error handling

---

### Task 2: Create Unit Tests

**File**: `tests/unit/ToolRoutingService.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { ToolRoutingService } from '../../src/services/ToolRoutingService';
import { MCPClientManager } from '../../src/services/MCPClientManager';
import { MCPTool } from '../../src/models/MCPTool.model';

describe('ToolRoutingService', () => {
  let service: ToolRoutingService;
  let mockClientManager: MCPClientManager;

  beforeEach(async () => {
    await mongoose.connect('mongodb://localhost:27017/agent-gateway-test');
    await MCPTool.deleteMany({});

    mockClientManager = {
      isConnected: vi.fn(),
      callTool: vi.fn()
    } as any;

    service = new ToolRoutingService(mockClientManager);
  });

  afterEach(async () => {
    await mongoose.connection.close();
  });

  describe('routeToolCall', () => {
    it('should route tool call to backend server', async () => {
      // Create test tool
      await MCPTool.create({
        toolId: 'weather-mcp:get_current',
        name: 'get_current_weather',
        description: 'Get weather',
        inputSchema: { type: 'object' },
        serverId: 'weather-mcp',
        mcpServerEndpoint: 'http://localhost:8080/mcp',
        isActive: true
      });

      // Mock connected server
      vi.mocked(mockClientManager.isConnected).mockReturnValue(true);

      // Mock tool execution
      vi.mocked(mockClientManager.callTool).mockResolvedValue({
        content: [{ type: 'text', text: 'Weather: 72°F, Sunny' }]
      });

      const result = await service.routeToolCall('weather-mcp:get_current', {
        location: 'New York'
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toContain('72°F');
      expect(mockClientManager.callTool).toHaveBeenCalledWith(
        'weather-mcp',
        'get_current_weather',
        { location: 'New York' }
      );
    });

    it('should handle tool not found', async () => {
      const result = await service.routeToolCall('non-existent-tool', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });

    it('should handle disconnected server', async () => {
      await MCPTool.create({
        toolId: 'weather-mcp:get_current',
        name: 'get_current',
        description: 'Test',
        inputSchema: { type: 'object' },
        serverId: 'weather-mcp',
        mcpServerEndpoint: 'http://localhost:8080/mcp',
        isActive: true
      });

      vi.mocked(mockClientManager.isConnected).mockReturnValue(false);

      const result = await service.routeToolCall('weather-mcp:get_current', {});

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not available');
    });

    it('should handle execution timeout', async () => {
      await MCPTool.create({
        toolId: 'slow-tool',
        name: 'slow_tool',
        description: 'Test',
        inputSchema: { type: 'object' },
        serverId: 'test-server',
        mcpServerEndpoint: 'http://localhost:8080/mcp',
        isActive: true
      });

      vi.mocked(mockClientManager.isConnected).mockReturnValue(true);

      // Mock slow execution
      vi.mocked(mockClientManager.callTool).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100000)) // Never resolves
      );

      const result = await service.routeToolCall(
        'slow-tool',
        {},
        100 // 100ms timeout
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('timeout');
    }, 10000);
  });

  describe('parseToolId', () => {
    it('should parse namespaced tool ID', () => {
      // Access private method via (service as any)
      const result = (service as any).parseToolId('weather-mcp:get_current');

      expect(result.serverId).toBe('weather-mcp');
      expect(result.toolName).toBe('get_current');
    });

    it('should handle tool ID without namespace', () => {
      const result = (service as any).parseToolId('get_current');

      expect(result.serverId).toBe('');
      expect(result.toolName).toBe('get_current');
    });
  });

  describe('isToolAvailable', () => {
    it('should return true for available tool', async () => {
      await MCPTool.create({
        toolId: 'test-tool',
        name: 'test',
        description: 'Test',
        inputSchema: { type: 'object' },
        serverId: 'test-server',
        mcpServerEndpoint: 'http://localhost:8080/mcp',
        isActive: true
      });

      vi.mocked(mockClientManager.isConnected).mockReturnValue(true);

      const available = await service.isToolAvailable('test-tool');

      expect(available).toBe(true);
    });

    it('should return false for non-existent tool', async () => {
      const available = await service.isToolAvailable('non-existent');

      expect(available).toBe(false);
    });
  });
});
```

---

## Validation

### Level 1: Unit Tests

```bash
npm test tests/unit/ToolRoutingService.test.ts
```

**Expected**: All tests pass

### Level 2: Integration Test with Real Backend MCP Server

```typescript
// test-tool-routing.ts
import { ToolRoutingService } from './src/services/ToolRoutingService';
import { MCPClientManager } from './src/services/MCPClientManager';
import { MCPServer } from './src/models/MCPServer.model';
import { MCPTool } from './src/models/MCPTool.model';
import mongoose from 'mongoose';

async function test() {
  await mongoose.connect('mongodb://localhost:27017/agent-gateway');

  // Setup
  const server = await MCPServer.create({
    serverId: 'test-mcp',
    name: 'Test MCP',
    description: 'Test',
    endpoint: 'http://localhost:8080/mcp',
    isActive: true
  });

  await MCPTool.create({
    toolId: 'test-mcp:echo',
    name: 'echo',
    description: 'Echo test',
    inputSchema: { type: 'object' },
    serverId: 'test-mcp',
    mcpServerEndpoint: 'http://localhost:8080/mcp',
    isActive: true
  });

  const clientManager = new MCPClientManager();
  await clientManager.connectToServer(server);

  const routingService = new ToolRoutingService(clientManager);

  // Test routing
  console.log('Routing tool call...');
  const result = await routingService.routeToolCall('test-mcp:echo', {
    message: 'Hello, World!'
  });

  console.log('Result:', JSON.stringify(result, null, 2));

  // Cleanup
  await clientManager.shutdown();
  await mongoose.connection.close();
}

test();
```

---

## Known Gotchas

### 1. Tool ID Format

- Must match format used in MCPTool collection
- Coordinate with ToolAggregator (PRP 05) on naming
- Example: "weather-mcp:get_current" or just "get_current"

### 2. Timeout Handling

- Default 30 seconds
- Adjust based on tool complexity
- Use Promise.race for timeout
- Cancel long-running operations if possible

### 3. Response Format

- Backend servers may return different formats
- Normalize to MCP content array format
- Handle text, image, resource types

### 4. Error Handling

- Distinguish between tool errors and system errors
- Set `isError: true` for tool execution failures
- Log errors with context for debugging

### 5. Concurrent Execution

- Multiple tool calls may execute simultaneously
- Ensure MCP clients handle concurrent requests
- Consider rate limiting if needed

---

## Next Steps

After completing this PRP:

1. ✅ ToolRoutingService created
2. ✅ Routes tool calls to backend servers
3. ✅ Handles errors and timeouts
4. ✅ Formats responses consistently
5. ✅ Unit tests passing

**Proceed to**: [PRP 09: Server Bootstrap & Integration Testing](./09-server-bootstrap-integration.md)

---

## Checklist

- [ ] ToolRoutingService created with TypeDI
- [ ] routeToolCall() routes to correct backend
- [ ] Parses tool ID correctly
- [ ] Timeout handling implemented
- [ ] Error handling comprehensive
- [ ] Formats responses in MCP format
- [ ] isToolAvailable() checks connectivity
- [ ] Unit tests pass (80%+ coverage)
- [ ] Integration test with real backend successful

---

**Status**: 🟢 Ready for Implementation
**Estimated Time**: 1 day
**Dependencies**: PRP 02, PRP 04
**Next PRP**: 09 - Server Bootstrap & Integration Testing
