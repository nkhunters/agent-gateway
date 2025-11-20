# PRP 02: Database Models & Tool Registry

## Goal

Create Mongoose database models for the Agent Gateway's core data structures: MCP Server registry and Tool catalog. These models will store backend MCP server configurations and cached tool definitions.

## Why

- **MCP Server Registry**: Track all registered backend MCP servers with their endpoints and status
- **Tool Catalog**: Cache tool definitions from all servers for fast lookups and filtering
- **Performance**: Proper indexes enable efficient queries when filtering tools by allowedTools
- **Data Integrity**: Mongoose schemas enforce validation and consistency

## What

### Deliverables
1. ✅ MCPServer model with Mongoose schema
2. ✅ MCPTool model with Mongoose schema
3. ✅ Database indexes for performance
4. ✅ Validation rules
5. ✅ Unit tests for models

### Success Criteria
- [ ] Models compile without TypeScript errors
- [ ] Can create, read, update, delete MCPServer documents
- [ ] Can create, read, update, delete MCPTool documents
- [ ] Indexes created automatically
- [ ] Validation prevents invalid data
- [ ] Unit tests pass (80%+ coverage)

## Context & References

### Identity Service Pattern
- **Model Reference**: `/Users/avinashkumar/Desktop/identity-service/src/models/Application.model.ts:1-40`
- Pattern: HydratedDocument<T>, no Document extension, timestamps: true

### Mongoose TypeScript Guide
- Documentation: https://mongoosejs.com/docs/typescript.html
- Use `Schema<IInterface>` generic pattern
- Use `HydratedDocument<IInterface>` for document types
- Don't extend Document interface

### Data Requirements
- MCPServer: Store backend MCP server configurations
- MCPTool: Cache tool definitions with server mappings

## Implementation Tasks

### Task 1: Create MCPServer Model

**File**: `src/models/MCPServer.model.ts`

**Purpose**: Registry of backend MCP servers

```typescript
import { Schema, model, HydratedDocument } from 'mongoose';

/**
 * Interface for MCP Server document
 *
 * Represents a backend MCP server registered in the gateway
 */
export interface IMCPServer {
  serverId: string;           // Unique identifier (e.g., "weather-mcp", "calculator-mcp")
  name: string;               // Human-readable name
  description: string;        // What this server provides
  endpoint: string;           // HTTPStream URL (e.g., "http://localhost:8080/mcp")
  isActive: boolean;          // Enable/disable server
  healthCheckUrl?: string;    // Optional health check endpoint
  lastHealthCheck?: Date;     // Last successful health check
  metadata?: Map<string, any>; // Additional server metadata
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mongoose schema for MCP Server
 */
const mcpServerSchema = new Schema<IMCPServer>(
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
        validator: function(v: string) {
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
mcpServerSchema.pre('save', function(next) {
  if (this.isModified('serverId')) {
    this.serverId = this.serverId.toLowerCase();
  }
  next();
});

/**
 * toJSON transformation: Remove __v and _id, add id
 */
mcpServerSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

// Export types and model
export type MCPServerDocument = HydratedDocument<IMCPServer>;
export const MCPServer = model<IMCPServer>('MCPServer', mcpServerSchema);
```

**Key Features**:
- ✅ Unique serverId with validation (lowercase, alphanumeric + hyphens)
- ✅ Endpoint URL validation
- ✅ isActive flag for enable/disable
- ✅ Optional health check tracking
- ✅ Metadata map for extensibility
- ✅ Indexes for performance
- ✅ Instance method: isHealthy()
- ✅ Static methods: findActive(), findByServerId()
- ✅ toJSON transformation

---

### Task 2: Create MCPTool Model

**File**: `src/models/MCPTool.model.ts`

**Purpose**: Cache of tool definitions from all MCP servers

```typescript
import { Schema, model, HydratedDocument } from 'mongoose';

/**
 * Interface for MCP Tool document
 *
 * Cached tool definition from backend MCP servers
 */
export interface IMCPTool {
  toolId: string;               // Unique identifier (matches allowedTools in JWT)
  name: string;                 // Tool name
  title?: string;               // Human-readable title (optional)
  description: string;          // What the tool does
  inputSchema: object;          // JSON Schema for tool parameters
  outputSchema?: object;        // Optional output schema
  serverId: string;             // Which MCP server provides this tool
  mcpServerEndpoint: string;    // Endpoint to call (denormalized for performance)
  isActive: boolean;            // Enable/disable tool
  lastSyncedAt: Date;           // Last sync from MCP server
  metadata?: Map<string, any>;  // Additional tool metadata
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mongoose schema for MCP Tool
 */
const mcpToolSchema = new Schema<IMCPTool>(
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
        validator: function(v: any) {
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
    const lowerCaseIds = toolIds.map(id => id.toLowerCase());
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
mcpToolSchema.pre('save', function(next) {
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
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

// Export types and model
export type MCPToolDocument = HydratedDocument<IMCPTool>;
export const MCPTool = model<IMCPTool>('MCPTool', mcpToolSchema);
```

**Key Features**:
- ✅ Unique toolId matching allowedTools format
- ✅ serverId for server mapping
- ✅ Denormalized mcpServerEndpoint for performance
- ✅ JSON Schema validation for inputSchema
- ✅ lastSyncedAt tracking
- ✅ Multiple indexes for query optimization
- ✅ Instance methods: isSyncStale(), toMCPFormat()
- ✅ Static methods: findActive(), findByServerId(), findByToolIds(), findStale()

---

### Task 3: Create Model Index File

**File**: `src/models/index.ts`

```typescript
// Central export point for all models
export * from './MCPServer.model';
export * from './MCPTool.model';
```

---

### Task 4: Create Unit Tests for MCPServer Model

**File**: `tests/unit/MCPServer.model.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MCPServer, IMCPServer } from '../../src/models/MCPServer.model';

describe('MCPServer Model', () => {
  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect('mongodb://localhost:27017/agent-gateway-test');
  });

  afterAll(async () => {
    // Clean up and disconnect
    await MCPServer.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear collection before each test
    await MCPServer.deleteMany({});
  });

  describe('Validation', () => {
    it('should create a valid MCP server', async () => {
      const serverData: Partial<IMCPServer> = {
        serverId: 'weather-mcp',
        name: 'Weather MCP Server',
        description: 'Provides weather information tools',
        endpoint: 'http://localhost:8080/mcp',
        isActive: true
      };

      const server = await MCPServer.create(serverData);

      expect(server.serverId).toBe('weather-mcp');
      expect(server.name).toBe('Weather MCP Server');
      expect(server.isActive).toBe(true);
      expect(server.createdAt).toBeInstanceOf(Date);
      expect(server.updatedAt).toBeInstanceOf(Date);
    });

    it('should require serverId', async () => {
      const serverData = {
        name: 'Test Server',
        description: 'Test description',
        endpoint: 'http://localhost:8080/mcp'
      };

      await expect(MCPServer.create(serverData)).rejects.toThrow();
    });

    it('should require unique serverId', async () => {
      const serverData = {
        serverId: 'duplicate-server',
        name: 'Server 1',
        description: 'Description',
        endpoint: 'http://localhost:8080/mcp'
      };

      await MCPServer.create(serverData);

      await expect(
        MCPServer.create({ ...serverData, name: 'Server 2' })
      ).rejects.toThrow();
    });

    it('should convert serverId to lowercase', async () => {
      const server = await MCPServer.create({
        serverId: 'UPPERCASE-SERVER',
        name: 'Test',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp'
      });

      expect(server.serverId).toBe('uppercase-server');
    });

    it('should validate endpoint URL format', async () => {
      const invalidData = {
        serverId: 'test-server',
        name: 'Test',
        description: 'Test',
        endpoint: 'not-a-url'
      };

      await expect(MCPServer.create(invalidData)).rejects.toThrow();
    });

    it('should reject invalid serverId format', async () => {
      const invalidData = {
        serverId: 'invalid server!',
        name: 'Test',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp'
      };

      await expect(MCPServer.create(invalidData)).rejects.toThrow();
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      // Create test data
      await MCPServer.create([
        {
          serverId: 'weather-mcp',
          name: 'Weather',
          description: 'Weather tools',
          endpoint: 'http://localhost:8080/mcp',
          isActive: true
        },
        {
          serverId: 'calculator-mcp',
          name: 'Calculator',
          description: 'Math tools',
          endpoint: 'http://localhost:8081/mcp',
          isActive: false
        },
        {
          serverId: 'search-mcp',
          name: 'Search',
          description: 'Search tools',
          endpoint: 'http://localhost:8082/mcp',
          isActive: true
        }
      ]);
    });

    it('should find all active servers', async () => {
      const active = await MCPServer.findActive();

      expect(active).toHaveLength(2);
      expect(active.every(s => s.isActive)).toBe(true);
    });

    it('should find server by serverId', async () => {
      const server = await MCPServer.findByServerId('weather-mcp');

      expect(server).toBeTruthy();
      expect(server!.serverId).toBe('weather-mcp');
    });

    it('should handle case-insensitive serverId lookup', async () => {
      const server = await MCPServer.findByServerId('WEATHER-MCP');

      expect(server).toBeTruthy();
      expect(server!.serverId).toBe('weather-mcp');
    });
  });

  describe('Instance Methods', () => {
    it('should check if server is healthy', async () => {
      const server = await MCPServer.create({
        serverId: 'test-server',
        name: 'Test',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp',
        lastHealthCheck: new Date()
      });

      expect(server.isHealthy()).toBe(true);
    });

    it('should return false for stale health check', async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const server = await MCPServer.create({
        serverId: 'test-server',
        name: 'Test',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp',
        lastHealthCheck: tenMinutesAgo
      });

      expect(server.isHealthy()).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('should transform _id to id', async () => {
      const server = await MCPServer.create({
        serverId: 'test-server',
        name: 'Test',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp'
      });

      const json = server.toJSON();

      expect(json.id).toBeDefined();
      expect(json._id).toBeUndefined();
      expect(json.__v).toBeUndefined();
    });
  });
});
```

---

### Task 5: Create Unit Tests for MCPTool Model

**File**: `tests/unit/MCPTool.model.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MCPTool, IMCPTool } from '../../src/models/MCPTool.model';

describe('MCPTool Model', () => {
  beforeAll(async () => {
    await mongoose.connect('mongodb://localhost:27017/agent-gateway-test');
  });

  afterAll(async () => {
    await MCPTool.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await MCPTool.deleteMany({});
  });

  describe('Validation', () => {
    it('should create a valid tool', async () => {
      const toolData: Partial<IMCPTool> = {
        toolId: 'weather:get-current',
        name: 'get_current_weather',
        description: 'Get current weather for a location',
        inputSchema: {
          type: 'object',
          properties: {
            location: { type: 'string' }
          },
          required: ['location']
        },
        serverId: 'weather-mcp',
        mcpServerEndpoint: 'http://localhost:8080/mcp',
        lastSyncedAt: new Date()
      };

      const tool = await MCPTool.create(toolData);

      expect(tool.toolId).toBe('weather:get-current');
      expect(tool.name).toBe('get_current_weather');
      expect(tool.serverId).toBe('weather-mcp');
    });

    it('should require toolId', async () => {
      const toolData = {
        name: 'test_tool',
        description: 'Test',
        inputSchema: { type: 'object' },
        serverId: 'test-server',
        mcpServerEndpoint: 'http://localhost:8080/mcp'
      };

      await expect(MCPTool.create(toolData)).rejects.toThrow();
    });

    it('should require unique toolId', async () => {
      const toolData = {
        toolId: 'duplicate-tool',
        name: 'tool1',
        description: 'Description',
        inputSchema: { type: 'object' },
        serverId: 'test-server',
        mcpServerEndpoint: 'http://localhost:8080/mcp'
      };

      await MCPTool.create(toolData);

      await expect(
        MCPTool.create({ ...toolData, name: 'tool2' })
      ).rejects.toThrow();
    });

    it('should convert toolId to lowercase', async () => {
      const tool = await MCPTool.create({
        toolId: 'UPPERCASE:TOOL',
        name: 'test_tool',
        description: 'Test',
        inputSchema: { type: 'object' },
        serverId: 'test-server',
        mcpServerEndpoint: 'http://localhost:8080/mcp'
      });

      expect(tool.toolId).toBe('uppercase:tool');
    });

    it('should validate inputSchema format', async () => {
      const invalidData = {
        toolId: 'test-tool',
        name: 'test',
        description: 'Test',
        inputSchema: { type: 'string' }, // Invalid: must be object
        serverId: 'test-server',
        mcpServerEndpoint: 'http://localhost:8080/mcp'
      };

      await expect(MCPTool.create(invalidData)).rejects.toThrow();
    });
  });

  describe('Static Methods', () => {
    beforeEach(async () => {
      await MCPTool.create([
        {
          toolId: 'weather:get-current',
          name: 'get_weather',
          description: 'Get weather',
          inputSchema: { type: 'object' },
          serverId: 'weather-mcp',
          mcpServerEndpoint: 'http://localhost:8080/mcp',
          isActive: true
        },
        {
          toolId: 'calculator:add',
          name: 'add',
          description: 'Add numbers',
          inputSchema: { type: 'object' },
          serverId: 'calculator-mcp',
          mcpServerEndpoint: 'http://localhost:8081/mcp',
          isActive: false
        },
        {
          toolId: 'calculator:subtract',
          name: 'subtract',
          description: 'Subtract numbers',
          inputSchema: { type: 'object' },
          serverId: 'calculator-mcp',
          mcpServerEndpoint: 'http://localhost:8081/mcp',
          isActive: true
        }
      ]);
    });

    it('should find all active tools', async () => {
      const active = await MCPTool.findActive();

      expect(active).toHaveLength(2);
      expect(active.every(t => t.isActive)).toBe(true);
    });

    it('should find tools by serverId', async () => {
      const tools = await MCPTool.findByServerId('calculator-mcp');

      expect(tools).toHaveLength(1); // Only active tools
      expect(tools[0].toolId).toBe('calculator:subtract');
    });

    it('should find tools by toolIds', async () => {
      const toolIds = ['weather:get-current', 'calculator:subtract'];
      const tools = await MCPTool.findByToolIds(toolIds);

      expect(tools).toHaveLength(2);
      expect(tools.map(t => t.toolId)).toContain('weather:get-current');
      expect(tools.map(t => t.toolId)).toContain('calculator:subtract');
    });

    it('should handle case-insensitive toolId lookup', async () => {
      const tools = await MCPTool.findByToolIds(['WEATHER:GET-CURRENT']);

      expect(tools).toHaveLength(1);
      expect(tools[0].toolId).toBe('weather:get-current');
    });

    it('should find stale tools', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      await MCPTool.create({
        toolId: 'stale:tool',
        name: 'stale_tool',
        description: 'Stale',
        inputSchema: { type: 'object' },
        serverId: 'test-server',
        mcpServerEndpoint: 'http://localhost:8080/mcp',
        lastSyncedAt: twoHoursAgo
      });

      const stale = await MCPTool.findStale();

      expect(stale).toHaveLength(1);
      expect(stale[0].toolId).toBe('stale:tool');
    });
  });

  describe('Instance Methods', () => {
    it('should check if sync is stale', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const tool = await MCPTool.create({
        toolId: 'test:tool',
        name: 'test',
        description: 'Test',
        inputSchema: { type: 'object' },
        serverId: 'test-server',
        mcpServerEndpoint: 'http://localhost:8080/mcp',
        lastSyncedAt: twoHoursAgo
      });

      expect(tool.isSyncStale()).toBe(true);
    });

    it('should return false for fresh sync', async () => {
      const tool = await MCPTool.create({
        toolId: 'test:tool',
        name: 'test',
        description: 'Test',
        inputSchema: { type: 'object' },
        serverId: 'test-server',
        mcpServerEndpoint: 'http://localhost:8080/mcp',
        lastSyncedAt: new Date()
      });

      expect(tool.isSyncStale()).toBe(false);
    });

    it('should convert to MCP format', async () => {
      const tool = await MCPTool.create({
        toolId: 'test:tool',
        name: 'test_tool',
        title: 'Test Tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: { input: { type: 'string' } }
        },
        serverId: 'test-server',
        mcpServerEndpoint: 'http://localhost:8080/mcp'
      });

      const mcpFormat = tool.toMCPFormat();

      expect(mcpFormat).toEqual({
        name: 'test_tool',
        title: 'Test Tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object',
          properties: { input: { type: 'string' } }
        }
      });
    });
  });
});
```

---

## Validation

### Level 1: TypeScript Compilation
```bash
npm run build
```
**Expected**: Models compile without errors

### Level 2: Unit Tests
```bash
# Ensure MongoDB is running
npm test tests/unit/MCPServer.model.test.ts
npm test tests/unit/MCPTool.model.test.ts
```
**Expected**: All tests pass

### Level 3: Manual Database Testing

Start MongoDB and Node REPL:
```bash
# Start MongoDB
mongod

# Start Node REPL
node
```

Test MCPServer model:
```javascript
const mongoose = require('mongoose');
const { MCPServer } = require('./dist/src/models/MCPServer.model');

await mongoose.connect('mongodb://localhost:27017/agent-gateway-test');

// Create server
const server = await MCPServer.create({
  serverId: 'weather-mcp',
  name: 'Weather MCP Server',
  description: 'Provides weather tools',
  endpoint: 'http://localhost:8080/mcp'
});

console.log(server.toJSON());

// Find active servers
const active = await MCPServer.findActive();
console.log(active);

await mongoose.connection.close();
```

---

## Known Gotchas

### 1. Mongoose with TypeScript
⚠️ **Don't extend Document interface**

```typescript
// ❌ Wrong
export interface IMCPServer extends Document {
  serverId: string;
  // ...
}

// ✅ Correct
export interface IMCPServer {
  serverId: string;
  // ...
}

export type MCPServerDocument = HydratedDocument<IMCPServer>;
```

### 2. Compound Indexes
- Indexes are created automatically by Mongoose
- Order matters in compound indexes
- Use `.explain()` in queries to verify index usage

### 3. Validation Timing
- Validation runs on `create()` and `save()`
- Does NOT run on `updateOne()`, `findOneAndUpdate()` unless `runValidators: true`

### 4. Pre-save Hooks
- Only run on `create()` and `save()`
- Don't run on `updateOne()`, `findOneAndUpdate()`
- Use `this.isModified('field')` to check if field changed

### 5. Map Type
- `Map<string, any>` allows flexible metadata storage
- Serializes to object in JSON
- Use for extensibility without schema changes

---

## Next Steps

After completing this PRP:
1. ✅ MCPServer model created and tested
2. ✅ MCPTool model created and tested
3. ✅ Indexes defined for performance
4. ✅ Validation rules enforced
5. ✅ Unit tests passing

**Proceed to**: [PRP 03: Identity Service Integration](./03-identity-service-integration.md)

---

## Checklist

- [ ] MCPServer model created with all fields
- [ ] MCPTool model created with all fields
- [ ] Indexes defined on both models
- [ ] Validation rules implemented
- [ ] Static methods implemented
- [ ] Instance methods implemented
- [ ] toJSON transformations implemented
- [ ] Unit tests for MCPServer pass
- [ ] Unit tests for MCPTool pass
- [ ] Models compile without TypeScript errors
- [ ] Can create, read, update, delete documents
- [ ] Manual database testing successful

---

**Status**: 🟢 Ready for Implementation
**Estimated Time**: 1 day
**Dependencies**: PRP 01
**Next PRP**: 03 - Identity Service Integration
