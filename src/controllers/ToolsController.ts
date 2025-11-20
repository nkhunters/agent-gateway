import {
  JsonController,
  Get,
  Post,
  Body,
  QueryParam,
  HttpCode,
  UseBefore,
  Req
} from 'routing-controllers';
import { Service } from 'typedi';
import { MCPTool } from '../models/MCPTool.model';
import { MCPServer } from '../models/MCPServer.model';
import { ToolAggregator } from '../services/ToolAggregator';
import { SyncToolsDto } from '../dto/SyncToolsDto';
import { AuthMiddleware } from '../middlewares/AuthMiddleware';
import { AuthenticatedRequest } from '../types/AuthenticatedRequest';
import { logger } from '../utils/logger';

/**
 * Tools Controller
 *
 * View and manage tool catalog
 */
@Service()
@JsonController('/tools')
@UseBefore(AuthMiddleware)
export class ToolsController {
  constructor(private toolAggregator: ToolAggregator) {}

  /**
   * GET /api/tools
   * List all tools in catalog
   */
  @Get('/')
  async list(
    @Req() request: AuthenticatedRequest,
    @QueryParam('serverId') serverId?: string,
    @QueryParam('active') active?: string
  ) {
    logger.debug({ userId: request.user!.sub, serverId }, 'Listing tools');

    const query: any = {};

    if (serverId) {
      query.serverId = serverId;
    }

    if (active === 'true') {
      query.isActive = true;
    } else if (active === 'false') {
      query.isActive = false;
    }

    const tools = await MCPTool.find(query).sort({ serverId: 1, name: 1 });

    return {
      tools: tools.map((t) => t.toJSON()),
      totalCount: tools.length
    };
  }

  /**
   * POST /api/tools/sync
   * Manually trigger tool synchronization
   */
  @Post('/sync')
  @HttpCode(200)
  async sync(@Body() dto: SyncToolsDto, @Req() request: AuthenticatedRequest) {
    logger.info(
      { userId: request.user!.sub, serverId: dto.serverId },
      'Triggering tool sync'
    );

    if (dto.serverId) {
      // Sync specific server
      const server = await MCPServer.findByServerId(dto.serverId);

      if (!server) {
        return {
          error: 'Not found',
          message: `Server '${dto.serverId}' not found`
        };
      }

      const result = await this.toolAggregator.syncToolsFromServer(
        server.serverId,
        server.endpoint
      );

      return {
        success: result.success,
        serverId: dto.serverId,
        toolsSynced: result.toolsCount,
        error: result.error
      };
    } else {
      // Sync all servers
      const result = await this.toolAggregator.syncAllTools();

      return {
        success: true,
        totalServers: result.totalServers,
        successfulServers: result.successfulServers,
        failedServers: result.failedServers,
        toolsSynced: result.totalToolsSynced,
        results: result.results
      };
    }
  }

  /**
   * GET /api/tools/status
   * Get sync status summary
   */
  @Get('/status')
  async getStatus(@Req() request: AuthenticatedRequest) {
    logger.debug({ userId: request.user!.sub }, 'Getting sync status');

    const status = await this.toolAggregator.getSyncStatus();

    return status;
  }
}
