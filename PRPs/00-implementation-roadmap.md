# PRP 00: Agent Gateway Service - Implementation Roadmap

## Overview

This document provides a comprehensive implementation roadmap for the Agent Gateway Service - an MCP (Model Context Protocol) proxy/aggregator that integrates with the Identity Service for token-based access control.

## What We're Building

An **Agent Gateway Service** that acts as a universal MCP server, providing:

1. **MCP Server Registry**: Register and manage multiple backend MCP servers
2. **Tool Discovery**: Aggregate and catalog tools from all registered servers
3. **Universal MCP Server**: Stateless MCP server that validates tokens and exposes only allowed tools per client
4. **Tool Routing**: Route tool execution requests to the appropriate backend MCP server
5. **Token-Based Access Control**: Integrate with Identity Service for authentication and authorization

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent / LLM Client                        │
│                                                              │
│  Authorization: Bearer <jwt-token>                          │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPStream (Stateless)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Universal MCP Server (FastMCP)                  │
│                    Port: 3001                                │
│                                                              │
│  Per Request Flow:                                          │
│  1. Extract JWT from Authorization header                   │
│  2. Validate token via Identity Service API                 │
│  3. Extract allowedTools from response                      │
│  4. Filter available tools to only allowed ones             │
│  5. Process MCP request (tools/list or tools/call)          │
│  6. Return response                                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  TokenValidationService                              │  │
│  │  → Calls POST /oauth/verify                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ToolRoutingService                                   │  │
│  │  → Routes tool calls to backend MCP servers          │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────┬────────────────────┬───────────────────────┘
                 │                    │
                 ▼                    ▼
         ┌──────────────┐     ┌──────────────┐
         │ MCP Server 1 │     │ MCP Server 2 │
         │  (Weather)   │     │ (Calculator) │
         └──────────────┘     └──────────────┘

┌─────────────────────────────────────────────────────────────┐
│           Management REST API (routing-controllers)          │
│                    Port: 3000                                │
│                                                              │
│  POST   /api/mcp-servers     - Register backend MCP server  │
│  GET    /api/mcp-servers     - List all servers             │
│  DELETE /api/mcp-servers/:id - Remove server                │
│  GET    /api/tools           - List all available tools     │
│  POST   /api/tools/sync      - Manually trigger tool sync   │
│  GET    /health              - Health check                  │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   MongoDB Database                           │
│                                                              │
│  Collections:                                               │
│  - mcp_servers  (registry of backend MCP servers)           │
│  - mcp_tools    (cached tool definitions)                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 Identity Service Integration                 │
│                    (External Service)                        │
│                                                              │
│  POST /oauth/verify                                          │
│  - Validates JWT tokens                                      │
│  - Returns payload with allowedTools array                   │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Core Technologies
- **Runtime**: Node.js v18+
- **Language**: TypeScript 5.x
- **Framework**: Express.js with routing-controllers
- **Database**: MongoDB with Mongoose ORM
- **MCP Implementation**: FastMCP (HTTPStream stateless mode)
- **HTTP Client**: Axios (for identity-service calls)

### Supporting Technologies
- **Logging**: Pino
- **Testing**: Vitest
- **Validation**: class-validator
- **DI Container**: TypeDI

### Key Libraries
- `fastmcp` - MCP server implementation
- `@modelcontextprotocol/sdk` - MCP TypeScript SDK
- `axios` - HTTP client for identity-service integration
- `jsonwebtoken` - NOT USED (validation via identity-service API)
- `mongoose` - MongoDB ODM
- `routing-controllers` - Decorator-based REST API
- `typedi` - Dependency injection
- `pino` - Structured logging

## Implementation PRPs

### PRP 01: Base Setup & Configuration
**Status**: 🟡 Pending
**Estimated Time**: 1-2 days

**What**: Project foundation with dependencies, environment configuration, database connection, and TypeScript types.

**Deliverables**:
- Updated package.json with all dependencies
- Environment variable validation
- MongoDB connection with retry logic
- TypeScript type definitions
- Logger configuration

**Dependencies**: None

---

### PRP 02: Database Models & Tool Registry
**Status**: 🟡 Pending
**Estimated Time**: 1 day

**What**: Mongoose schemas for MCPServer and MCPTool collections.

**Deliverables**:
- MCPServer model with validation
- MCPTool model with validation
- Indexes for performance
- Model unit tests

**Dependencies**: PRP 01

---

### PRP 03: Identity Service Integration
**Status**: 🟡 Pending
**Estimated Time**: 1 day

**What**: Token validation via Identity Service API, no JWT secrets stored locally.

**Deliverables**:
- HTTP client utility (axios)
- TokenValidationService (calls POST /oauth/verify)
- AuthMiddleware for routing-controllers
- Fail-closed error handling
- Unit tests with mocked API

**Dependencies**: PRP 01

---

### PRP 04: MCP Client Management
**Status**: 🟡 Pending
**Estimated Time**: 1 day

**What**: Manage persistent connections to backend MCP servers.

**Deliverables**:
- MCPClientManager service
- Connection pooling
- Health check mechanism
- Reconnection logic
- Unit tests

**Dependencies**: PRP 01, PRP 02

---

### PRP 05: Tool Aggregation & Synchronization
**Status**: 🟡 Pending
**Estimated Time**: 1 day

**What**: Sync and cache tools from all registered backend MCP servers.

**Deliverables**:
- ToolAggregator service
- Sync logic for all servers
- Update MCPTool collection
- Error handling per server
- Unit tests

**Dependencies**: PRP 02, PRP 04

---

### PRP 06: Management REST API
**Status**: 🟡 Pending
**Estimated Time**: 1 day

**What**: REST API for managing MCP servers and viewing tools.

**Deliverables**:
- MCPServersController (CRUD operations)
- ToolsController (list, sync)
- DTOs with validation
- Integration with AuthMiddleware
- Integration tests

**Dependencies**: PRP 02, PRP 03, PRP 05

---

### PRP 07: Universal MCP Server
**Status**: 🟡 Pending
**Estimated Time**: 2 days

**What**: Core FastMCP server with stateless token validation and dynamic tool filtering.

**Deliverables**:
- UniversalMCPServer service
- FastMCP HTTPStream stateless implementation
- Token validation per request
- Dynamic tool filtering (tools/list)
- Tool call interception (tools/call)
- Unit tests

**Dependencies**: PRP 02, PRP 03, PRP 04

---

### PRP 08: Tool Routing & Execution
**Status**: 🟡 Pending
**Estimated Time**: 1 day

**What**: Route tool execution requests to the appropriate backend MCP server.

**Deliverables**:
- ToolRoutingService
- Parse and route tool calls
- Execute on backend servers
- Error handling and timeouts
- Response formatting
- Unit tests

**Dependencies**: PRP 04, PRP 07

---

### PRP 09: Server Bootstrap & Integration Testing
**Status**: 🟡 Pending
**Estimated Time**: 1-2 days

**What**: Initialize and start both servers, complete integration testing.

**Deliverables**:
- Updated src/index.ts
- Server initialization order
- Graceful shutdown
- Integration test suite
- Manual testing guide
- Deployment checklist

**Dependencies**: All previous PRPs

---

## Architecture Decisions

### 1. Token Validation Strategy
**Decision**: Call Identity Service API for all token validation
**Rationale**:
- Centralized token logic (single source of truth)
- No JWT secrets in agent-gateway
- Better security (secrets stay in identity-service)
- Easier to update validation logic

**Implementation**:
```typescript
// NO JWT secret stored
// Call POST /oauth/verify instead
const response = await axios.post(
  `${IDENTITY_SERVICE_URL}/oauth/verify`,
  { token }
);
```

### 2. Caching Strategy
**Decision**: No caching - validate on every request
**Rationale**:
- Most secure approach
- Always up-to-date with revocations
- Simpler implementation
- Identity service designed to handle load

### 3. Failure Mode
**Decision**: Fail-closed when identity-service unavailable
**Rationale**:
- Reject requests immediately with 503
- More secure than fail-open
- Clear feedback to clients

### 4. MCP Transport
**Decision**: HTTPStream in stateless mode
**Rationale**:
- No session management needed
- Each request is independent
- Simpler scaling
- Validate token per request

### 5. Concurrency Model
**Decision**: Stateless request handling
**Rationale**:
- No state between requests
- Easy to scale horizontally
- Simple error recovery

## Data Models

### MCPServer Collection
```typescript
{
  serverId: string;         // Unique identifier
  name: string;             // Human-readable name
  description: string;
  endpoint: string;         // HTTPStream URL (e.g., http://localhost:8080/mcp)
  isActive: boolean;        // Enable/disable server
  createdAt: Date;
  updatedAt: Date;
}
```

### MCPTool Collection
```typescript
{
  toolId: string;           // Unique ID (matches allowedTools in JWT)
  name: string;             // Tool name
  description: string;
  inputSchema: object;      // JSON Schema for parameters
  serverId: string;         // Which server provides this tool
  mcpServerEndpoint: string; // Endpoint to call
  lastSyncedAt: Date;       // Last sync timestamp
  createdAt: Date;
  updatedAt: Date;
}
```

## Environment Variables

```env
# Server Configuration
MANAGEMENT_API_PORT=3000
UNIVERSAL_MCP_PORT=3001
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/agent-gateway

# Identity Service Integration (CRITICAL)
IDENTITY_SERVICE_URL=http://localhost:3000

# Logging
LOG_LEVEL=info
```

**Critical**: NO `JWT_ACCESS_SECRET` - all validation via identity-service API

## API Endpoints

### Management API (Port 3000)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | /health | Health check | No |
| POST | /api/mcp-servers | Register backend MCP server | Yes |
| GET | /api/mcp-servers | List all servers | Yes |
| DELETE | /api/mcp-servers/:id | Remove server | Yes |
| GET | /api/tools | List all available tools | Yes |
| POST | /api/tools/sync | Manually trigger tool sync | Yes |

### Universal MCP Server (Port 3001)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | /mcp | MCP JSON-RPC requests | Yes (JWT) |

**MCP Methods**:
- `tools/list` - List tools allowed for this token
- `tools/call` - Execute a tool

## Integration with Identity Service

### Token Structure
The Identity Service issues JWT tokens with the following payload:

```typescript
interface TokenPayload {
  sub: string;                      // clientId
  jti: string;                      // JWT ID
  applicationName: string;
  financialId: string;
  channelId: string;
  allowedTools: string[];           // ← KEY: Tools this client can use
  allowedApis: string[];
  isDeveloperPortalAPIsEnabled: boolean;
  threeScaleClientId?: string;
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
}
```

### Validation Flow
1. Client sends request with `Authorization: Bearer <token>`
2. Agent Gateway extracts token
3. Calls `POST http://identity-service:3000/oauth/verify { "token": "..." }`
4. Identity Service validates and returns payload
5. Agent Gateway extracts `allowedTools` array
6. Filters available tools to only allowed ones
7. Processes request

### API Contract

**Request**:
```json
POST /oauth/verify
{
  "token": "eyJhbGc..."
}
```

**Success Response**:
```json
{
  "valid": true,
  "payload": {
    "clientId": "V1StGXR8",
    "jti": "uuid...",
    "applicationName": "TestApp",
    "allowedTools": ["weather", "calculator", "search"],
    "allowedApis": ["/api/users"],
    "issuedAt": "2025-11-19T10:00:00Z",
    "expiresAt": "2025-11-19T10:15:00Z"
  }
}
```

**Error Response**:
```json
{
  "valid": false,
  "error": "Token expired",
  "expiredAt": "2025-11-19T10:00:00Z"
}
```

## Success Criteria

### Functional Requirements
- [ ] Can register backend MCP servers via Management API
- [ ] Tools automatically sync from registered servers
- [ ] Universal MCP Server validates tokens via identity-service on every request
- [ ] Only allowed tools are exposed per client (tools/list filtered)
- [ ] Tool calls route correctly to backend MCP servers
- [ ] Fails closed when identity-service unavailable (503 response)
- [ ] Returns clear error messages for all failure cases

### Technical Requirements
- [ ] TypeScript compilation with no errors
- [ ] All unit tests pass (80%+ coverage)
- [ ] Integration tests pass
- [ ] No file > 500 lines
- [ ] Pino logging throughout
- [ ] Error handling for all failure modes
- [ ] Graceful shutdown for both servers

### Security Requirements
- [ ] No JWT secrets stored in agent-gateway
- [ ] All token validation via identity-service API
- [ ] Fail-closed on identity-service failure
- [ ] No caching of validation results
- [ ] Authorization checked on every request
- [ ] Sensitive data not logged

### Performance Requirements
- [ ] Token validation completes within 5 seconds (including network)
- [ ] Backend MCP connections kept alive (connection pooling)
- [ ] Tool routing latency < 100ms (after token validation)
- [ ] Can handle concurrent requests

## Testing Strategy

### Unit Tests (80%+ coverage)
- Services: TokenValidationService, MCPClientManager, ToolAggregator, ToolRoutingService, UniversalMCPServer
- Models: MCPServer, MCPTool
- Middleware: AuthMiddleware
- Mock all external dependencies (identity-service, backend MCP servers)

### Integration Tests
- Management API endpoints (with mocked identity-service)
- Tool sync from backend servers
- End-to-end flow: register server → sync tools → list tools

### Manual Testing
- Connect MCP client (e.g., MCP Inspector) to Universal MCP Server
- Verify token validation happens per request
- Verify only allowed tools are exposed
- Verify tool calls execute correctly
- Test error scenarios (invalid token, identity-service down, backend server down)

## Known Gotchas & Best Practices

### Identity Service Integration
- ⚠️ Call POST /oauth/verify on EVERY request (no caching by design)
- ⚠️ Handle 401, 503, timeout errors gracefully
- ⚠️ Fail immediately if identity-service unavailable (fail-closed)
- ⚠️ Set reasonable timeout (5 seconds recommended)
- ⚠️ Use connection pooling for HTTP requests

### Tool ID Matching
- ⚠️ Tool IDs in JWT allowedTools MUST match toolId in MCPTool collection
- ⚠️ Coordinate with identity-service when adding new tools
- ⚠️ Use consistent naming convention (document in README)

### FastMCP Stateless Mode
- ⚠️ No session state stored
- ⚠️ Validate token on every request
- ⚠️ Filter tools dynamically per request
- ⚠️ Don't cache client-specific data

### Backend MCP Connections
- ⚠️ Keep persistent connections to backend servers (performance)
- ⚠️ But client connections to universal server are stateless
- ⚠️ Handle backend server unavailability gracefully
- ⚠️ Implement reconnection logic with exponential backoff

### Error Handling
- ⚠️ Return clear error messages to clients
- ⚠️ Log errors with context for debugging
- ⚠️ Don't expose sensitive information in errors
- ⚠️ Use proper HTTP status codes (401, 403, 503)

### Mongoose Patterns
- ⚠️ Don't extend Document interface (use HydratedDocument<T>)
- ⚠️ Use Schema<T> generic pattern
- ⚠️ Set { timestamps: true } for createdAt/updatedAt

### TypeDI & routing-controllers
- ⚠️ Import 'reflect-metadata' FIRST in index.ts
- ⚠️ Use useContainer(Container) before createExpressServer
- ⚠️ Use @Service() decorator on all services
- ⚠️ Use @JsonController() for JSON endpoints

## Development Workflow

### Daily Flow
1. Pull latest from main
2. Create feature branch for specific PRP
3. Implement PRP with tests
4. Run validation (build, tests)
5. Push and create PR
6. Review and merge to main

### Validation Steps
```bash
# Build
npm run build

# Type check
npx tsc --noEmit

# Unit tests
npm test tests/unit

# Integration tests
npm test tests/integration

# Coverage
npm run test:coverage
```

### File Size Limit
- No file > 500 lines (enforce via code reviews)
- Refactor large files into smaller modules

## References

### Identity Service Codebase
- Path: `/Users/avinashkumar/Desktop/identity-service`
- Key files to reference:
  - `src/types/TokenPayload.ts` - Token structure
  - `src/services/TokenService.ts` - Token validation patterns
  - `src/middlewares/AuthMiddleware.ts` - Auth middleware pattern
  - `src/controllers/OAuthController.ts` - /oauth/verify endpoint (lines 84-156)
  - `src/models/Application.model.ts` - Mongoose model pattern

### Documentation
- FastMCP: https://www.npmjs.com/package/fastmcp
- MCP Specification: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- MetaMCP (Reference): https://github.com/metatool-ai/metamcp
- routing-controllers: https://github.com/typestack/routing-controllers
- Mongoose TypeScript: https://mongoosejs.com/docs/typescript.html

### Project Guidelines
- CLAUDE.md - Development philosophy and rules
- PLANNING.md - Architecture and design decisions
- TASK.md - Current tasks and progress

## Timeline

### Week 1: Foundation & Core Services
- Day 1-2: PRP 01 (Base Setup)
- Day 3: PRP 02 (Database Models)
- Day 4: PRP 03 (Identity Service Integration)
- Day 5: PRP 04 (MCP Client Management)

### Week 2: Aggregation & APIs
- Day 1: PRP 05 (Tool Aggregation)
- Day 2: PRP 06 (Management REST API)
- Day 3-4: PRP 07 (Universal MCP Server)
- Day 5: PRP 08 (Tool Routing)

### Week 3: Integration & Polish
- Day 1-2: PRP 09 (Bootstrap & Integration Testing)
- Day 3-5: Bug fixes, documentation, deployment prep

## Getting Started

1. **Read this roadmap thoroughly**
2. **Review Identity Service integration** - Understand token structure and /oauth/verify endpoint
3. **Start with PRP 01** - Base setup and configuration
4. **Follow PRPs in order** - Respect dependencies
5. **Run validation after each PRP** - Ensure quality
6. **Keep TASK.md updated** - Track progress

## Questions or Issues?

- Check CLAUDE.md for development guidelines
- Review identity-service codebase for patterns
- Consult FastMCP and MCP documentation
- Reach out for clarifications before starting implementation

---

**Next Steps**: Proceed to [PRP 01: Base Setup & Configuration](./01-base-setup-configuration.md)
