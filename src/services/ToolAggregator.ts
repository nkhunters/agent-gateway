import { Service, Container } from 'typedi';
import { MCPClientManager } from './MCPClientManager';
import { MCPTool } from '../models/MCPTool.model';
import { MCPServer } from '../models/MCPServer.model';
import { logger } from '../utils/logger';

/**
 * Sync result for a single server
 */
export interface ServerSyncResult {
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
  constructor(private mcpClientManager: MCPClientManager) {
    this.mcpClientManager = Container.get(MCPClientManager);
  }

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
