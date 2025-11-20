import {
  JsonController,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  UseBefore,
  Req
} from 'routing-controllers';
import Container from 'typedi';
import { MCPServer } from '../models/MCPServer.model';
import { MCPClientManager } from '../services/MCPClientManager';
import { ToolAggregator } from '../services/ToolAggregator';
import { RegisterMCPServerDto } from '../dto/RegisterMCPServerDto';
import { AuthMiddleware } from '../middlewares/AuthMiddleware';
import { AuthenticatedRequest } from '../types/AuthenticatedRequest';
import { logger } from '../utils/logger';

/**
 * MCP Servers Controller
 *
 * Manages backend MCP server registry
 */
@UseBefore(AuthMiddleware)
@JsonController('/mcp-servers')
export class MCPServersController {
  constructor(
    private mcpClientManager: MCPClientManager,
    private toolAggregator: ToolAggregator
  ) {
    this.mcpClientManager = Container.get(MCPClientManager);
    this.toolAggregator = Container.get(ToolAggregator);
  }

  /**
   * POST /api/mcp-servers
   * Register new backend MCP server
   */
  @Post('/')
  @HttpCode(201)
  async register(
    @Body() dto: RegisterMCPServerDto,
    @Req() request: AuthenticatedRequest
  ) {
    logger.info(
      { serverId: dto.serverId, userId: request.user!.sub },
      'Registering new MCP server'
    );

    // Check if server already exists
    const existing = await MCPServer.findByServerId(dto.serverId);
    if (existing) {
      return {
        error: 'Server already exists',
        message: `Server with ID '${dto.serverId}' already registered`
      };
    }

    // Create server
    const server = await MCPServer.create({
      serverId: dto.serverId,
      name: dto.name,
      description: dto.description,
      endpoint: dto.endpoint,
      healthCheckUrl: dto.healthCheckUrl,
      isActive: true
    });

    // Connect to server
    try {
      await this.mcpClientManager.connectToServer(server);

      // Sync tools immediately
      await this.toolAggregator.syncToolsFromServer(
        server.serverId,
        server.endpoint
      );

      logger.info(
        { serverId: server.serverId },
        'MCP server registered and connected'
      );

      return {
        success: true,
        server: server.toJSON()
      };
    } catch (error) {
      logger.error(
        { err: error, serverId: server.serverId },
        'Failed to connect to newly registered server'
      );

      return {
        success: true,
        server: server.toJSON(),
        warning:
          'Server registered but connection failed. Will retry automatically.'
      };
    }
  }

  /**
   * GET /api/mcp-servers
   * List all registered MCP servers
   */
  @Get('/')
  async list(@Req() request: AuthenticatedRequest) {
    logger.debug({ userId: request.user!.sub }, 'Listing MCP servers');

    const servers = await MCPServer.find().sort({ createdAt: -1 });

    // Get connection statuses
    const serversWithStatus = servers.map((server) => ({
      ...server.toJSON(),
      connectionStatus: this.mcpClientManager.getConnectionStatus(
        server.serverId
      ),
      isHealthy: server.isHealthy()
    }));

    return {
      servers: serversWithStatus,
      totalCount: servers.length
    };
  }

  /**
   * GET /api/mcp-servers/:serverId
   * Get specific server details
   */
  @Get('/:serverId')
  async getOne(
    @Param('serverId') serverId: string,
    @Req() request: AuthenticatedRequest
  ) {
    logger.debug(
      { serverId, userId: request.user!.sub },
      'Getting MCP server details'
    );

    const server = await MCPServer.findByServerId(serverId);

    if (!server) {
      return {
        error: 'Not found',
        message: `Server '${serverId}' not found`
      };
    }

    return {
      server: {
        ...server.toJSON(),
        connectionStatus: this.mcpClientManager.getConnectionStatus(serverId),
        isHealthy: server.isHealthy()
      }
    };
  }

  /**
   * DELETE /api/mcp-servers/:serverId
   * Remove MCP server from registry
   */
  @Delete('/:serverId')
  @HttpCode(200)
  async remove(
    @Param('serverId') serverId: string,
    @Req() request: AuthenticatedRequest
  ) {
    logger.info({ serverId, userId: request.user!.sub }, 'Removing MCP server');

    const server = await MCPServer.findByServerId(serverId);

    if (!server) {
      return {
        error: 'Not found',
        message: `Server '${serverId}' not found`
      };
    }

    // Disconnect from server
    await this.mcpClientManager.disconnectFromServer(serverId);

    // Remove tools for this server
    const toolsRemoved = await this.toolAggregator.removeToolsForServer(
      serverId
    );

    // Delete server
    await server.deleteOne();

    logger.info({ serverId, toolsRemoved }, 'MCP server removed');

    return {
      success: true,
      message: `Server '${serverId}' removed`,
      toolsRemoved
    };
  }

  /**
   * POST /api/mcp-servers/:serverId/reconnect
   * Manually trigger reconnection
   */
  @Post('/:serverId/reconnect')
  @HttpCode(200)
  async reconnect(
    @Param('serverId') serverId: string,
    @Req() request: AuthenticatedRequest
  ) {
    logger.info(
      { serverId, userId: request.user!.sub },
      'Reconnecting to MCP server'
    );

    const server = await MCPServer.findByServerId(serverId);

    if (!server) {
      return {
        error: 'Not found',
        message: `Server '${serverId}' not found`
      };
    }

    try {
      // Disconnect first
      await this.mcpClientManager.disconnectFromServer(serverId);

      // Reconnect
      await this.mcpClientManager.connectToServer(server);

      // Sync tools after reconnection
      await this.toolAggregator.syncToolsFromServer(
        server.serverId,
        server.endpoint
      );

      return {
        success: true,
        message: 'Reconnected successfully and tools synced'
      };
    } catch (error) {
      logger.error({ err: error, serverId }, 'Reconnection failed');

      return {
        success: false,
        error: (error as Error).message
      };
    }
  }
}
