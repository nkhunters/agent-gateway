import { Service, Container } from 'typedi';
import { z } from 'zod';
import { TokenValidationService } from './TokenValidationService';
import { ToolRoutingService } from './ToolRoutingService';
import { MCPTool } from '../models/MCPTool.model';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { TokenPayload } from '../types/TokenPayload';
import { FastMCP } from 'fastmcp';
/**
 * Universal MCP Server
 *
 * Stateless MCP server that provides token-based access control:
 * 1. Validates JWT tokens on each request (stateless operation)
 * 2. Filters tools based on allowedTools in token payload
 * 3. Routes tool execution to backend MCP servers via ToolRoutingService
 *
 * Uses FastMCP with HTTPStream in stateless mode for serverless compatibility.
 *
 * Part of PRP 07: Universal MCP Server
 */
@Service()
export class UniversalMCPServer {
  private server: any | null = null;
  private isRunning: boolean = false;

  constructor(
    private tokenValidationService: TokenValidationService,
    private toolRoutingService: ToolRoutingService
  ) {
    this.tokenValidationService = Container.get(TokenValidationService);
    this.toolRoutingService = Container.get(ToolRoutingService);
  }

  /**
   * Start the Universal MCP Server
   *
   * Loads all tools from database and registers them with FastMCP.
   * Each tool includes a canAccess callback that checks allowedTools in auth.
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Universal MCP Server already running');
      return;
    }

    try {
      logger.info('Starting Universal MCP Server');

      // Create FastMCP server with authentication
      this.server = new FastMCP<TokenPayload>({
        name: 'agent-gateway-universal',
        version: '1.0.0',
        authenticate: async (request) => {
          const payload = await this.authenticateRequest(request);
          await this.loadAndRegisterTools(payload);
          return payload;
        },
        logger: logger as any, // Use our pino logger
        health: {
          enabled: true,
          path: '/health',
          status: 200,
          message: 'healthy'
        }
      });

      // Load and register all tools

      // Start server with HTTPStream stateless mode
      await this.server.start({
        transportType: 'httpStream',
        httpStream: {
          port: env.UNIVERSAL_MCP_PORT,
          endpoint: '/mcp',
          stateless: true // Stateless mode - no session persistence
        }
      });

      this.isRunning = true;

      logger.info(
        {
          port: env.UNIVERSAL_MCP_PORT,
          endpoint: '/mcp',
          mode: 'stateless'
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

      await this.server.stop();

      this.isRunning = false;
      this.server = null;

      logger.info('Universal MCP Server stopped');
    } catch (error) {
      logger.error({ err: error }, 'Error stopping Universal MCP Server');
      throw error;
    }
  }

  /**
   * Authenticate request (stateless)
   *
   * Extracts JWT from Authorization header and validates via identity-service.
   * Returns token payload for use in tool authorization.
   *
   * @throws Response with 401 if authentication fails
   */
  private async authenticateRequest(request: any): Promise<TokenPayload> {
    try {
      // Extract Authorization header
      const authHeader = request.headers?.authorization;

      if (!authHeader) {
        logger.warn('Missing authorization header');
        throw new Response(null, {
          status: 401,
          statusText: 'Missing authorization header'
        });
      }

      // Extract token
      const token =
        this.tokenValidationService.extractTokenFromHeader(authHeader);

      if (!token) {
        logger.warn('Invalid authorization format');
        throw new Response(null, {
          status: 401,
          statusText: 'Invalid authorization format'
        });
      }

      // Validate token via identity-service
      try {
        const payload = await this.tokenValidationService.validateToken(token);

        logger.debug(
          {
            clientId: payload.sub,
            allowedToolsCount: payload.allowedTools.length
          },
          'Token validated successfully'
        );

        return payload;
      } catch (error: any) {
        if (error.message.includes('unavailable')) {
          logger.error('Identity service unavailable');
          throw new Response(null, {
            status: 503,
            statusText: 'Authentication service unavailable'
          });
        }

        logger.warn({ err: error }, 'Token validation failed');
        throw new Response(null, {
          status: 401,
          statusText: 'Invalid or expired token'
        });
      }
    } catch (error) {
      // Re-throw Response objects (FastMCP expects these)
      if (error instanceof Response) {
        throw error;
      }

      // Convert other errors to Response
      logger.error({ err: error }, 'Authentication error');
      throw new Response(null, {
        status: 500,
        statusText: 'Internal authentication error'
      });
    }
  }

  /**
   * Load and register all tools from database
   *
   * For each tool:
   * 1. Convert inputSchema to Zod schema
   * 2. Add canAccess callback checking auth.allowedTools
   * 3. Register execute function routing to ToolRoutingService
   */
  private async loadAndRegisterTools(payload: TokenPayload): Promise<void> {
    try {
      // Query all active tools from database
      const tools = await MCPTool.find({
        toolId: { $in: payload?.allowedTools },
        isActive: true
      });

      logger.info({ toolCount: tools.length }, 'Loading tools from database');

      for (const tool of tools) {
        try {
          // Convert JSON Schema to Zod schema
          const parameters = this.convertJSONSchemaToZod(tool.inputSchema);

          // Register tool with FastMCP
          this.server!.addTool({
            name: tool.toolId,
            description: tool.description || `Tool: ${tool.name}`,
            parameters,
            // Authorization: check if toolId in allowedTools
            canAccess: (auth: TokenPayload) => {
              if (!auth || !auth.allowedTools) {
                return false;
              }
              return auth.allowedTools.includes(tool.toolId);
            },
            // Execution: route to backend MCP server
            execute: async (args: any) => {
              logger.debug(
                { toolId: tool.toolId, args },
                'Executing tool via routing service'
              );

              const result = await this.toolRoutingService.routeToolCall(
                tool.toolId,
                args
              );

              // Return text content or full result
              if (result.isError) {
                throw new Error(
                  result.content[0].text || 'Tool execution failed'
                );
              }

              // Return just the text if single text content
              if (
                result.content.length === 1 &&
                result.content[0].type === 'text'
              ) {
                return result.content[0].text || '';
              }

              // Return content result (FastMCP expects this format)
              return {
                content: result.content as any
              };
            }
          });

          logger.debug({ toolId: tool.toolId }, 'Tool registered');
        } catch (error) {
          logger.error(
            { err: error, toolId: tool.toolId },
            'Failed to register tool'
          );
          // Continue registering other tools
        }
      }

      logger.info(
        { toolsRegistered: tools.length },
        'All tools registered successfully'
      );
    } catch (error) {
      logger.error({ err: error }, 'Failed to load tools from database');
      throw error;
    }
  }

  /**
   * Convert JSON Schema to Zod schema
   *
   * Basic conversion supporting common types:
   * - object → z.object()
   * - string → z.string()
   * - number → z.number()
   * - boolean → z.boolean()
   * - array → z.array()
   *
   * For complex schemas, defaults to z.any()
   */
  private convertJSONSchemaToZod(schema: any): z.ZodType {
    try {
      // Handle empty/undefined schema
      if (!schema || !schema.type) {
        return z.object({});
      }

      // Handle object type
      if (schema.type === 'object') {
        const properties = schema.properties || {};
        const required = schema.required || [];

        const zodShape: Record<string, z.ZodType> = {};

        for (const [key, propSchema] of Object.entries(properties)) {
          const propZod = this.convertJSONSchemaToZod(propSchema);
          zodShape[key] = required.includes(key) ? propZod : propZod.optional();
        }

        return z.object(zodShape);
      }

      // Handle primitive types
      switch (schema.type) {
        case 'string':
          return z.string();
        case 'number':
        case 'integer':
          return z.number();
        case 'boolean':
          return z.boolean();
        case 'array':
          return z.array(
            schema.items ? this.convertJSONSchemaToZod(schema.items) : z.any()
          );
        default:
          logger.warn(
            { schemaType: schema.type },
            'Unsupported schema type, defaulting to z.any()'
          );
          return z.any();
      }
    } catch (error) {
      logger.warn(
        { err: error, schema },
        'Schema conversion failed, defaulting to z.any()'
      );
      return z.any();
    }
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
    mode?: string;
  } {
    return {
      isRunning: this.isRunning,
      port: this.isRunning ? env.UNIVERSAL_MCP_PORT : undefined,
      endpoint: this.isRunning ? '/mcp' : undefined,
      mode: this.isRunning ? 'stateless' : undefined
    };
  }

  /**
   * Reload tools from database
   *
   * Useful for picking up new tools added via Management API.
   * Note: Requires server restart to take effect.
   */
  async reloadTools(): Promise<void> {
    if (!this.isRunning || !this.server) {
      throw new Error('Server not running');
    }

    logger.info('Reloading tools...');

    // FastMCP doesn't support removing tools, so we need to restart
    await this.stop();
    await this.start();

    logger.info('Tools reloaded successfully');
  }
}
