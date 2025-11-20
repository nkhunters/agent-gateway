# PRP 06: Management REST API

## Goal

Create REST API endpoints for managing MCP servers and viewing tools using routing-controllers. Provides administrative interface for registering backend MCP servers, viewing tool catalog, and triggering syncs.

## Why

- **Server Management**: Register, update, delete backend MCP servers
- **Tool Discovery**: View aggregated tool catalog
- **Manual Sync**: Trigger tool synchronization on-demand
- **Monitoring**: View sync status and connection health

## What

### Deliverables

1. ✅ MCPServersController (CRUD operations)
2. ✅ ToolsController (list, sync)
3. ✅ DTOs with class-validator
4. ✅ Integration with AuthMiddleware
5. ✅ Integration tests

### Success Criteria

- [ ] POST /api/mcp-servers registers new server
- [ ] GET /api/mcp-servers lists all servers
- [ ] DELETE /api/mcp-servers/:id removes server
- [ ] GET /api/tools lists all tools
- [ ] POST /api/tools/sync triggers sync
- [ ] All endpoints require authentication
- [ ] DTOs validate input
- [ ] Integration tests pass

## Context & References

### routing-controllers Pattern

- **Reference**: `/Users/avinashkumar/Desktop/identity-service/src/controllers/OAuthController.ts:1-190`
- **Reference**: `/Users/avinashkumar/Desktop/identity-service/src/controllers/ApplicationController.ts`
- Pattern: @JsonController, @Post, @Get, @Delete, @Body, @Param, @CurrentUser

### DTOs Pattern

- **Reference**: `/Users/avinashkumar/Desktop/identity-service/src/dto/CreateApplicationDto.ts`
- Use class-validator decorators

## Implementation Tasks

### Task 1: Create DTOs

**File**: `src/dto/RegisterMCPServerDto.ts`

```typescript
import { IsString, IsUrl, IsOptional, Length, Matches } from 'class-validator';

export class RegisterMCPServerDto {
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'serverId must contain only lowercase letters, numbers, and hyphens'
  })
  serverId!: string;

  @IsString()
  @Length(3, 100)
  name!: string;

  @IsString()
  @Length(10, 500)
  description!: string;

  @IsUrl({}, { message: 'endpoint must be a valid HTTP/HTTPS URL' })
  endpoint!: string;

  @IsOptional()
  @IsUrl()
  healthCheckUrl?: string;
}
```

---

**File**: `src/dto/SyncToolsDto.ts`

```typescript
import { IsOptional, IsString } from 'class-validator';

export class SyncToolsDto {
  @IsOptional()
  @IsString()
  serverId?: string; // If provided, sync only this server
}
```

---

**File**: `src/dto/index.ts`

```typescript
export * from './RegisterMCPServerDto';
export * from './SyncToolsDto';
```

---

### Task 2: Create MCPServersController

**File**: `src/controllers/MCPServersController.ts`

```typescript
import {
  JsonController,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  UseBefore,
  CurrentUser
} from 'routing-controllers';
import { Service, Inject } from 'typedi';
import { MCPServer } from '../models/MCPServer.model';
import { MCPClientManager } from '../services/MCPClientManager';
import { ToolAggregator } from '../services/ToolAggregator';
import { RegisterMCPServerDto } from '../dto/RegisterMCPServerDto';
import { AuthMiddleware } from '../middlewares/AuthMiddleware';
import { TokenPayload } from '../types/TokenPayload';
import { logger } from '../utils/logger';

/**
 * MCP Servers Controller
 *
 * Manages backend MCP server registry
 */
@Service()
@JsonController('/api/mcp-servers')
@UseBefore(AuthMiddleware) // All endpoints require authentication
export class MCPServersController {
  constructor(
    private mcpClientManager: MCPClientManager,
    private toolAggregator: ToolAggregator
  ) {}

  /**
   * POST /api/mcp-servers
   * Register new backend MCP server
   */
  @Post('/')
  @HttpCode(201)
  async register(
    @Body() dto: RegisterMCPServerDto,
    @CurrentUser() user: TokenPayload
  ) {
    logger.info(
      { serverId: dto.serverId, userId: user.sub },
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
  async list(@CurrentUser() user: TokenPayload) {
    logger.debug({ userId: user.sub }, 'Listing MCP servers');

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
    @CurrentUser() user: TokenPayload
  ) {
    logger.debug({ serverId, userId: user.sub }, 'Getting MCP server details');

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
    @CurrentUser() user: TokenPayload
  ) {
    logger.info({ serverId, userId: user.sub }, 'Removing MCP server');

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
    @CurrentUser() user: TokenPayload
  ) {
    logger.info({ serverId, userId: user.sub }, 'Reconnecting to MCP server');

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

      return {
        success: true,
        message: 'Reconnected successfully'
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
```

---

### Task 3: Create ToolsController

**File**: `src/controllers/ToolsController.ts`

```typescript
import {
  JsonController,
  Get,
  Post,
  Body,
  QueryParam,
  HttpCode,
  UseBefore,
  CurrentUser
} from 'routing-controllers';
import { Service, Inject } from 'typedi';
import { MCPTool } from '../models/MCPTool.model';
import { ToolAggregator } from '../services/ToolAggregator';
import { SyncToolsDto } from '../dto/SyncToolsDto';
import { AuthMiddleware } from '../middlewares/AuthMiddleware';
import { TokenPayload } from '../types/TokenPayload';
import { logger } from '../utils/logger';

/**
 * Tools Controller
 *
 * View and manage tool catalog
 */
@Service()
@JsonController('/api/tools')
@UseBefore(AuthMiddleware)
export class ToolsController {
  constructor(private toolAggregator: ToolAggregator) {}

  /**
   * GET /api/tools
   * List all tools in catalog
   */
  @Get('/')
  async list(
    @QueryParam('serverId') serverId?: string,
    @QueryParam('active') active?: string,
    @CurrentUser() user?: TokenPayload
  ) {
    logger.debug({ userId: user?.sub, serverId }, 'Listing tools');

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
  async sync(@Body() dto: SyncToolsDto, @CurrentUser() user: TokenPayload) {
    logger.info(
      { userId: user.sub, serverId: dto.serverId },
      'Triggering tool sync'
    );

    if (dto.serverId) {
      // Sync specific server
      const server =
        await require('../models/MCPServer.model').MCPServer.findByServerId(
          dto.serverId
        );

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
  async getStatus(@CurrentUser() user: TokenPayload) {
    logger.debug({ userId: user.sub }, 'Getting sync status');

    const status = await this.toolAggregator.getSyncStatus();

    return status;
  }
}
```

---

### Task 4: Update Controller Index

**File**: `src/controllers/index.ts`

```typescript
export * from './HealthController';
export * from './MCPServersController';
export * from './ToolsController';
```

---

### Task 5: Create Integration Tests

**File**: `tests/integration/mcp-servers.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createExpressServer } from 'routing-controllers';
import mongoose from 'mongoose';
import { Container } from 'typedi';
import { MCPServer } from '../../src/models/MCPServer.model';

describe('MCP Servers API', () => {
  let app: express.Application;
  let authToken: string;

  beforeAll(async () => {
    await mongoose.connect('mongodb://localhost:27017/agent-gateway-test');

    app = createExpressServer({
      routePrefix: '/api',
      controllers: [__dirname + '/../../src/controllers/*.ts'],
      middlewares: [__dirname + '/../../src/middlewares/*.ts'],
      defaultErrorHandler: false
    });

    // Mock auth token (in real scenario, get from identity-service)
    authToken = 'mock-jwt-token';
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await MCPServer.deleteMany({});
  });

  describe('POST /api/mcp-servers', () => {
    it('should register new MCP server', async () => {
      const response = await request(app)
        .post('/api/mcp-servers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          serverId: 'test-mcp',
          name: 'Test MCP Server',
          description: 'Test server for integration tests',
          endpoint: 'http://localhost:8080/mcp'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.server.serverId).toBe('test-mcp');
    });

    it('should reject invalid serverId format', async () => {
      const response = await request(app)
        .post('/api/mcp-servers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          serverId: 'INVALID SERVER!',
          name: 'Test',
          description: 'Test',
          endpoint: 'http://localhost:8080/mcp'
        });

      expect(response.status).toBe(400);
    });

    it('should require authentication', async () => {
      const response = await request(app).post('/api/mcp-servers').send({
        serverId: 'test-mcp',
        name: 'Test',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp'
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/mcp-servers', () => {
    it('should list all servers', async () => {
      // Create test servers
      await MCPServer.create([
        {
          serverId: 'server1',
          name: 'Server 1',
          description: 'Test',
          endpoint: 'http://localhost:8080/mcp'
        },
        {
          serverId: 'server2',
          name: 'Server 2',
          description: 'Test',
          endpoint: 'http://localhost:8081/mcp'
        }
      ]);

      const response = await request(app)
        .get('/api/mcp-servers')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.servers).toHaveLength(2);
      expect(response.body.totalCount).toBe(2);
    });
  });

  describe('DELETE /api/mcp-servers/:serverId', () => {
    it('should remove server', async () => {
      const server = await MCPServer.create({
        serverId: 'test-server',
        name: 'Test',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp'
      });

      const response = await request(app)
        .delete(`/api/mcp-servers/${server.serverId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const deleted = await MCPServer.findByServerId('test-server');
      expect(deleted).toBeNull();
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

**Expected**: Controllers compile without errors

### Level 2: Unit Tests

```bash
npm test tests/unit
```

### Level 3: Integration Tests

```bash
npm test tests/integration/mcp-servers.test.ts
```

**Expected**: All tests pass

### Level 4: Manual Testing with curl

Start the server:

```bash
npm run dev
```

Test endpoints (replace `<token>` with valid JWT from identity-service):

```bash
# Register MCP server
curl -X POST http://localhost:3000/api/mcp-servers \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "weather-mcp",
    "name": "Weather MCP Server",
    "description": "Provides weather information tools",
    "endpoint": "http://localhost:8080/mcp"
  }'

# List servers
curl http://localhost:3000/api/mcp-servers \
  -H "Authorization: Bearer <token>"

# List tools
curl http://localhost:3000/api/tools \
  -H "Authorization: Bearer <token>"

# Trigger sync
curl -X POST http://localhost:3000/api/tools/sync \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Known Gotchas

### 1. Authentication Required

- All endpoints use `@UseBefore(AuthMiddleware)`
- Must include valid JWT token in Authorization header
- AuthMiddleware calls identity-service API (PRP 03)

### 2. DTO Validation

- class-validator decorators enforce validation
- Returns 400 Bad Request for invalid input
- Error messages from class-validator

### 3. Error Handling

- routing-controllers has built-in error handling
- Can customize with custom error handler
- Return consistent error format

### 4. TypeDI Service Injection

- Controllers use constructor injection
- Must call `useContainer(Container)` in bootstrap

### 5. Current User

- Use `@CurrentUser()` decorator to get authenticated user
- Requires currentUserChecker in routing-controllers config
- Populated by AuthMiddleware

---

## Next Steps

After completing this PRP:

1. ✅ MCPServersController created
2. ✅ ToolsController created
3. ✅ DTOs with validation
4. ✅ Integration with AuthMiddleware
5. ✅ Integration tests passing

**Proceed to**: [PRP 07: Universal MCP Server](./07-universal-mcp-server.md)

---

## Checklist

- [ ] RegisterMCPServerDto created with validation
- [ ] SyncToolsDto created
- [ ] MCPServersController implements all endpoints
- [ ] ToolsController implements all endpoints
- [ ] All endpoints require authentication
- [ ] DTOs validate input correctly
- [ ] Integration tests pass
- [ ] Manual testing with curl successful
- [ ] Error messages are clear
- [ ] Returns consistent JSON format

---

**Status**: 🟢 Ready for Implementation
**Estimated Time**: 1 day
**Dependencies**: PRP 02, PRP 03, PRP 04, PRP 05
**Next PRP**: 07 - Universal MCP Server
