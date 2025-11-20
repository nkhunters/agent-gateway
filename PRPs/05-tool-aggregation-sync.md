# PRP 05: Tool Aggregation & Synchronization

## Goal

Create a service to sync and cache tool definitions from all registered backend MCP servers into the MCPTool database collection. This enables fast tool lookups when filtering by `allowedTools` without querying backend servers every time.

## Why

- **Performance**: Cache tools locally for fast filtering
- **Reliability**: Don't depend on backend servers for every tools/list request
- **Tool Discovery**: Maintain up-to-date catalog of all available tools
- **Permission Filtering**: Enable efficient queries by toolId for allowedTools

## What

### Deliverables

1. ✅ ToolAggregator service with TypeDI
2. ✅ Sync tools from all registered MCP servers
3. ✅ Upsert into MCPTool collection (update existing, insert new)
4. ✅ Handle sync errors gracefully (per-server)
5. ✅ Scheduled/manual sync capability
6. ✅ Unit tests with mocked MCP client

### Success Criteria

- [ ] Can sync tools from all active MCP servers
- [ ] Tools upserted into MCPTool collection
- [ ] Handles individual server failures gracefully
- [ ] Updates lastSyncedAt timestamps
- [ ] Can trigger sync manually or on schedule
- [ ] Unit tests pass (80%+ coverage)

## Context & References

### Dependencies

- MCPClientManager (PRP 04) - for listing tools from servers
- MCPTool model (PRP 02) - for storing tool definitions
- MCPServer model (PRP 02) - for finding active servers

### Pattern

- Service with TypeDI
- Asynchronous bulk operations
- Error handling per server

## Implementation Tasks

### Task 1: Create ToolAggregator Service

**File**: `src/services/ToolAggregator.ts`

```typescript
import { Service, Inject } from 'typedi';
import { MCPClientManager } from './MCPClientManager';
import { MCPTool } from '../models/MCPTool.model';
import { MCPServer } from '../models/MCPServer.model';
import { logger } from '../utils/logger';

/**
 * Sync result for a single server
 */
interface ServerSyncResult {
  serverId: string;
  success: boolean;
  toolsCount?: number;
  error?: string;
}

/**
 * Tool Aggregator Service
 *
 * Syncs tool definitions from all backend MCP servers
 * and caches them in the MCPTool collection
 */
@Service()
export class ToolAggregator {
  constructor(private mcpClientManager: MCPClientManager) {}

  /**
   * Sync tools from all active MCP servers
   *
   * Returns summary of sync operation
   */
  async syncAllTools(): Promise<{
    totalServers: number;
    successfulServers: number;
    failedServers: number;
    totalToolsSynced: number;
    results: ServerSyncResult[];
  }> {
    logger.info('Starting tool sync from all MCP servers');

    const servers = await MCPServer.findActive();
    const results: ServerSyncResult[] = [];
    let totalToolsSynced = 0;

    for (const server of servers) {
      const result = await this.syncToolsFromServer(
        server.serverId,
        server.endpoint
      );
      results.push(result);

      if (result.success && result.toolsCount) {
        totalToolsSynced += result.toolsCount;
      }
    }

    const successfulServers = results.filter((r) => r.success).length;
    const failedServers = results.filter((r) => !r.success).length;

    logger.info(
      {
        totalServers: servers.length,
        successful: successfulServers,
        failed: failedServers,
        toolsSynced: totalToolsSynced
      },
      'Tool sync complete'
    );

    return {
      totalServers: servers.length,
      successfulServers,
      failedServers,
      totalToolsSynced,
      results
    };
  }

  /**
   * Sync tools from a specific MCP server
   *
   * Upserts tools into MCPTool collection
   */
  async syncToolsFromServer(
    serverId: string,
    endpoint: string
  ): Promise<ServerSyncResult> {
    try {
      logger.info({ serverId }, 'Syncing tools from MCP server');

      // List tools from server via MCPClientManager
      const tools = await this.mcpClientManager.listToolsFromServer(serverId);

      logger.debug(
        { serverId, toolCount: tools.length },
        'Retrieved tools from MCP server'
      );

      // Upsert each tool
      for (const tool of tools) {
        const toolId = `${serverId}:${tool.name}`; // Namespace with serverId

        await MCPTool.findOneAndUpdate(
          { toolId },
          {
            toolId,
            name: tool.name,
            title: tool.title,
            description: tool.description || '',
            inputSchema: tool.inputSchema,
            outputSchema: tool.outputSchema,
            serverId,
            mcpServerEndpoint: endpoint,
            isActive: true,
            lastSyncedAt: new Date()
          },
          {
            upsert: true,
            new: true
          }
        );
      }

      logger.info(
        { serverId, toolCount: tools.length },
        'Successfully synced tools from server'
      );

      return {
        serverId,
        success: true,
        toolsCount: tools.length
      };
    } catch (error) {
      logger.error(
        { err: error, serverId },
        'Failed to sync tools from server'
      );

      return {
        serverId,
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Remove tools for a specific server
   *
   * Called when a server is deleted from registry
   */
  async removeToolsForServer(serverId: string): Promise<number> {
    logger.info({ serverId }, 'Removing tools for server');

    const result = await MCPTool.deleteMany({ serverId });

    logger.info(
      { serverId, deletedCount: result.deletedCount },
      'Removed tools for server'
    );

    return result.deletedCount || 0;
  }

  /**
   * Mark tools as inactive for a server
   *
   * Alternative to deletion - preserves history
   */
  async deactivateToolsForServer(serverId: string): Promise<number> {
    logger.info({ serverId }, 'Deactivating tools for server');

    const result = await MCPTool.updateMany({ serverId }, { isActive: false });

    logger.info(
      { serverId, modifiedCount: result.modifiedCount },
      'Deactivated tools for server'
    );

    return result.modifiedCount || 0;
  }

  /**
   * Get sync status summary
   */
  async getSyncStatus(): Promise<{
    totalTools: number;
    activeTools: number;
    toolsByServer: Array<{
      serverId: string;
      count: number;
      lastSynced?: Date;
    }>;
    staleTools: number;
  }> {
    const totalTools = await MCPTool.countDocuments();
    const activeTools = await MCPTool.countDocuments({ isActive: true });

    // Tools by server
    const toolsByServer = await MCPTool.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$serverId',
          count: { $sum: 1 },
          lastSynced: { $max: '$lastSyncedAt' }
        }
      },
      {
        $project: {
          serverId: '$_id',
          count: 1,
          lastSynced: 1,
          _id: 0
        }
      }
    ]);

    // Stale tools (not synced in last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const staleTools = await MCPTool.countDocuments({
      lastSyncedAt: { $lt: oneHourAgo },
      isActive: true
    });

    return {
      totalTools,
      activeTools,
      toolsByServer,
      staleTools
    };
  }
}
```

**Key Features**:

- ✅ Syncs from all active MCP servers
- ✅ Upserts tools (update or insert)
- ✅ Handles per-server errors gracefully
- ✅ Namespaces toolId with serverId prefix
- ✅ Updates lastSyncedAt timestamp
- ✅ Methods for removal/deactivation
- ✅ Sync status summary

---

### Task 2: Create Unit Tests

**File**: `tests/unit/ToolAggregator.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import mongoose from 'mongoose';
import { ToolAggregator } from '../../src/services/ToolAggregator';
import { MCPClientManager } from '../../src/services/MCPClientManager';
import { MCPServer } from '../../src/models/MCPServer.model';
import { MCPTool } from '../../src/models/MCPTool.model';

describe('ToolAggregator', () => {
  let aggregator: ToolAggregator;
  let mockClientManager: MCPClientManager;

  beforeEach(async () => {
    await mongoose.connect('mongodb://localhost:27017/agent-gateway-test');
    await MCPServer.deleteMany({});
    await MCPTool.deleteMany({});

    mockClientManager = {
      listToolsFromServer: vi.fn()
    } as any;

    aggregator = new ToolAggregator(mockClientManager);
  });

  afterEach(async () => {
    await mongoose.connection.close();
  });

  describe('syncToolsFromServer', () => {
    it('should sync tools from server', async () => {
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

      vi.mocked(mockClientManager.listToolsFromServer).mockResolvedValue(
        mockTools
      );

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

    it('should handle sync errors', async () => {
      vi.mocked(mockClientManager.listToolsFromServer).mockRejectedValue(
        new Error('Connection failed')
      );

      const result = await aggregator.syncToolsFromServer(
        'failing-server',
        'http://localhost:9999/mcp'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection failed');
    });
  });

  describe('syncAllTools', () => {
    it('should sync from all active servers', async () => {
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
      vi.mocked(mockClientManager.listToolsFromServer)
        .mockResolvedValueOnce([
          {
            name: 'tool1',
            description: 'Tool 1',
            inputSchema: { type: 'object' }
          }
        ])
        .mockResolvedValueOnce([
          {
            name: 'tool2',
            description: 'Tool 2',
            inputSchema: { type: 'object' }
          }
        ]);

      const result = await aggregator.syncAllTools();

      expect(result.totalServers).toBe(2);
      expect(result.successfulServers).toBe(2);
      expect(result.totalToolsSynced).toBe(2);
    });
  });

  describe('removeToolsForServer', () => {
    it('should remove all tools for server', async () => {
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
  });

  describe('getSyncStatus', () => {
    it('should return sync status summary', async () => {
      // Create test tools
      await MCPTool.create([
        {
          toolId: 'server1:tool1',
          name: 'tool1',
          description: 'Test',
          inputSchema: { type: 'object' },
          serverId: 'server1',
          mcpServerEndpoint: 'http://localhost:8080/mcp',
          isActive: true
        },
        {
          toolId: 'server2:tool2',
          name: 'tool2',
          description: 'Test',
          inputSchema: { type: 'object' },
          serverId: 'server2',
          mcpServerEndpoint: 'http://localhost:8081/mcp',
          isActive: false
        }
      ]);

      const status = await aggregator.getSyncStatus();

      expect(status.totalTools).toBe(2);
      expect(status.activeTools).toBe(1);
      expect(status.toolsByServer).toHaveLength(1);
    });
  });
});
```

---

## Validation

### Level 1: Unit Tests

```bash
npm test tests/unit/ToolAggregator.test.ts
```

**Expected**: All tests pass

### Level 2: Manual Test with Real MCP Server

```typescript
// test-tool-sync.ts
import { ToolAggregator } from './src/services/ToolAggregator';
import { MCPClientManager } from './src/services/MCPClientManager';
import { MCPServer } from './src/models/MCPServer.model';
import { MCPTool } from './src/models/MCPTool.model';
import mongoose from 'mongoose';

async function test() {
  await mongoose.connect('mongodb://localhost:27017/agent-gateway');

  // Create test server
  const server = await MCPServer.create({
    serverId: 'test-mcp',
    name: 'Test MCP Server',
    description: 'Test',
    endpoint: 'http://localhost:8080/mcp',
    isActive: true
  });

  const clientManager = new MCPClientManager();
  await clientManager.connectToServer(server);

  const aggregator = new ToolAggregator(clientManager);

  // Sync tools
  console.log('Syncing tools...');
  const result = await aggregator.syncAllTools();
  console.log('Sync result:', result);

  // Check database
  const tools = await MCPTool.find({ serverId: 'test-mcp' });
  console.log('Tools in DB:', tools.length);
  tools.forEach((t) => console.log(`  - ${t.toolId}: ${t.name}`));

  // Get sync status
  const status = await aggregator.getSyncStatus();
  console.log('Sync status:', status);

  await clientManager.shutdown();
  await mongoose.connection.close();
}

test();
```

---

## Known Gotchas

### 1. Tool ID Namespacing

- Prefix toolId with serverId to avoid conflicts
- Format: `serverId:toolName` (e.g., "weather-mcp:get_current")
- This must match format expected in JWT allowedTools

### 2. Upsert vs Insert

- Use `findOneAndUpdate` with `upsert: true`
- Updates existing tools, inserts new ones
- Preserves tool history

### 3. Error Handling Per Server

- Don't fail entire sync if one server fails
- Return success/failure status for each server
- Log errors but continue with other servers

### 4. Sync Frequency

- Balance freshness vs load
- Consider scheduled sync (e.g., every 5 minutes)
- Allow manual sync trigger

### 5. Large Tool Sets

- Use bulk operations for performance
- Consider pagination if tool count is very large
- Monitor database write load

---

## Next Steps

After completing this PRP:

1. ✅ ToolAggregator service created
2. ✅ Can sync tools from all MCP servers
3. ✅ Tools cached in MCPTool collection
4. ✅ Handles errors gracefully
5. ✅ Unit tests passing

**Proceed to**: [PRP 06: Management REST API](./06-management-rest-api.md)

---

## Checklist

- [ ] ToolAggregator service created with TypeDI
- [ ] syncAllTools() syncs from all active servers
- [ ] syncToolsFromServer() upserts tools
- [ ] Error handling per server
- [ ] removeToolsForServer() implemented
- [ ] getSyncStatus() returns summary
- [ ] Tool IDs namespaced correctly
- [ ] Unit tests pass (80%+ coverage)
- [ ] Manual test with real MCP server successful

---

**Status**: 🟢 Ready for Implementation
**Estimated Time**: 1 day
**Dependencies**: PRP 02, PRP 04
**Next PRP**: 06 - Management REST API
