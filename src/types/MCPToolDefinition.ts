/**
 * MCP Tool Definition
 *
 * Follows MCP specification for tool structure
 * Reference: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
 */
export interface MCPToolDefinition {
  name: string;
  title?: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, any>;
    required?: string[];
    [key: string]: any;
  };
}

/**
 * MCP Tool Call Request
 */
export interface MCPToolCallRequest {
  name: string;
  arguments?: Record<string, any>;
}

/**
 * MCP Tool Call Response
 */
export interface MCPToolCallResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}
