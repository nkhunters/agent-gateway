# PRP 09: Server Bootstrap & Integration Testing

## Goal

Complete the server initialization by updating `src/index.ts` to start both the Management REST API and Universal MCP Server. Implement graceful shutdown, comprehensive integration tests, and provide a deployment checklist.

## Why

- **Complete System**: Bring all components together
- **Proper Initialization**: Start services in correct order
- **Graceful Shutdown**: Clean up resources on exit
- **Integration Testing**: Verify all components work together
- **Production Ready**: Ensure system is deployable

## What

### Deliverables
1. ✅ Updated `src/index.ts` - Bootstrap both servers
2. ✅ Database initialization
3. ✅ MCP client connections initialization
4. ✅ Graceful shutdown handlers
5. ✅ Integration test suite
6. ✅ Manual testing guide
7. ✅ Deployment checklist

### Success Criteria
- [ ] Both Management API and Universal MCP Server start successfully
- [ ] Database connection established
- [ ] MCP clients connect to registered servers
- [ ] Graceful shutdown on SIGTERM/SIGINT
- [ ] Integration tests pass
- [ ] System runs end-to-end successfully
- [ ] Ready for deployment

## Context & References

### Identity Service Bootstrap Pattern
- **Reference**: `/Users/avinashkumar/Desktop/identity-service/src/index.ts`
- Pattern: Database first, then server start

### routing-controllers Setup
- Create Express server with controllers
- Set TypeDI container
- Handle errors

## Implementation Tasks

### Task 1: Update src/index.ts

**File**: `src/index.ts`

```typescript
import 'reflect-metadata'; // MUST be first import
import { createExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';
import cors from 'cors';
import { connectDatabase, disconnectDatabase } from './config/database';
import { MCPClientManager } from './services/MCPClientManager';
import { UniversalMCPServer } from './services/UniversalMCPServer';
import { logger } from './utils/logger';
import { env } from './config/env';

/**
 * Agent Gateway Service Bootstrap
 *
 * Initializes and starts:
 * 1. Database connection
 * 2. MCP client connections to registered servers
 * 3. Management REST API (routing-controllers)
 * 4. Universal MCP Server (FastMCP)
 */

// Track instances for graceful shutdown
let mcpClientManager: MCPClientManager | null = null;
let universalMCPServer: UniversalMCPServer | null = null;

/**
 * Initialize the application
 */
async function bootstrap() {
  try {
    logger.info('Starting Agent Gateway Service');

    // 1. Connect to MongoDB
    logger.info('Connecting to MongoDB...');
    await connectDatabase();
    logger.info('✓ MongoDB connected');

    // 2. Set TypeDI container for routing-controllers
    useContainer(Container);

    // 3. Create Management REST API (Express + routing-controllers)
    logger.info('Creating Management API...');
    const app = createExpressServer({
      routePrefix: '/api',
      controllers: [__dirname + '/controllers/*.ts'],
      middlewares: [__dirname + '/middlewares/*.ts'],
      defaultErrorHandler: true,
      validation: true, // Enable class-validator
      classTransformer: true,
      currentUserChecker: async (action) => {
        // Extract user from request (set by AuthMiddleware)
        return (action.request as any).user;
      }
    });

    // Enable CORS
    app.use(cors({
      origin: env.NODE_ENV === 'development' ? '*' : 'https://yourdomain.com',
      credentials: true
    }));

    // Health check endpoint (no auth required)
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          managementAPI: 'running',
          universalMCP: universalMCPServer?.isServerRunning() ? 'running' : 'stopped',
          database: 'connected'
        }
      });
    });

    // Start Management API
    const managementAPIPort = env.MANAGEMENT_API_PORT;
    app.listen(managementAPIPort, () => {
      logger.info(
        { port: managementAPIPort },
        '✓ Management API started'
      );
    });

    // 4. Initialize MCP Client connections to registered servers
    logger.info('Initializing MCP client connections...');
    mcpClientManager = Container.get(MCPClientManager);
    await mcpClientManager.initializeFromDatabase();
    logger.info('✓ MCP client connections initialized');

    // 5. Start Universal MCP Server
    logger.info('Starting Universal MCP Server...');
    universalMCPServer = Container.get(UniversalMCPServer);
    await universalMCPServer.start();
    logger.info('✓ Universal MCP Server started');

    // 6. Log startup success
    logger.info(
      {
        managementAPIPort,
        universalMCPPort: env.UNIVERSAL_MCP_PORT,
        nodeEnv: env.NODE_ENV
      },
      '🚀 Agent Gateway Service started successfully'
    );

    logger.info('');
    logger.info('Management API:     http://localhost:' + managementAPIPort);
    logger.info('Universal MCP:      http://localhost:' + env.UNIVERSAL_MCP_PORT + '/mcp');
    logger.info('Health Check:       http://localhost:' + managementAPIPort + '/health');
    logger.info('');

  } catch (error) {
    logger.error({ err: error }, 'Failed to start Agent Gateway Service');
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string) {
  logger.info({ signal }, 'Received shutdown signal');

  try {
    // 1. Stop Universal MCP Server (stop accepting new connections)
    if (universalMCPServer) {
      logger.info('Stopping Universal MCP Server...');
      await universalMCPServer.stop();
      logger.info('✓ Universal MCP Server stopped');
    }

    // 2. Disconnect MCP clients
    if (mcpClientManager) {
      logger.info('Disconnecting MCP clients...');
      await mcpClientManager.shutdown();
      logger.info('✓ MCP clients disconnected');
    }

    // 3. Disconnect from MongoDB
    logger.info('Closing MongoDB connection...');
    await disconnectDatabase();
    logger.info('✓ MongoDB connection closed');

    logger.info('Graceful shutdown complete');
    process.exit(0);

  } catch (error) {
    logger.error({ err: error }, 'Error during graceful shutdown');
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error({ err: error }, 'Uncaught exception');
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled rejection');
  gracefulShutdown('unhandledRejection');
});

// Start the application
bootstrap();
```

**Key Features**:
- ✅ Correct initialization order
- ✅ Both servers start successfully
- ✅ Graceful shutdown on signals
- ✅ Error handling
- ✅ Health check endpoint
- ✅ Comprehensive logging

---

### Task 2: Create Integration Test Suite

**File**: `tests/integration/end-to-end.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MCPServer } from '../../src/models/MCPServer.model';
import { MCPTool } from '../../src/models/MCPTool.model';

describe('End-to-End Integration Tests', () => {
  let managementAPIUrl: string;
  let universalMCPUrl: string;
  let authToken: string;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect('mongodb://localhost:27017/agent-gateway-test');

    managementAPIUrl = 'http://localhost:3000';
    universalMCPUrl = 'http://localhost:3001/mcp';

    // Get auth token (in real scenario, from identity-service)
    authToken = process.env.TEST_TOKEN || 'mock-token';

    // Clean up
    await MCPServer.deleteMany({});
    await MCPTool.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Complete Flow', () => {
    it('should complete full workflow', async () => {
      // 1. Register MCP server
      const registerResponse = await request(managementAPIUrl)
        .post('/api/mcp-servers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          serverId: 'test-mcp',
          name: 'Test MCP Server',
          description: 'Integration test server',
          endpoint: 'http://localhost:8080/mcp'
        });

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.success).toBe(true);

      // 2. Sync tools
      const syncResponse = await request(managementAPIUrl)
        .post('/api/tools/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(syncResponse.status).toBe(200);

      // 3. List tools via Management API
      const listResponse = await request(managementAPIUrl)
        .get('/api/tools')
        .set('Authorization', `Bearer ${authToken}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.tools).toBeInstanceOf(Array);

      // 4. Check health
      const healthResponse = await request(managementAPIUrl)
        .get('/health');

      expect(healthResponse.status).toBe(200);
      expect(healthResponse.body.status).toBe('healthy');

      // 5. Universal MCP Server tests would require MCP client
      // See manual testing guide below
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid server registration', async () => {
      const response = await request(managementAPIUrl)
        .post('/api/mcp-servers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          serverId: 'INVALID!',
          name: 'Test',
          description: 'Test',
          endpoint: 'not-a-url'
        });

      expect(response.status).toBe(400);
    });

    it('should require authentication', async () => {
      const response = await request(managementAPIUrl)
        .get('/api/mcp-servers');

      expect(response.status).toBe(401);
    });
  });
});
```

---

### Task 3: Manual Testing Guide

**File**: `TESTING.md`

```markdown
# Agent Gateway Service - Manual Testing Guide

## Prerequisites

1. **Identity Service** running on http://localhost:3000
2. **MongoDB** running on localhost:27017
3. **Valid JWT token** from identity-service with allowedTools array
4. **Test MCP server** (optional, for full testing)

## Step 1: Start Agent Gateway

\`\`\`bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env
# Edit .env with your values

# Start in development mode
npm run dev
\`\`\`

**Expected Output**:
\`\`\`
[INFO] Starting Agent Gateway Service
[INFO] Connecting to MongoDB...
[INFO] ✓ MongoDB connected
[INFO] Creating Management API...
[INFO] ✓ Management API started
[INFO] Initializing MCP client connections...
[INFO] ✓ MCP client connections initialized
[INFO] Starting Universal MCP Server...
[INFO] ✓ Universal MCP Server started
[INFO] 🚀 Agent Gateway Service started successfully

Management API:     http://localhost:3000
Universal MCP:      http://localhost:3001/mcp
Health Check:       http://localhost:3000/health
\`\`\`

## Step 2: Test Health Check

\`\`\`bash
curl http://localhost:3000/health
\`\`\`

**Expected**:
\`\`\`json
{
  "status": "healthy",
  "timestamp": "2025-11-19T12:00:00.000Z",
  "services": {
    "managementAPI": "running",
    "universalMCP": "running",
    "database": "connected"
  }
}
\`\`\`

## Step 3: Get JWT Token from Identity Service

\`\`\`bash
# Register application in identity-service
curl -X POST http://localhost:3000/applications \\
  -H "Content-Type: application/json" \\
  -d '{
    "applicationName": "TestApp",
    "description": "Test Application",
    "clientSecret": "test-secret-123",
    "financialId": "FIN-001",
    "channelId": "CH-001",
    "allowedTools": ["test-mcp:echo", "test-mcp:calculate"],
    "allowedApis": []
  }'

# Get token
curl -X POST http://localhost:3000/oauth/token \\
  -H "Content-Type: application/json" \\
  -d '{
    "grant_type": "client_credentials",
    "client_id": "<clientId-from-above>",
    "client_secret": "test-secret-123"
  }'

# Save the access_token from response
export TOKEN="<access_token>"
\`\`\`

## Step 4: Register MCP Server

\`\`\`bash
curl -X POST http://localhost:3000/api/mcp-servers \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "serverId": "test-mcp",
    "name": "Test MCP Server",
    "description": "Test server for manual testing",
    "endpoint": "http://localhost:8080/mcp"
  }'
\`\`\`

**Expected**: Server registered, tools synced

## Step 5: List Registered Servers

\`\`\`bash
curl http://localhost:3000/api/mcp-servers \\
  -H "Authorization: Bearer $TOKEN"
\`\`\`

## Step 6: List Tools

\`\`\`bash
curl http://localhost:3000/api/tools \\
  -H "Authorization: Bearer $TOKEN"
\`\`\`

## Step 7: Trigger Manual Sync

\`\`\`bash
curl -X POST http://localhost:3000/api/tools/sync \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{}'
\`\`\`

## Step 8: Test Universal MCP Server

**Using MCP Inspector or MCP Client**:

1. Connect to: `http://localhost:3001/mcp`
2. Add Authorization header: `Bearer $TOKEN`
3. Call `tools/list` - Should return only allowed tools
4. Call `tools/call` with allowed tool - Should execute successfully
5. Call `tools/call` with disallowed tool - Should return error

**Using curl (JSON-RPC)**:

\`\`\`bash
# tools/list
curl -X POST http://localhost:3001/mcp \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'

# tools/call
curl -X POST http://localhost:3001/mcp \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "test-mcp:echo",
      "arguments": {
        "message": "Hello, World!"
      }
    }
  }'
\`\`\`

## Step 9: Test Error Scenarios

### Invalid Token
\`\`\`bash
curl http://localhost:3000/api/tools \\
  -H "Authorization: Bearer invalid-token"
\`\`\`
**Expected**: 401 Unauthorized

### No Token
\`\`\`bash
curl http://localhost:3000/api/tools
\`\`\`
**Expected**: 401 Unauthorized

### Identity Service Down
1. Stop identity-service
2. Try to access any endpoint
**Expected**: 503 Service Unavailable

## Step 10: Test Graceful Shutdown

\`\`\`bash
# Send SIGTERM
kill -TERM <pid>

# Or Ctrl+C in terminal
\`\`\`

**Expected**:
\`\`\`
[INFO] Received shutdown signal: SIGTERM
[INFO] Stopping Universal MCP Server...
[INFO] ✓ Universal MCP Server stopped
[INFO] Disconnecting MCP clients...
[INFO] ✓ MCP clients disconnected
[INFO] Closing MongoDB connection...
[INFO] ✓ MongoDB connection closed
[INFO] Graceful shutdown complete
\`\`\`

## Troubleshooting

### Port Already in Use
- Check if another process is using port 3000 or 3001
- Change ports in .env

### MongoDB Connection Failed
- Ensure MongoDB is running
- Check MONGODB_URI in .env

### Identity Service Unavailable
- Ensure identity-service is running on http://localhost:3000
- Check IDENTITY_SERVICE_URL in .env

### MCP Server Connection Failed
- Ensure test MCP server is running
- Check endpoint URL
- View logs for connection errors
\`\`\`

---

### Task 4: Create Deployment Checklist

**File**: `DEPLOYMENT.md`

```markdown
# Deployment Checklist

## Pre-Deployment

- [ ] All PRPs 01-09 completed
- [ ] All unit tests pass (`npm test`)
- [ ] All integration tests pass
- [ ] Manual testing completed
- [ ] No TypeScript errors (`npm run build`)
- [ ] Environment variables validated
- [ ] Security review completed

## Environment Setup

- [ ] Production MongoDB instance provisioned
- [ ] Identity service accessible from agent-gateway
- [ ] Environment variables configured:
  - [ ] MONGODB_URI
  - [ ] IDENTITY_SERVICE_URL
  - [ ] MANAGEMENT_API_PORT
  - [ ] UNIVERSAL_MCP_PORT
  - [ ] NODE_ENV=production
  - [ ] LOG_LEVEL=info

## Security

- [ ] No JWT secrets in agent-gateway (validated via identity-service API)
- [ ] HTTPS/TLS configured for production
- [ ] CORS configured with specific origins (not *)
- [ ] Rate limiting implemented (optional)
- [ ] Firewall rules configured
- [ ] Secrets stored in secret manager (not .env files)

## Monitoring

- [ ] Logging to centralized service (e.g., CloudWatch, Datadog)
- [ ] Health check endpoint monitored
- [ ] Alerts configured for:
  - [ ] Service unavailable
  - [ ] High error rate
  - [ ] Database connection failures
  - [ ] Identity service connectivity issues

## Deployment Steps

1. Build application: `npm run build`
2. Copy `dist/` to production server
3. Install production dependencies: `npm install --production`
4. Set environment variables
5. Start with process manager (PM2, systemd, etc.)
6. Verify health check
7. Register backend MCP servers
8. Sync tools
9. Test with sample MCP client

## Post-Deployment

- [ ] Health check returns 200 OK
- [ ] Management API accessible
- [ ] Universal MCP Server accepting connections
- [ ] MCP clients connected to backend servers
- [ ] Tools synced successfully
- [ ] Token validation working (via identity-service)
- [ ] Tool execution working
- [ ] Logs flowing to monitoring service

## Rollback Plan

1. Stop agent-gateway service
2. Restore previous version
3. Restart service
4. Verify health check
\`\`\`

---

## Validation

### Level 1: Build & Tests
```bash
npm run build
npm test
```
**Expected**: Build succeeds, all tests pass

### Level 2: Start Application
```bash
npm run dev
```
**Expected**: Both servers start, no errors

### Level 3: Integration Tests
```bash
npm test tests/integration/end-to-end.test.ts
```
**Expected**: All integration tests pass

### Level 4: Manual Testing
Follow `TESTING.md` guide
**Expected**: All manual tests pass

### Level 5: Load Testing (Optional)
```bash
# Use Apache Bench or similar
ab -n 1000 -c 10 -H "Authorization: Bearer <token>" http://localhost:3000/api/tools
```

---

## Known Gotchas

### 1. Initialization Order
- Database MUST connect before services start
- MCPClientManager before UniversalMCPServer
- Order matters for graceful shutdown too

### 2. Port Conflicts
- Ensure ports 3000 and 3001 are available
- Or configure different ports in .env

### 3. Graceful Shutdown
- Give services time to clean up
- Don't force kill immediately
- Wait for connections to close

### 4. Environment Variables
- Validate all required vars on startup
- Fail fast if any missing
- Don't use defaults for critical vars

### 5. TypeDI Container
- Must call `useContainer(Container)` before createExpressServer
- Services must be decorated with `@Service()`

---

## Next Steps

After completing this PRP:
1. ✅ Server bootstrap complete
2. ✅ Both APIs running
3. ✅ Graceful shutdown implemented
4. ✅ Integration tests passing
5. ✅ Manual testing guide provided
6. ✅ Deployment checklist created

**System Complete!** ✨

All 9 implementation PRPs finished. Agent Gateway Service ready for production deployment.

---

## Final Checklist

- [ ] src/index.ts updated with bootstrap logic
- [ ] Database initialization working
- [ ] Both servers start successfully
- [ ] Graceful shutdown handles SIGTERM/SIGINT
- [ ] Health check endpoint working
- [ ] Integration test suite created
- [ ] Manual testing guide (TESTING.md) created
- [ ] Deployment checklist (DEPLOYMENT.md) created
- [ ] All PRPs 01-09 completed
- [ ] System tested end-to-end
- [ ] Ready for deployment

---

**Status**: 🟢 Ready for Implementation
**Estimated Time**: 1-2 days
**Dependencies**: All previous PRPs (01-08)
**Result**: Complete, production-ready Agent Gateway Service

---

## Congratulations! 🎉

You have completed all 9 implementation PRPs for the Agent Gateway Service. The system is now ready for:
- Development
- Testing
- Staging deployment
- Production deployment

Refer to PRP 00 (Implementation Roadmap) for overview and sequencing.

Happy coding! 🚀
