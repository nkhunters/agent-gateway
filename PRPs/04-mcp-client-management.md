# PRP 04: MCP Client Management

## Goal

Create a service to manage persistent connections to backend MCP servers, enabling tool discovery and execution routing. The MCPClientManager will maintain a pool of MCP client connections and provide methods to interact with registered servers.

## Why

- **Connection Pooling**: Keep persistent connections to backend MCP servers for performance
- **Health Monitoring**: Track connection status and automatically reconnect on failures
- **Tool Discovery**: List tools from all registered servers
- **Centralized Access**: Single point of access for all MCP client operations

## What

### Deliverables
1. ✅ MCPClientManager service with TypeDI
2. ✅ Connect to backend MCP servers using @modelcontextprotocol/sdk
3. ✅ Maintain connection pool (Map of serverId → MCP Client)
4. ✅ Health check mechanism
5. ✅ Reconnection logic with exponential backoff
6. ✅ Unit tests with mocked MCP clients

### Success Criteria
- [ ] Can connect to backend MCP servers via HTTPStream
- [ ] Maintains Map of active connections
- [ ] Can list tools from specific server
- [ ] Can list tools from all servers
- [ ] Reconnects automatically on connection failure
- [ ] Health check identifies unhealthy connections
- [ ] Unit tests pass (80%+ coverage)

## Context & References

### MCP TypeScript SDK
- **GitHub**: https://github.com/modelcontextprotocol/typescript-sdk
- **HTTPStream Transport**: `StreamableHTTPClientTransport`
- **Client**: `Client` class from `@modelcontextprotocol/sdk/client/index.js`

### FastMCP Documentation
- **NPM**: https://www.npmjs.com/package/fastmcp
- Understand HTTPStream protocol

### Service Pattern
- **Reference**: Identity service services (TypeDI pattern)
- Use `@Service()` decorator
- Constructor injection for dependencies

## Implementation Tasks

### Task 1: Install MCP SDK (if not already installed)

Ensure `@modelcontextprotocol/sdk` is in package.json from PRP 01.

```bash
npm install @modelcontextprotocol/sdk
```

---

### Task 2: Create MCPClientManager Service

**File**: `src/services/MCPClientManager.ts`

```typescript
import { Service } from 'typedi';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { MCPServer, MCPServerDocument } from '../models/MCPServer.model';
import { logger } from '../utils/logger';

/**
 * Connection wrapper with metadata
 */
interface MCPConnection {
  client: Client;
  serverId: string;
  endpoint: string;
  status: 'connected' | 'disconnected' | 'error';
  lastConnected?: Date;
  lastError?: string;
}

/**
 * MCP Client Manager Service
 *
 * Manages persistent connections to backend MCP servers
 * Provides methods to connect, disconnect, and query tools
 */
@Service()
export class MCPClientManager {
  private connections: Map<string, MCPConnection> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();

  /**
   * Initialize connections to all active servers from database
   */
  async initializeFromDatabase(): Promise<void> {
    logger.info('Initializing MCP client connections from database');

    const servers = await MCPServer.findActive();

    logger.info({ count: servers.length }, 'Found active MCP servers');

    for (const server of servers) {
      try {
        await this.connectToServer(server);
      } catch (error) {
        logger.error(
          { err: error, serverId: server.serverId },
          'Failed to connect to MCP server during initialization'
        );
      }
    }

    logger.info(
      { connectedCount: this.connections.size },
      'MCP client initialization complete'
    );
  }

  /**
   * Connect to a specific MCP server
   */
  async connectToServer(server: MCPServerDocument): Promise<void> {
    try {
      logger.info(
        { serverId: server.serverId, endpoint: server.endpoint },
        'Connecting to MCP server'
      );

      // Create MCP client
      const client = new Client(
        {
          name: 'agent-gateway',
          version: '1.0.0'
        },
        {
          capabilities: {
            roots: { listChanged: true },
            sampling: {}
          }
        }
      );

      // Create HTTPStream transport
      const transport = new StreamableHTTPClientTransport(
        new URL(server.endpoint)
      );

      // Connect
      await client.connect(transport);

      // Store connection
      const connection: MCPConnection = {
        client,
        serverId: server.serverId,
        endpoint: server.endpoint,
        status: 'connected',
        lastConnected: new Date()
      };

      this.connections.set(server.serverId, connection);
      this.reconnectAttempts.set(server.serverId, 0);

      logger.info(
        { serverId: server.serverId },
        'Successfully connected to MCP server'
      );

      // Update server lastHealthCheck
      server.lastHealthCheck = new Date();
      await server.save();

    } catch (error) {
      logger.error(
        { err: error, serverId: server.serverId },
        'Failed to connect to MCP server'
      );

      // Store error status
      const connection: MCPConnection = {
        client: null as any,
        serverId: server.serverId,
        endpoint: server.endpoint,
        status: 'error',
        lastError: (error as Error).message
      };

      this.connections.set(server.serverId, connection);

      throw error;
    }
  }

  /**
   * Disconnect from a specific server
   */
  async disconnectFromServer(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);

    if (!connection) {
      logger.warn({ serverId }, 'No connection found to disconnect');
      return;
    }

    try {
      // MCP SDK may have a close/disconnect method
      // For now, just remove from map
      this.connections.delete(serverId);
      this.reconnectAttempts.delete(serverId);

      logger.info({ serverId }, 'Disconnected from MCP server');
    } catch (error) {
      logger.error({ err: error, serverId }, 'Error disconnecting from MCP server');
    }
  }

  /**
   * Get MCP client for a specific server
   */
  getClient(serverId: string): Client | null {
    const connection = this.connections.get(serverId);

    if (!connection || connection.status !== 'connected') {
      return null;
    }

    return connection.client;
  }

  /**
   * Check if server is connected
   */
  isConnected(serverId: string): boolean {
    const connection = this.connections.get(serverId);
    return connection?.status === 'connected';
  }

  /**
   * Get connection status for a server
   */
  getConnectionStatus(serverId: string): 'connected' | 'disconnected' | 'error' | 'unknown' {
    const connection = this.connections.get(serverId);
    return connection?.status || 'unknown';
  }

  /**
   * List tools from a specific server
   */
  async listToolsFromServer(serverId: string): Promise<any[]> {
    const client = this.getClient(serverId);

    if (!client) {
      throw new Error(`No active connection to server: ${serverId}`);
    }

    try {
      logger.debug({ serverId }, 'Listing tools from MCP server');

      const response = await client.listTools();

      logger.info(
        { serverId, toolCount: response.tools.length },
        'Listed tools from MCP server'
      );

      return response.tools;
    } catch (error) {
      logger.error(
        { err: error, serverId },
        'Failed to list tools from MCP server'
      );

      // Mark connection as error
      const connection = this.connections.get(serverId);
      if (connection) {
        connection.status = 'error';
        connection.lastError = (error as Error).message;
      }

      throw error;
    }
  }

  /**
   * List tools from all connected servers
   */
  async listAllTools(): Promise<Array<{ serverId: string; endpoint: string; tools: any[] }>> {
    const allTools: Array<{ serverId: string; endpoint: string; tools: any[] }> = [];

    for (const [serverId, connection] of this.connections.entries()) {
      if (connection.status !== 'connected') {
        logger.warn(
          { serverId, status: connection.status },
          'Skipping server - not connected'
        );
        continue;
      }

      try {
        const tools = await this.listToolsFromServer(serverId);
        allTools.push({
          serverId,
          endpoint: connection.endpoint,
          tools
        });
      } catch (error) {
        logger.error(
          { err: error, serverId },
          'Failed to list tools from server'
        );
      }
    }

    return allTools;
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(
    serverId: string,
    toolName: string,
    args: any
  ): Promise<any> {
    const client = this.getClient(serverId);

    if (!client) {
      throw new Error(`No active connection to server: ${serverId}`);
    }

    try {
      logger.debug(
        { serverId, toolName, args },
        'Calling tool on MCP server'
      );

      const result = await client.callTool({
        name: toolName,
        arguments: args
      });

      logger.info(
        { serverId, toolName },
        'Tool call successful'
      );

      return result;
    } catch (error) {
      logger.error(
        { err: error, serverId, toolName },
        'Tool call failed'
      );

      throw error;
    }
  }

  /**
   * Health check for all connections
   *
   * Attempts to list tools from each server to verify connectivity
   * Marks servers as error if health check fails
   */
  async healthCheck(): Promise<{
    healthy: string[];
    unhealthy: string[];
  }> {
    logger.info('Running health check for all MCP connections');

    const healthy: string[] = [];
    const unhealthy: string[] = [];

    for (const [serverId, connection] of this.connections.entries()) {
      try {
        if (connection.status === 'connected') {
          // Try to list tools as health check
          await this.listToolsFromServer(serverId);
          healthy.push(serverId);

          // Update database
          const server = await MCPServer.findByServerId(serverId);
          if (server) {
            server.lastHealthCheck = new Date();
            await server.save();
          }
        } else {
          unhealthy.push(serverId);
        }
      } catch (error) {
        logger.warn(
          { err: error, serverId },
          'Health check failed for server'
        );
        unhealthy.push(serverId);

        // Attempt reconnection
        await this.attemptReconnect(serverId);
      }
    }

    logger.info(
      { healthy: healthy.length, unhealthy: unhealthy.length },
      'Health check complete'
    );

    return { healthy, unhealthy };
  }

  /**
   * Attempt to reconnect to a server with exponential backoff
   */
  private async attemptReconnect(serverId: string): Promise<void> {
    const attempts = this.reconnectAttempts.get(serverId) || 0;
    const maxAttempts = 5;

    if (attempts >= maxAttempts) {
      logger.warn(
        { serverId, attempts },
        'Max reconnection attempts reached'
      );
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.min(Math.pow(2, attempts) * 1000, 16000);

    logger.info(
      { serverId, attempt: attempts + 1, delay },
      'Scheduling reconnection attempt'
    );

    setTimeout(async () => {
      try {
        const server = await MCPServer.findByServerId(serverId);
        if (!server) {
          logger.error({ serverId }, 'Server not found in database');
          return;
        }

        // Disconnect old connection
        await this.disconnectFromServer(serverId);

        // Try to reconnect
        await this.connectToServer(server);

        logger.info({ serverId }, 'Reconnection successful');
        this.reconnectAttempts.set(serverId, 0);
      } catch (error) {
        logger.error(
          { err: error, serverId },
          'Reconnection attempt failed'
        );
        this.reconnectAttempts.set(serverId, attempts + 1);
      }
    }, delay);
  }

  /**
   * Get all connection statuses
   */
  getAllConnectionStatuses(): Array<{
    serverId: string;
    endpoint: string;
    status: string;
    lastConnected?: Date;
    lastError?: string;
  }> {
    return Array.from(this.connections.values()).map(conn => ({
      serverId: conn.serverId,
      endpoint: conn.endpoint,
      status: conn.status,
      lastConnected: conn.lastConnected,
      lastError: conn.lastError
    }));
  }

  /**
   * Graceful shutdown - disconnect all clients
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down MCP Client Manager');

    for (const serverId of this.connections.keys()) {
      await this.disconnectFromServer(serverId);
    }

    logger.info('MCP Client Manager shutdown complete');
  }
}
```

**Key Features**:
- ✅ Maintains Map of serverId → MCP Client connections
- ✅ Connects using StreamableHTTPClientTransport
- ✅ Health check mechanism (list tools as ping)
- ✅ Automatic reconnection with exponential backoff
- ✅ Methods: listToolsFromServer(), listAllTools(), callTool()
- ✅ Graceful shutdown
- ✅ TypeDI service

---

### Task 3: Create Unit Tests

**File**: `tests/unit/MCPClientManager.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MCPClientManager } from '../../src/services/MCPClientManager';
import { MCPServer } from '../../src/models/MCPServer.model';
import mongoose from 'mongoose';

// Mock MCP SDK
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue({ tools: [] }),
    callTool: vi.fn().mockResolvedValue({ content: [] })
  }))
}));

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: vi.fn()
}));

describe('MCPClientManager', () => {
  let manager: MCPClientManager;

  beforeEach(async () => {
    await mongoose.connect('mongodb://localhost:27017/agent-gateway-test');
    manager = new MCPClientManager();
    await MCPServer.deleteMany({});
  });

  afterEach(async () => {
    await mongoose.connection.close();
  });

  describe('connectToServer', () => {
    it('should connect to MCP server', async () => {
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

    it('should handle connection failure', async () => {
      // Mock connection failure
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      vi.mocked(Client).mockImplementationOnce(() => ({
        connect: vi.fn().mockRejectedValue(new Error('Connection failed'))
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
    it('should return client for connected server', async () => {
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

    it('should return null for non-existent server', () => {
      const client = manager.getClient('non-existent');

      expect(client).toBeNull();
    });
  });

  describe('listToolsFromServer', () => {
    it('should list tools from connected server', async () => {
      const server = await MCPServer.create({
        serverId: 'test-server',
        name: 'Test',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp'
      });

      await manager.connectToServer(server);

      // Mock listTools response
      const client = manager.getClient('test-server');
      vi.mocked(client!.listTools).mockResolvedValue({
        tools: [
          { name: 'tool1', description: 'Tool 1', inputSchema: { type: 'object' } }
        ]
      } as any);

      const tools = await manager.listToolsFromServer('test-server');

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('tool1');
    });

    it('should throw error for disconnected server', async () => {
      await expect(
        manager.listToolsFromServer('disconnected-server')
      ).rejects.toThrow('No active connection');
    });
  });

  describe('healthCheck', () => {
    it('should identify healthy and unhealthy servers', async () => {
      const server1 = await MCPServer.create({
        serverId: 'healthy-server',
        name: 'Healthy',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp'
      });

      await manager.connectToServer(server1);

      const result = await manager.healthCheck();

      expect(result.healthy).toContain('healthy-server');
    });
  });

  describe('shutdown', () => {
    it('should disconnect all clients', async () => {
      const server = await MCPServer.create({
        serverId: 'test-server',
        name: 'Test',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp'
      });

      await manager.connectToServer(server);
      expect(manager.isConnected('test-server')).toBe(true);

      await manager.shutdown();

      expect(manager.isConnected('test-server')).toBe(false);
    });
  });
});
```

---

## Validation

### Level 1: Unit Tests
```bash
npm test tests/unit/MCPClientManager.test.ts
```
**Expected**: All tests pass

### Level 2: Manual Testing with Real MCP Server

**Prerequisites**: A real MCP server running (e.g., FastMCP example)

Test script:
```typescript
// test-mcp-connection.ts
import { MCPClientManager } from './src/services/MCPClientManager';
import { MCPServer } from './src/models/MCPServer.model';
import mongoose from 'mongoose';

async function test() {
  await mongoose.connect('mongodb://localhost:27017/agent-gateway');

  // Create test server
  const server = await MCPServer.create({
    serverId: 'test-mcp',
    name: 'Test MCP Server',
    description: 'Test',
    endpoint: 'http://localhost:8080/mcp' // Adjust to your MCP server
  });

  const manager = new MCPClientManager();

  try {
    await manager.connectToServer(server);
    console.log('✓ Connected');

    const tools = await manager.listToolsFromServer('test-mcp');
    console.log('✓ Listed tools:', tools.length);

    await manager.shutdown();
    console.log('✓ Shutdown complete');
  } catch (error) {
    console.error('✗ Error:', error);
  }

  await mongoose.connection.close();
}

test();
```

Run:
```bash
npx ts-node test-mcp-connection.ts
```

---

## Known Gotchas

### 1. MCP SDK Imports
- Import paths use `.js` extension even in TypeScript
- Example: `@modelcontextprotocol/sdk/client/index.js`

### 2. Persistent Connections
- Keep connections alive for performance
- But be prepared to reconnect on failures
- Implement health check to detect stale connections

### 3. Error Handling
- Network errors, timeouts, server unavailable
- Mark connection as 'error' status
- Attempt reconnection with backoff

### 4. Concurrency
- Multiple requests might use same connection
- MCP Client should handle concurrent requests
- Consider connection pooling if needed

### 5. Graceful Shutdown
- Disconnect all clients on application shutdown
- Prevent resource leaks

---

## Next Steps

After completing this PRP:
1. ✅ MCPClientManager service created
2. ✅ Can connect to backend MCP servers
3. ✅ Maintains connection pool
4. ✅ Health check and reconnection logic
5. ✅ Unit tests passing

**Proceed to**: [PRP 05: Tool Aggregation & Synchronization](./05-tool-aggregation-sync.md)

---

## Checklist

- [ ] MCPClientManager service created with TypeDI
- [ ] Can connect to MCP servers via HTTPStream
- [ ] Maintains Map of connections
- [ ] listToolsFromServer() works
- [ ] listAllTools() aggregates from all servers
- [ ] callTool() routes to correct server
- [ ] Health check identifies unhealthy connections
- [ ] Reconnection with exponential backoff
- [ ] Graceful shutdown implemented
- [ ] Unit tests pass (80%+ coverage)

---

**Status**: 🟢 Ready for Implementation
**Estimated Time**: 1 day
**Dependencies**: PRP 01, PRP 02
**Next PRP**: 05 - Tool Aggregation & Synchronization
