# PRP 07: Universal MCP Server

## Goal

Create the Universal MCP Server using FastMCP - the core component that accepts client connections, validates JWT tokens via identity-service, dynamically filters tools based on `allowedTools`, and routes tool execution requests to backend MCP servers. Operates in **stateless HTTPStream mode**.

## Why

- **Central Gateway**: Single MCP endpoint for all agents
- **Token-Based Access Control**: Validates tokens and enforces `allowedTools` per request
- **Dynamic Tool Filtering**: Each request gets custom tool list based on permissions
- **Stateless**: No session management, validate on every request
- **Tool Routing**: Routes tool calls to appropriate backend servers

## What

### Deliverables

1. ✅ UniversalMCPServer service with FastMCP
2. ✅ HTTPStream stateless transport configuration
3. ✅ Token validation per request (via identity-service)
4. ✅ Dynamic tool filtering (tools/list)
5. ✅ Tool call routing (tools/call)
6. ✅ Error handling (401, 503)
7. ✅ Unit tests with mocked dependencies

### Success Criteria

- [ ] FastMCP server runs on configured port
- [ ] Accepts HTTPStream connections
- [ ] Validates token on every request (stateless)
- [ ] tools/list returns only allowed tools
- [ ] tools/call routes to correct backend server
- [ ] Returns 401 for invalid tokens
- [ ] Returns 503 when identity-service unavailable
- [ ] Unit tests pass (80%+ coverage)

## Context & References

### FastMCP Documentation

- **NPM**: https://www.npmjs.com/package/fastmcp
- HTTPStream stateless mode
- Tool registration and execution

### MCP Specification

- **Tools**: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- tools/list method
- tools/call method
- JSON-RPC protocol

### Dependencies

- TokenValidationService (PRP 03) - validate tokens
- MCPTool model (PRP 02) - query allowed tools
- ToolRoutingService (PRP 08) - route tool calls

## Implementation Tasks

### Task 1: Create UniversalMCPServer Service

**File**: `src/services/UniversalMCPServer.ts`

```typescript
import { Service, Inject } from 'typedi';
import { FastMCP } from 'fastmcp';
import { TokenValidationService } from './TokenValidationService';
import { ToolRoutingService } from './ToolRoutingService';
import { MCPTool } from '../models/MCPTool.model';
import { logger } from '../utils/logger';
import { env } from '../config/env';

/**
 * Universal MCP Server
 *
 * Stateless MCP server that:
 * 1. Validates JWT tokens on each request
 * 2. Filters tools based on allowedTools in token
 * 3. Routes tool execution to backend MCP servers
 *
 * Uses FastMCP with HTTPStream in stateless mode
 */
@Service()
export class UniversalMCPServer {
  private server: FastMCP | null = null;
  private isRunning: boolean = false;

  constructor(
    private tokenValidationService: TokenValidationService,
    private toolRoutingService: ToolRoutingService
  ) {}

  /**
   * Start the Universal MCP Server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Universal MCP Server already running');
      return;
    }

    try {
      logger.info('Starting Universal MCP Server');

      // Create FastMCP server
      this.server = new FastMCP({
        name: 'agent-gateway-universal',
        version: '1.0.0',
        description: 'Universal MCP Server with token-based access control'
      });

      // Register custom request handler for tools/list
      // FastMCP allows custom handlers for MCP methods
      this.registerToolsListHandler();

      // Register custom request handler for tools/call
      this.registerToolsCallHandler();

      // Start server with HTTPStream stateless mode
      await this.server.start({
        transportType: 'httpStream',
        httpStream: {
          port: env.UNIVERSAL_MCP_PORT,
          endpoint: '/mcp'
        },
        health: {
          enabled: true,
          path: '/health',
          status: 200,
          message: 'healthy'
        }
      });

      this.isRunning = true;

      logger.info(
        {
          port: env.UNIVERSAL_MCP_PORT,
          endpoint: '/mcp'
        },
        'Universal MCP Server started successfully'
      );
    } catch (error) {
      logger.error({ err: error }, 'Failed to start Universal MCP Server');
      throw error;
    }
  }

  /**
   * Stop the Universal MCP Server
   */
  async stop(): Promise<void> {
    if (!this.isRunning || !this.server) {
      return;
    }

    try {
      logger.info('Stopping Universal MCP Server');

      // FastMCP may have a stop/close method
      // For now, mark as not running
      this.isRunning = false;
      this.server = null;

      logger.info('Universal MCP Server stopped');
    } catch (error) {
      logger.error({ err: error }, 'Error stopping Universal MCP Server');
    }
  }

  /**
   * Register custom handler for tools/list
   *
   * Stateless flow:
   * 1. Extract JWT from request
   * 2. Validate via identity-service
   * 3. Get allowedTools from payload
   * 4. Query MCPTool collection for allowed tools
   * 5. Return filtered list
   */
  private registerToolsListHandler(): void {
    // Note: FastMCP API may differ - this is conceptual
    // Actual implementation depends on FastMCP's custom handler API

    this.server!.onRequest('tools/list', async (params: any, context: any) => {
      try {
        // Extract Authorization header from request context
        const authHeader = context.headers?.authorization;

        if (!authHeader) {
          return {
            error: {
              code: -32600,
              message: 'Missing authorization header'
            }
          };
        }

        // Extract token
        const token =
          this.tokenValidationService.extractTokenFromHeader(authHeader);

        if (!token) {
          return {
            error: {
              code: -32600,
              message: 'Invalid authorization format'
            }
          };
        }

        // Validate token (calls identity-service API)
        let payload;
        try {
          payload = await this.tokenValidationService.validateToken(token);
        } catch (error: any) {
          if (error.message.includes('unavailable')) {
            return {
              error: {
                code: -32603,
                message: 'Authentication service unavailable'
              }
            };
          }

          return {
            error: {
              code: -32600,
              message: 'Invalid or expired token'
            }
          };
        }

        // Get allowed tools from payload
        const allowedToolIds = payload.allowedTools;

        logger.debug(
          {
            clientId: payload.sub,
            allowedToolsCount: allowedToolIds.length
          },
          'Listing tools for client'
        );

        // Query database for allowed tools
        const tools = await MCPTool.findByToolIds(allowedToolIds);

        // Convert to MCP format
        const mcpTools = tools.map((tool) => tool.toMCPFormat());

        logger.info(
          {
            clientId: payload.sub,
            toolsCount: mcpTools.length
          },
          'Returned filtered tool list'
        );

        return {
          tools: mcpTools
        };
      } catch (error) {
        logger.error({ err: error }, 'Error handling tools/list');

        return {
          error: {
            code: -32603,
            message: 'Internal server error'
          }
        };
      }
    });
  }

  /**
   * Register custom handler for tools/call
   *
   * Stateless flow:
   * 1. Extract JWT from request
   * 2. Validate via identity-service
   * 3. Check if tool in allowedTools
   * 4. Route tool call to backend MCP server
   * 5. Return result
   */
  private registerToolsCallHandler(): void {
    this.server!.onRequest('tools/call', async (params: any, context: any) => {
      try {
        // Extract Authorization header
        const authHeader = context.headers?.authorization;

        if (!authHeader) {
          return {
            error: {
              code: -32600,
              message: 'Missing authorization header'
            }
          };
        }

        // Extract token
        const token =
          this.tokenValidationService.extractTokenFromHeader(authHeader);

        if (!token) {
          return {
            error: {
              code: -32600,
              message: 'Invalid authorization format'
            }
          };
        }

        // Validate token
        let payload;
        try {
          payload = await this.tokenValidationService.validateToken(token);
        } catch (error: any) {
          if (error.message.includes('unavailable')) {
            return {
              error: {
                code: -32603,
                message: 'Authentication service unavailable'
              }
            };
          }

          return {
            error: {
              code: -32600,
              message: 'Invalid or expired token'
            }
          };
        }

        // Get tool name from params
        const toolName = params.name;

        if (!toolName) {
          return {
            error: {
              code: -32602,
              message: 'Tool name required'
            }
          };
        }

        // Check if tool is in allowedTools
        const allowedToolIds = payload.allowedTools;

        if (!allowedToolIds.includes(toolName)) {
          logger.warn(
            {
              clientId: payload.sub,
              toolName,
              allowedTools: allowedToolIds
            },
            'Tool not allowed for client'
          );

          return {
            error: {
              code: -32601,
              message: `Tool '${toolName}' not allowed for this client`
            }
          };
        }

        logger.info(
          {
            clientId: payload.sub,
            toolName,
            args: params.arguments
          },
          'Executing tool call'
        );

        // Route tool call to backend server
        const result = await this.toolRoutingService.routeToolCall(
          toolName,
          params.arguments || {}
        );

        return result;
      } catch (error: any) {
        logger.error({ err: error }, 'Error handling tools/call');

        return {
          error: {
            code: -32603,
            message: error.message || 'Tool execution failed'
          }
        };
      }
    });
  }

  /**
   * Check if server is running
   */
  isServerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get server info
   */
  getServerInfo(): {
    isRunning: boolean;
    port?: number;
    endpoint?: string;
  } {
    return {
      isRunning: this.isRunning,
      port: this.isRunning ? env.UNIVERSAL_MCP_PORT : undefined,
      endpoint: this.isRunning ? '/mcp' : undefined
    };
  }
}
```

**Key Features**:

- ✅ FastMCP with HTTPStream stateless mode
- ✅ Custom handlers for tools/list and tools/call
- ✅ Token validation on every request (no state)
- ✅ Dynamic tool filtering based on allowedTools
- ✅ Routes tool calls to backend servers
- ✅ Proper error handling with JSON-RPC error codes
- ✅ Comprehensive logging

**Important Note**: The actual FastMCP API for custom request handlers may differ. Refer to FastMCP documentation and adjust the `onRequest` pattern accordingly. The conceptual flow is correct.

---

### Task 2: Alternative Implementation Using FastMCP Tool Registration

If FastMCP doesn't support custom request handlers, use this approach:

```typescript
/**
 * Alternative: Register tools dynamically per request
 *
 * This approach uses FastMCP's standard tool registration
 * but requires middleware/wrapper to validate tokens
 */
async handleRequest(req: any, res: any): Promise<void> {
  try {
    // 1. Extract and validate token
    const authHeader = req.headers.authorization;
    const token = this.tokenValidationService.extractTokenFromHeader(authHeader);

    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const payload = await this.tokenValidationService.validateToken(token);
    const allowedToolIds = payload.allowedTools;

    // 2. Create temporary MCP server with allowed tools only
    const tempServer = new FastMCP({
      name: `gateway-${payload.sub}`,
      version: '1.0.0'
    });

    // 3. Register only allowed tools
    const tools = await MCPTool.findByToolIds(allowedToolIds);

    for (const tool of tools) {
      tempServer.addTool({
        name: tool.name,
        description: tool.description,
        parameters: this.convertJSONSchemaToZod(tool.inputSchema),
        execute: async (args: any) => {
          return await this.toolRoutingService.routeToolCall(tool.toolId, args);
        }
      });
    }

    // 4. Handle MCP request with temp server
    // Forward request to temp server...

  } catch (error) {
    logger.error({ err: error }, 'Request handling error');
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

---

### Task 3: Create Unit Tests

**File**: `tests/unit/UniversalMCPServer.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UniversalMCPServer } from '../../src/services/UniversalMCPServer';
import { TokenValidationService } from '../../src/services/TokenValidationService';
import { ToolRoutingService } from '../../src/services/ToolRoutingService';

// Mock FastMCP
vi.mock('fastmcp', () => ({
  FastMCP: vi.fn().mockImplementation(() => ({
    onRequest: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined)
  }))
}));

describe('UniversalMCPServer', () => {
  let server: UniversalMCPServer;
  let mockTokenService: TokenValidationService;
  let mockRoutingService: ToolRoutingService;

  beforeEach(() => {
    mockTokenService = {
      validateToken: vi.fn(),
      extractTokenFromHeader: vi.fn()
    } as any;

    mockRoutingService = {
      routeToolCall: vi.fn()
    } as any;

    server = new UniversalMCPServer(mockTokenService, mockRoutingService);
  });

  describe('start', () => {
    it('should start FastMCP server', async () => {
      await server.start();

      expect(server.isServerRunning()).toBe(true);
    });

    it('should not start if already running', async () => {
      await server.start();
      await server.start(); // Second call

      // Should log warning but not error
      expect(server.isServerRunning()).toBe(true);
    });
  });

  describe('stop', () => {
    it('should stop server', async () => {
      await server.start();
      await server.stop();

      expect(server.isServerRunning()).toBe(false);
    });
  });

  describe('getServerInfo', () => {
    it('should return server info', async () => {
      await server.start();

      const info = server.getServerInfo();

      expect(info.isRunning).toBe(true);
      expect(info.port).toBeDefined();
      expect(info.endpoint).toBe('/mcp');
    });
  });
});
```

---

## Validation

### Level 1: Unit Tests

```bash
npm test tests/unit/UniversalMCPServer.test.ts
```

**Expected**: All tests pass

### Level 2: Manual Test with MCP Inspector

**Prerequisites**:

- Identity service running
- Valid JWT token
- MCP Inspector or equivalent MCP client

**Steps**:

1. Start agent-gateway:

```bash
npm run dev
```

2. Connect MCP Inspector to `http://localhost:3001/mcp` with Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

3. Test tools/list:

- Should return only tools in your token's `allowedTools` array

4. Test tools/call:

- Call an allowed tool
- Should route to backend server and return result

5. Test unauthorized tool:

- Try to call a tool not in `allowedTools`
- Should return error "Tool not allowed"

---

## Known Gotchas

### 1. FastMCP Custom Handlers

⚠️ **CRITICAL**: FastMCP API for custom request handlers may differ from conceptual example

- Check FastMCP documentation for exact API
- May need middleware approach instead of `onRequest`
- Core logic remains same: validate, filter, route

### 2. Stateless Operation

- No state stored between requests
- Validate token on EVERY request
- Query database for tools on EVERY request
- This is by design (security vs performance tradeoff)

### 3. HTTPStream vs SSE

- Use HTTPStream for stateless operation
- SSE (Server-Sent Events) is for notifications
- HTTPStream handles request/response

### 4. JSON-RPC Error Codes

- -32600: Invalid Request
- -32601: Method Not Found
- -32602: Invalid Params
- -32603: Internal Error

### 5. Tool ID Format

- Ensure toolId format matches what's in `allowedTools` in JWT
- Coordinate with identity-service on naming convention
- Example: "weather:get_current" or just "get_current"

### 6. Performance Considerations

- Every request validates token (network call to identity-service)
- Every request queries database for tools
- Consider caching if performance becomes issue (but breaks stateless model)

---

## Next Steps

After completing this PRP:

1. ✅ UniversalMCPServer service created
2. ✅ FastMCP running in stateless mode
3. ✅ Token validation per request
4. ✅ Dynamic tool filtering
5. ✅ Tool call routing (depends on PRP 08)
6. ✅ Unit tests passing

**Proceed to**: [PRP 08: Tool Routing & Execution](./08-tool-routing-execution.md)

---

## Checklist

- [ ] UniversalMCPServer service created with TypeDI
- [ ] FastMCP server configured for HTTPStream stateless mode
- [ ] Custom handlers registered for tools/list and tools/call
- [ ] Token validation on every request
- [ ] tools/list returns filtered tool list
- [ ] tools/call checks allowedTools before routing
- [ ] Returns proper JSON-RPC errors
- [ ] Logging comprehensive for debugging
- [ ] Unit tests pass
- [ ] Manual test with MCP client successful

---

**Status**: 🟢 Ready for Implementation
**Estimated Time**: 2 days
**Dependencies**: PRP 02, PRP 03, PRP 08 (for routing)
**Next PRP**: 08 - Tool Routing & Execution
