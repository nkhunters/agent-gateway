import mongoose, {
  Schema,
  model,
  HydratedDocument,
  Model,
  models
} from 'mongoose';

/**
 * Interface for MCP Tool document
 *
 * Cached tool definition from backend MCP servers
 */
export interface IMCPTool {
  toolId: string; // Unique identifier (matches allowedTools in JWT)
  name: string; // Tool name
  title?: string; // Human-readable title (optional)
  description: string; // What the tool does
  inputSchema: object; // JSON Schema for tool parameters
  outputSchema?: object; // Optional output schema
  serverId: string; // Which MCP server provides this tool
  mcpServerEndpoint: string; // Endpoint to call (denormalized for performance)
  isActive: boolean; // Enable/disable tool
  lastSyncedAt: Date; // Last sync from MCP server
  metadata?: Map<string, any>; // Additional tool metadata
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Instance methods interface
 */
export interface IMCPToolMethods {
  isSyncStale(): boolean;
  toMCPFormat(): {
    name: string;
    title?: string;
    description: string;
    inputSchema: object;
    outputSchema?: object;
  };
}

/**
 * Static methods interface
 */
export interface IMCPToolModel extends Model<IMCPTool, {}, IMCPToolMethods> {
  findActive(): Promise<MCPToolDocument[]>;
  findByServerId(serverId: string): Promise<MCPToolDocument[]>;
  findByToolIds(toolIds: string[]): Promise<MCPToolDocument[]>;
  findStale(): Promise<MCPToolDocument[]>;
}

/**
 * Mongoose schema for MCP Tool
 */
const mcpToolSchema = new Schema<IMCPTool, IMCPToolModel, IMCPToolMethods>(
  {
    toolId: {
      type: String,
      required: [true, 'toolId is required'],
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
      match: [
        /^[a-z0-9-_:]+$/,
        'toolId must contain only lowercase letters, numbers, hyphens, underscores, and colons'
      ]
    },
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true,
      index: true
    },
    title: {
      type: String,
      required: false,
      trim: true
    },
    description: {
      type: String,
      required: [true, 'description is required'],
      trim: true,
      maxlength: [1000, 'description must be less than 1000 characters']
    },
    inputSchema: {
      type: Schema.Types.Mixed,
      required: [true, 'inputSchema is required'],
      validate: {
        validator: function (v: any) {
          // Must be an object with at least a 'type' property
          return v && typeof v === 'object' && v.type === 'object';
        },
        message: 'inputSchema must be a valid JSON Schema object'
      }
    },
    outputSchema: {
      type: Schema.Types.Mixed,
      required: false
    },
    serverId: {
      type: String,
      required: [true, 'serverId is required'],
      index: true,
      trim: true,
      lowercase: true
    },
    mcpServerEndpoint: {
      type: String,
      required: [true, 'mcpServerEndpoint is required'],
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    lastSyncedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      required: false
    }
  },
  {
    timestamps: true,
    collection: 'mcp_tools'
  }
);

// Compound indexes for efficient queries
mcpToolSchema.index({ serverId: 1, isActive: 1 });
mcpToolSchema.index({ isActive: 1, lastSyncedAt: -1 });
mcpToolSchema.index({ toolId: 1, isActive: 1 });

/**
 * Instance methods
 */
mcpToolSchema.methods = {
  /**
   * Check if tool sync is stale (> 1 hour old)
   */
  isSyncStale(): boolean {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return this.lastSyncedAt < oneHourAgo;
  },

  /**
   * Get MCP tool definition format
   */
  toMCPFormat(): {
    name: string;
    title?: string;
    description: string;
    inputSchema: object;
    outputSchema?: object;
  } {
    return {
      name: this.name,
      ...(this.title && { title: this.title }),
      description: this.description,
      inputSchema: this.inputSchema,
      ...(this.outputSchema && { outputSchema: this.outputSchema })
    };
  }
};

/**
 * Static methods
 */
mcpToolSchema.statics = {
  /**
   * Find all active tools
   */
  async findActive(): Promise<MCPToolDocument[]> {
    return this.find({ isActive: true }).sort({ name: 1 });
  },

  /**
   * Find tools by serverId
   */
  async findByServerId(serverId: string): Promise<MCPToolDocument[]> {
    return this.find({
      serverId: serverId.toLowerCase(),
      isActive: true
    }).sort({ name: 1 });
  },

  /**
   * Find tools by toolIds (for filtering by allowedTools)
   */
  async findByToolIds(toolIds: string[]): Promise<MCPToolDocument[]> {
    const lowerCaseIds = toolIds.map((id) => id.toLowerCase());
    return this.find({
      toolId: { $in: lowerCaseIds },
      isActive: true
    }).sort({ name: 1 });
  },

  /**
   * Find stale tools (not synced in last hour)
   */
  async findStale(): Promise<MCPToolDocument[]> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return this.find({
      lastSyncedAt: { $lt: oneHourAgo },
      isActive: true
    });
  }
};

/**
 * Pre-save hook: Convert toolId and serverId to lowercase
 */
mcpToolSchema.pre('save', function (next) {
  if (this.isModified('toolId')) {
    this.toolId = this.toolId.toLowerCase();
  }
  if (this.isModified('serverId')) {
    this.serverId = this.serverId.toLowerCase();
  }
  next();
});

/**
 * toJSON transformation
 */
mcpToolSchema.set('toJSON', {
  transform: function (doc, ret: any) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

// Export types and model
export type MCPToolDocument = HydratedDocument<IMCPTool, IMCPToolMethods>;
export const MCPTool =
  mongoose?.models?.MCPTool ||
  model<IMCPTool, IMCPToolModel>('MCPTool', mcpToolSchema);
