# Agent Gateway - Planning Document

## Project Overview

Agent Gateway is an MCP (Model Context Protocol) proxy service that provides token-based access control and tool registry management. It acts as a centralized gateway between AI agents and MCP servers, enforcing fine-grained permissions based on JWT tokens issued by the Identity Service.

## Architecture

### High-Level Components

```
┌─────────────────┐
│  AI Agent/Client│
└────────┬────────┘
         │ Bearer Token
         ▼
┌─────────────────────────────────┐
│     Agent Gateway Service       │
│  ┌──────────────────────────┐  │
│  │  Management API (3000)   │  │
│  │  - Health Check          │  │
│  │  - Tool Registry         │  │
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │
│  │ Universal MCP Server     │  │
│  │      (3001)              │  │
│  │  - Token Validation      │  │
│  │  - Permission Check      │  │
│  │  - Tool Routing          │  │
│  └──────────────────────────┘  │
└────────┬────────────────────────┘
         │
         ├──────► Identity Service (Token Validation)
         │
         └──────► MCP Servers (Tool Execution)
```

### Core Services

1. **Management API** (Port 3000)
   - RESTful HTTP API
   - Tool registration and management
   - Health checks
   - Administrative operations

2. **Universal MCP Server** (Port 3001)
   - MCP protocol server
   - Token-based authentication
   - Dynamic tool routing based on permissions
   - Tool execution proxying

3. **Identity Service Integration**
   - Token validation via HTTP API
   - Client permission resolution
   - No local JWT validation (delegated to Identity Service)

## Technology Stack

### Core Dependencies
- **TypeScript**: Type-safe development
- **Express**: Management API server
- **routing-controllers**: Decorator-based routing
- **TypeDI**: Dependency injection
- **fastmcp**: MCP server implementation
- **@modelcontextprotocol/sdk**: Official MCP TypeScript SDK
- **axios**: HTTP client for Identity Service calls
- **mongoose**: MongoDB ODM
- **pino**: Structured logging
- **dotenv**: Environment configuration

### Development Tools
- **jest**: Testing framework
- **ts-node**: TypeScript execution
- **nodemon**: Development auto-reload
- **pino-pretty**: Log formatting

## Design Principles

### KISS (Keep It Simple, Stupid)
- Use straightforward patterns
- Avoid over-engineering
- Clear, readable code

### YAGNI (You Aren't Gonna Need It)
- Implement only what's needed now
- No speculative features
- Extend when required

### Dependency Inversion
- Depend on abstractions, not implementations
- Use interfaces for service contracts

### Fail Fast
- Validate early (environment, tokens, permissions)
- Clear error messages
- Graceful degradation where appropriate

## File Structure

```
agent-gateway/
├── src/
│   ├── index.ts                 # Application entry point
│   ├── config/
│   │   ├── env.ts              # Environment validation
│   │   └── database.ts         # MongoDB connection
│   ├── controllers/
│   │   └── HealthController.ts # Health check endpoint
│   ├── types/
│   │   ├── TokenPayload.ts             # JWT payload structure
│   │   ├── IdentityServiceResponse.ts  # Identity Service API types
│   │   ├── MCPToolDefinition.ts        # MCP tool types
│   │   └── index.ts                     # Type exports
│   ├── models/                  # Mongoose models (future)
│   ├── services/                # Business logic (future)
│   ├── middlewares/             # Express/MCP middlewares (future)
│   └── utils/
│       └── logger.ts            # Pino logger configuration
├── tests/                       # Unit tests
├── PRPs/                        # Planning & Reference Patterns
├── package.json
├── tsconfig.json
├── .env.example
├── CLAUDE.md                    # Development guidelines
├── PLANNING.md                  # This file
└── TASK.md                      # Task tracking
```

## Key Patterns

### Environment Configuration
- Fail-fast validation on startup
- Required variables throw errors
- Optional variables have sensible defaults
- URL format validation for external services

### Database Connection
- Exponential backoff retry logic
- Connection pooling (min: 2, max: 10)
- Event-based connection monitoring
- Graceful shutdown support

### Logging
- Structured JSON logging (production)
- Pretty formatting (development)
- Configurable log levels
- Context-aware log messages

### Type Safety
- Strict TypeScript configuration
- Interface-based contracts
- No `any` types
- Comprehensive type definitions

## Integration Points

### Identity Service
- **Endpoint**: `${IDENTITY_SERVICE_URL}/oauth/verify`
- **Method**: POST
- **Payload**: `{ token: string }`
- **Response**: IdentityServiceVerifyResponse
- **Purpose**: Validate JWT tokens and retrieve client permissions

### MCP Servers (Future)
- Dynamic discovery and registration
- Health monitoring
- Tool capability caching
- Connection pooling

## Security Considerations

1. **Token Validation**
   - All requests must include valid Bearer token
   - Validation delegated to Identity Service
   - No local token signing/verification

2. **Permission Enforcement**
   - Tool access controlled by `allowedTools` in token
   - Exact string matching (no wildcards initially)
   - Deny by default

3. **Connection Security**
   - HTTPS recommended for production
   - Environment variable validation
   - No sensitive data in logs

## Performance Targets

- **Token Validation**: < 100ms (depends on Identity Service)
- **Tool Routing**: < 10ms (in-memory lookup)
- **Database Queries**: < 50ms (indexed queries)
- **MCP Tool Execution**: Depends on backend server

## Testing Strategy

- Unit tests for all business logic
- Integration tests for API endpoints
- Mock Identity Service for testing
- Test both success and failure paths
- Edge case coverage

## Future Enhancements (Not Implemented Yet)

- Token caching with TTL
- Rate limiting per client
- Tool execution metrics
- Admin dashboard
- WebSocket support for MCP
- Tool version management
- Health check aggregation

## Naming Conventions

### Files
- PascalCase for classes: `HealthController.ts`
- camelCase for utilities: `database.ts`, `logger.ts`
- Descriptive names: `TokenPayload.ts`, not `Token.ts`

### Variables
- camelCase: `clientId`, `allowedTools`
- Constants: UPPER_SNAKE_CASE in env
- Boolean prefixes: `is`, `has`, `should`

### Functions
- Verbs: `validateEnv()`, `connectDatabase()`
- Descriptive: `disconnectDatabase()`, not `cleanup()`

### Interfaces
- PascalCase: `TokenPayload`, `EnvConfig`
- No `I` prefix
- Descriptive: `IdentityServiceVerifyResponse`

## Error Handling

- Throw errors early in validation
- Use typed errors where appropriate
- Log errors with context
- Return meaningful error messages to clients
- Never expose internal details in production

## Deployment Considerations

- Environment variables via platform (not .env in production)
- MongoDB connection string from secrets manager
- Health check endpoint for load balancer
- Graceful shutdown handling
- Process manager (PM2, systemd)

## Development Workflow

1. Read PLANNING.md (this file) at start
2. Check TASK.md for current work
3. Implement with tests
4. Update TASK.md on completion
5. Update README.md if needed
6. Follow CLAUDE.md guidelines

## Success Metrics

- All tests passing
- Type checking passing
- Build succeeds without warnings
- Environment validation working
- MongoDB connection stable
- Code follows style guide
- Documentation up to date

---

**Last Updated**: 2025-11-19
**Status**: Base setup complete (PRP 01)
**Next**: Database models and tool registry (PRP 02)
