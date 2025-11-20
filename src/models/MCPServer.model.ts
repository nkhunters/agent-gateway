import mongoose, { Schema, model, HydratedDocument, Model } from 'mongoose';

/**
 * Interface for MCP Server document
 *
 * Represents a backend MCP server registered in the gateway
 */
export interface IMCPServer {
  serverId: string; // Unique identifier (e.g., "weather-mcp", "calculator-mcp")
  name: string; // Human-readable name
  description: string; // What this server provides
  endpoint: string; // HTTPStream URL (e.g., "http://localhost:8080/mcp")
  isActive: boolean; // Enable/disable server
  healthCheckUrl?: string; // Optional health check endpoint
  lastHealthCheck?: Date; // Last successful health check
  metadata?: Map<string, any>; // Additional server metadata
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Instance methods interface
 */
export interface IMCPServerMethods {
  isHealthy(): boolean;
}

/**
 * Static methods interface
 */
export interface IMCPServerModel
  extends Model<IMCPServer, {}, IMCPServerMethods> {
  findActive(): Promise<MCPServerDocument[]>;
  findByServerId(serverId: string): Promise<MCPServerDocument | null>;
}

/**
 * Mongoose schema for MCP Server
 */
const mcpServerSchema = new Schema<
  IMCPServer,
  IMCPServerModel,
  IMCPServerMethods
>(
  {
    serverId: {
      type: String,
      required: [true, 'serverId is required'],
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
      match: [
        /^[a-z0-9-]+$/,
        'serverId must contain only lowercase letters, numbers, and hyphens'
      ]
    },
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true,
      minlength: [3, 'name must be at least 3 characters'],
      maxlength: [100, 'name must be less than 100 characters']
    },
    description: {
      type: String,
      required: [true, 'description is required'],
      trim: true,
      maxlength: [500, 'description must be less than 500 characters']
    },
    endpoint: {
      type: String,
      required: [true, 'endpoint is required'],
      trim: true,
      validate: {
        validator: function (v: string) {
          try {
            const url = new URL(v);
            return url.protocol === 'http:' || url.protocol === 'https:';
          } catch {
            return false;
          }
        },
        message: 'endpoint must be a valid HTTP/HTTPS URL'
      }
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    healthCheckUrl: {
      type: String,
      required: false,
      trim: true
    },
    lastHealthCheck: {
      type: Date,
      required: false
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      required: false
    }
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
    collection: 'mcp_servers'
  }
);

// Compound index for efficient active server queries
mcpServerSchema.index({ isActive: 1, createdAt: -1 });

/**
 * Instance methods
 */
mcpServerSchema.methods = {
  /**
   * Check if server is healthy
   */
  isHealthy(): boolean {
    if (!this.lastHealthCheck) return false;

    // Consider healthy if checked within last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return this.lastHealthCheck > fiveMinutesAgo;
  }
};

/**
 * Static methods
 */
mcpServerSchema.statics = {
  /**
   * Find all active servers
   */
  async findActive(): Promise<MCPServerDocument[]> {
    return this.find({ isActive: true }).sort({ createdAt: -1 });
  },

  /**
   * Find server by serverId
   */
  async findByServerId(serverId: string): Promise<MCPServerDocument | null> {
    return this.findOne({ serverId: serverId.toLowerCase() });
  }
};

/**
 * Pre-save hook: Convert serverId to lowercase
 */
mcpServerSchema.pre('save', function (next) {
  if (this.isModified('serverId')) {
    this.serverId = this.serverId.toLowerCase();
  }
  next();
});

/**
 * toJSON transformation: Remove __v and _id, add id
 */
mcpServerSchema.set('toJSON', {
  transform: function (doc, ret: any) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

// Export types and model
export type MCPServerDocument = HydratedDocument<IMCPServer, IMCPServerMethods>;
export const MCPServer =
  mongoose?.models?.MCPServer ||
  model<IMCPServer, IMCPServerModel>('MCPServer', mcpServerSchema);
