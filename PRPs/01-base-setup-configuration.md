# PRP 01: Base Setup & Configuration

## Goal

Establish the foundational infrastructure for the Agent Gateway Service, including dependencies, environment configuration, database connectivity, TypeScript types, and logging setup.

## Why

A solid foundation is critical for:
- Consistent development experience across the team
- Type safety throughout the codebase
- Reliable database connectivity
- Proper environment variable validation (fail-fast approach)
- Structured logging for debugging and monitoring

## What

### Deliverables
1. ✅ Updated `package.json` with all required dependencies
2. ✅ Environment variable configuration with validation
3. ✅ MongoDB connection service with retry logic
4. ✅ Core TypeScript type definitions
5. ✅ Logger configuration verification

### Success Criteria
- [ ] `npm install` completes without errors
- [ ] TypeScript compiles successfully (`npm run build`)
- [ ] Environment validation catches missing variables
- [ ] MongoDB connection established with retry logic
- [ ] Logger outputs properly formatted messages
- [ ] All types compile without errors

## Context & References

### Identity Service Patterns to Follow
- **Environment Validation**: `/Users/avinashkumar/Desktop/identity-service/src/config/env.ts:17-46`
- **Database Connection**: `/Users/avinashkumar/Desktop/identity-service/src/config/database.ts`
- **Logger Setup**: `/Users/avinashkumar/Desktop/identity-service/src/utils/logger.ts`
- **Token Types**: `/Users/avinashkumar/Desktop/identity-service/src/types/TokenPayload.ts`

### Documentation
- TypeDI: https://github.com/typestack/typedi
- Mongoose TypeScript: https://mongoosejs.com/docs/typescript.html
- Pino: https://getpino.io/
- FastMCP: https://www.npmjs.com/package/fastmcp

## Implementation Tasks

### Task 1: Update package.json Dependencies

**File**: `package.json`

**Action**: Add new dependencies for MCP and HTTP client functionality

```json
{
  "name": "agent-gateway",
  "version": "1.0.0",
  "description": "Agent Gateway Service - MCP Proxy with Token-Based Access Control",
  "main": "src/index.ts",
  "scripts": {
    "build": "tsc",
    "dev": "nodemon src/index.ts | npx pino-pretty",
    "start": "node dist/src/index.js",
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  },
  "keywords": [
    "mcp",
    "agent-gateway",
    "proxy",
    "token-auth"
  ],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "@types/uuid": "^11.0.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.2",
    "mongoose": "^8.5.3",
    "pino": "^9.3.2",
    "reflect-metadata": "^0.2.2",
    "routing-controllers": "0.6.11",
    "typedi": "0.8.0",
    "uuid": "^11.0.0",
    "fastmcp": "latest",
    "@modelcontextprotocol/sdk": "latest",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.5",
    "@types/node": "^20.12.7",
    "@types/supertest": "^6.0.3",
    "@vitest/coverage-v8": "^2.0.5",
    "eslint": "9.39.1",
    "nodemon": "^3.1.4",
    "pino-pretty": "^11.2.2",
    "supertest": "^7.1.4",
    "ts-node": "^10.9.2",
    "typescript": "^5.9.3",
    "vitest": "^2.0.5"
  }
}
```

**New Dependencies Explained**:
- `fastmcp` - FastMCP library for creating MCP servers
- `@modelcontextprotocol/sdk` - Official MCP TypeScript SDK (for MCP client connections)
- `axios` - HTTP client for calling identity-service API

**Run**:
```bash
npm install
```

---

### Task 2: Update Environment Configuration

**File**: `src/config/env.ts`

**Pattern**: Follow identity-service pattern (fail-fast validation)
**Reference**: `/Users/avinashkumar/Desktop/identity-service/src/config/env.ts:17-46`

```typescript
import { config } from 'dotenv';

// Load environment variables
config();

interface EnvConfig {
  // Server Configuration
  MANAGEMENT_API_PORT: number;
  UNIVERSAL_MCP_PORT: number;
  NODE_ENV: string;

  // MongoDB
  MONGODB_URI: string;

  // Identity Service Integration
  IDENTITY_SERVICE_URL: string;

  // Logging
  LOG_LEVEL: string;
}

function validateEnv(): EnvConfig {
  const requiredVars = [
    'MONGODB_URI',
    'IDENTITY_SERVICE_URL'
  ];

  const missing = requiredVars.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }

  // Validate IDENTITY_SERVICE_URL format
  const identityServiceUrl = process.env.IDENTITY_SERVICE_URL!;
  try {
    new URL(identityServiceUrl);
  } catch (error) {
    throw new Error(
      `IDENTITY_SERVICE_URL must be a valid URL (e.g., http://localhost:3000)`
    );
  }

  return {
    MANAGEMENT_API_PORT: parseInt(process.env.MANAGEMENT_API_PORT || '3000', 10),
    UNIVERSAL_MCP_PORT: parseInt(process.env.UNIVERSAL_MCP_PORT || '3001', 10),
    NODE_ENV: process.env.NODE_ENV || 'development',
    MONGODB_URI: process.env.MONGODB_URI!,
    IDENTITY_SERVICE_URL: identityServiceUrl,
    LOG_LEVEL: process.env.LOG_LEVEL || 'info'
  };
}

export const env = validateEnv();
```

**Key Points**:
- ✅ Fail-fast: Throws error on startup if required vars missing
- ✅ Type-safe: Returns typed EnvConfig object
- ✅ Validation: Checks URL format for IDENTITY_SERVICE_URL
- ✅ Defaults: Sensible defaults for optional variables

---

### Task 3: Update .env.example

**File**: `.env.example`

```env
# Server Configuration
MANAGEMENT_API_PORT=3000
UNIVERSAL_MCP_PORT=3001
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/agent-gateway

# Identity Service Integration (CRITICAL)
# This should point to your running identity-service instance
IDENTITY_SERVICE_URL=http://localhost:3000

# Logging
# Levels: trace, debug, info, warn, error, fatal
LOG_LEVEL=info
```

**Important Notes**:
- ⚠️ NO `JWT_ACCESS_SECRET` - validation happens via identity-service API
- ⚠️ `IDENTITY_SERVICE_URL` must be accessible from agent-gateway
- ⚠️ Ports must not conflict (3000 for API, 3001 for MCP server)

---

### Task 4: Create Database Connection Service

**File**: `src/config/database.ts`

**Pattern**: Copy from identity-service with retry logic
**Reference**: `/Users/avinashkumar/Desktop/identity-service/src/config/database.ts`

```typescript
import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import { env } from './env';

/**
 * Connect to MongoDB with retry logic
 *
 * Implements exponential backoff for connection failures:
 * - 1st retry: 1 second
 * - 2nd retry: 2 seconds
 * - 3rd retry: 4 seconds
 * - 4th retry: 8 seconds
 * - 5th retry: 16 seconds (max)
 */
export async function connectDatabase(
  retries: number = 5,
  delay: number = 1000
): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });

    logger.info(
      {
        host: mongoose.connection.host,
        name: mongoose.connection.name
      },
      'MongoDB connected successfully'
    );

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error({ err }, 'MongoDB connection error');
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

  } catch (error) {
    if (retries > 0) {
      logger.warn(
        {
          error: (error as Error).message,
          retriesLeft: retries,
          retryDelay: delay
        },
        'MongoDB connection failed, retrying...'
      );

      // Wait before retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));

      // Retry with exponential backoff (max delay: 16 seconds)
      return connectDatabase(retries - 1, Math.min(delay * 2, 16000));
    }

    logger.error(
      { error: (error as Error).message },
      'Failed to connect to MongoDB after all retries'
    );
    process.exit(1); // Exit if database unavailable
  }
}

/**
 * Gracefully close database connection
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error({ error }, 'Error closing MongoDB connection');
  }
}
```

**Key Features**:
- ✅ Retry logic with exponential backoff
- ✅ Connection pooling (min: 2, max: 10)
- ✅ Timeout configuration
- ✅ Event listeners for connection status
- ✅ Graceful shutdown support

---

### Task 5: Verify Logger Configuration

**File**: `src/utils/logger.ts` (already exists, verify it matches pattern)

**Pattern**: Should match identity-service logger
**Reference**: `/Users/avinashkumar/Desktop/identity-service/src/utils/logger.ts`

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
          }
        }
      : undefined
});
```

**Verify**:
- ✅ Uses LOG_LEVEL from environment
- ✅ Pretty printing in development
- ✅ JSON output in production

---

### Task 6: Create TypeScript Type Definitions

#### File: `src/types/TokenPayload.ts`

**Pattern**: Mirror identity-service token structure
**Reference**: `/Users/avinashkumar/Desktop/identity-service/src/types/TokenPayload.ts:1-15`

```typescript
/**
 * JWT Token Payload Structure
 *
 * This mirrors the token structure from Identity Service
 * Reference: identity-service/src/types/TokenPayload.ts
 */
export interface TokenPayload {
  sub: string;                      // Subject (clientId)
  jti: string;                      // JWT ID (unique identifier)
  applicationName: string;
  financialId: string;
  channelId: string;
  allowedTools: string[];           // ← KEY: Tools this client can access
  allowedApis: string[];
  isDeveloperPortalAPIsEnabled: boolean;
  threeScaleClientId?: string;
  iat: number;                      // Issued at (timestamp)
  exp: number;                      // Expires at (timestamp)
  type: 'access' | 'refresh';
}
```

---

#### File: `src/types/IdentityServiceResponse.ts`

```typescript
import { TokenPayload } from './TokenPayload';

/**
 * Response from Identity Service /oauth/verify endpoint
 */
export interface IdentityServiceVerifyResponse {
  valid: boolean;
  payload?: {
    clientId: string;
    jti: string;
    applicationName: string;
    financialId: string;
    channelId: string;
    allowedTools: string[];         // ← Tools this client can access
    allowedApis: string[];
    isDeveloperPortalAPIsEnabled: boolean;
    threeScaleClientId?: string;
    issuedAt: string;               // ISO 8601 format
    expiresAt: string;              // ISO 8601 format
  };
  error?: string;
  message?: string;
  expiredAt?: string;
}
```

---

#### File: `src/types/MCPToolDefinition.ts`

```typescript
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
```

---

#### File: `src/types/index.ts`

```typescript
// Central export point for all types
export * from './TokenPayload';
export * from './IdentityServiceResponse';
export * from './MCPToolDefinition';
```

---

### Task 7: Update tsconfig.json (if needed)

**File**: `tsconfig.json`

Verify the following settings are present:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strictPropertyInitialization": false,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Key Settings**:
- `experimentalDecorators: true` - Required for TypeDI and routing-controllers
- `emitDecoratorMetadata: true` - Required for dependency injection
- `strictPropertyInitialization: false` - Needed for TypeDI constructor injection

---

### Task 8: Verify Project Structure

Ensure the following structure exists:

```
agent-gateway/
├── src/
│   ├── index.ts
│   ├── config/
│   │   ├── env.ts          ← Updated
│   │   └── database.ts      ← Created
│   ├── controllers/
│   │   └── HealthController.ts
│   ├── types/
│   │   ├── TokenPayload.ts          ← Created
│   │   ├── IdentityServiceResponse.ts ← Created
│   │   ├── MCPToolDefinition.ts     ← Created
│   │   └── index.ts                 ← Created
│   └── utils/
│       └── logger.ts        ← Verified
├── .env.example             ← Updated
├── package.json             ← Updated
├── tsconfig.json            ← Verified
└── vitest.config.ts
```

---

## Validation

### Level 1: Installation
```bash
npm install
```
**Expected**: No errors, all dependencies installed

### Level 2: TypeScript Compilation
```bash
npm run build
```
**Expected**: Builds successfully, creates `dist/` directory with compiled JavaScript

### Level 3: Type Checking
```bash
npx tsc --noEmit
```
**Expected**: No type errors

### Level 4: Environment Validation

Create a test `.env` file:
```env
MONGODB_URI=mongodb://localhost:27017/agent-gateway
IDENTITY_SERVICE_URL=http://localhost:3000
```

Start the server:
```bash
npm run dev
```

**Expected**:
- ✅ Environment variables validated
- ✅ Logger initializes
- ✅ MongoDB connection attempts (may fail if MongoDB not running, that's okay for now)

### Level 5: Environment Validation Failure Test

Remove `MONGODB_URI` from `.env`:
```bash
npm run dev
```

**Expected**: Error message: "Missing required environment variables: MONGODB_URI" and process exits

### Level 6: Invalid URL Test

Set invalid `IDENTITY_SERVICE_URL`:
```env
IDENTITY_SERVICE_URL=not-a-valid-url
```

```bash
npm run dev
```

**Expected**: Error message about invalid URL format

---

## Known Gotchas

### 1. reflect-metadata Import Order
⚠️ **CRITICAL**: `reflect-metadata` must be imported FIRST in `src/index.ts`

```typescript
import 'reflect-metadata'; // MUST be first
import { createExpressServer } from 'routing-controllers';
// ... other imports
```

**Why**: routing-controllers and TypeDI require metadata reflection

---

### 2. TypeDI Container Setup
When creating the Express server, set the TypeDI container:

```typescript
import { useContainer } from 'routing-controllers';
import { Container } from 'typedi';

useContainer(Container);

const app = createExpressServer({
  // ...
});
```

---

### 3. Environment Variables in Production
- Never commit `.env` file to git
- Use `.env.example` as template
- In production, set env vars via deployment platform (not .env file)

---

### 4. MongoDB Connection Retries
- Default: 5 retries with exponential backoff
- Adjust in `src/config/database.ts` if needed
- Process exits if all retries fail (fail-fast approach)

---

### 5. Mongoose with TypeScript
- Don't extend `Document` interface
- Use `HydratedDocument<T>` for document types
- Use `Schema<T>` generic pattern
- This will be important in PRP 02 (Database Models)

---

## Next Steps

After completing this PRP:
1. ✅ All dependencies installed
2. ✅ Environment validation working
3. ✅ Database connection configured
4. ✅ TypeScript types defined
5. ✅ Logger verified

**Proceed to**: [PRP 02: Database Models & Tool Registry](./02-database-models-tool-registry.md)

---

## Checklist

- [ ] `npm install` completes successfully
- [ ] `npm run build` compiles without errors
- [ ] `npx tsc --noEmit` shows no type errors
- [ ] Environment validation catches missing variables
- [ ] Invalid IDENTITY_SERVICE_URL is rejected
- [ ] Logger outputs properly in development mode
- [ ] All type files created and compile successfully
- [ ] Project structure matches expected layout
- [ ] `.env.example` updated with all required variables
- [ ] `reflect-metadata` imported first in index.ts

---

**Status**: 🟢 Ready for Implementation
**Estimated Time**: 1-2 days
**Dependencies**: None
**Next PRP**: 02 - Database Models & Tool Registry
