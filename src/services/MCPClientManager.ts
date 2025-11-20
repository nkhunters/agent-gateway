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
      logger.error(
        { err: error, serverId },
        'Error disconnecting from MCP server'
      );
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
  getConnectionStatus(
    serverId: string
  ): 'connected' | 'disconnected' | 'error' | 'unknown' {
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
  async listAllTools(): Promise<
    Array<{ serverId: string; endpoint: string; tools: any[] }>
  > {
    const allTools: Array<{
      serverId: string;
      endpoint: string;
      tools: any[];
    }> = [];

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
  async callTool(serverId: string, toolName: string, args: any): Promise<any> {
    const client = this.getClient(serverId);

    if (!client) {
      throw new Error(`No active connection to server: ${serverId}`);
    }

    try {
      logger.debug({ serverId, toolName, args }, 'Calling tool on MCP server');

      const result = await client.callTool({
        name: toolName,
        arguments: args
      });

      logger.info({ serverId, toolName }, 'Tool call successful');

      return result;
    } catch (error) {
      logger.error({ err: error, serverId, toolName }, 'Tool call failed');

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
        logger.warn({ err: error, serverId }, 'Health check failed for server');
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
      logger.warn({ serverId, attempts }, 'Max reconnection attempts reached');
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
        logger.error({ err: error, serverId }, 'Reconnection attempt failed');
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
    return Array.from(this.connections.values()).map((conn) => ({
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
