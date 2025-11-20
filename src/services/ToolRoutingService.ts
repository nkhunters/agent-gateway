import { Service } from 'typedi';
import { MCPClientManager } from './MCPClientManager';
import { MCPTool } from '../models/MCPTool.model';
import { logger } from '../utils/logger';

/**
 * Tool execution result
 *
 * Follows MCP specification for tool call responses
 */
export interface ToolExecutionResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    uri?: string;
    blob?: string;
  }>;
  isError?: boolean;
}

/**
 * Tool Routing Service
 *
 * Routes tool execution requests to appropriate backend MCP servers:
 * 1. Looks up tool in database to find serverId
 * 2. Checks if backend server is connected
 * 3. Executes tool via MCPClientManager with timeout
 * 4. Formats response in MCP format
 *
 * Part of PRP 08: Tool Routing & Execution
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
   * - "toolName" → { serverId: '', toolName }
   *
   * For non-namespaced tools, serverId is looked up from database
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
    // serverId will be looked up from database
    return {
      serverId: '',
      toolName: toolId
    };
  }

  /**
   * Format MCP response
   *
   * Converts backend MCP server response to standard MCP format:
   * - If already in MCP format (has content array), return as-is
   * - If string, wrap in text content
   * - If object, JSON stringify and wrap in text content
   */
  private formatMCPResponse(result: any): ToolExecutionResult {
    // If result already in MCP format, return as-is
    if (result.content && Array.isArray(result.content)) {
      return result as ToolExecutionResult;
    }

    // If result is a simple string, wrap in content array
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
   *
   * @param toolId - Tool identifier
   * @returns true if tool exists and its server is connected
   */
  async isToolAvailable(toolId: string): Promise<boolean> {
    const tool = await MCPTool.findOne({ toolId, isActive: true });

    if (!tool) {
      return false;
    }

    return this.mcpClientManager.isConnected(tool.serverId);
  }
}
