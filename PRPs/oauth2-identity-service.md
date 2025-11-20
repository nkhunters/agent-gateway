name: "OAuth2 Identity Service with Client Credentials Flow"
description: |

## Purpose

Build a production-ready OAuth2 ClientId/ClientSecret based Identity Service using NodeJS, TypeScript, routing-controllers, and Mongoose. This service will manage application onboarding, JWT token generation/verification/refresh/revocation, and provide authorization capabilities for microservice-to-microservice communication.

## Core Principles

1. **Context is King**: Include ALL necessary documentation, examples, and caveats
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance
5. **Global rules**: Be sure to follow all rules in CLAUDE.md

---

## Goal

Create a fully functional OAuth2 identity service that:

- Enables application onboarding with clientId & clientSecret generation
- Implements OAuth2 Client Credentials flow for JWT token generation
- Provides token verification, refresh, and revocation capabilities
- Supports authorization via allowedTools and allowedApis fields
- Integrates with 3Scale Developer Portal for external API access
- Securely stores and provides 3Scale credentials when needed
- Uses industry-standard encryption for credentials
- Is extensible for future enhancements

## Why

- **Business value**: Centralizes authentication/authorization for microservices
- **Integration**: Secure service-to-service communication without user context
- **Problems solved**:
  - Prevents unauthorized access between microservices
  - Provides fine-grained authorization control (allowedTools, allowedApis)
  - Simplifies credential management across distributed systems
  - Enables token-based security without managing user sessions

## What

A REST API service with:

- Application onboarding endpoint (create clientId & clientSecret)
- Optional 3Scale Developer Portal integration during onboarding
- Secure storage and retrieval of 3Scale credentials
- OAuth2 token generation endpoint (/oauth/token)
- Token verification endpoint (/oauth/verify)
- Token refresh endpoint (/oauth/refresh)
- Token revocation endpoint (/oauth/revoke)
- Endpoint to fetch 3Scale credentials for authenticated applications
- MongoDB for persistent storage
- JWT-based authentication & authorization

### Success Criteria

- [ ] Applications can be onboarded with auto-generated clientId & hashed clientSecret
- [ ] 3Scale Developer Portal APIs can be optionally enabled during onboarding
- [ ] 3Scale credentials are encrypted and stored securely
- [ ] Tokens include isDeveloperPortalAPIsEnabled flag and threeScaleClientId
- [ ] Authenticated microservices can fetch 3Scale credentials when needed
- [ ] Tokens are generated following OAuth2 client credentials flow
- [ ] Tokens can be verified, refreshed, and revoked successfully
- [ ] Authorization checks work based on allowedTools & allowedApis
- [ ] ClientSecrets are securely hashed using Node's crypto module (scrypt)
- [ ] All tests pass with 80%+ coverage
- [ ] Code meets quality standards (no lint/type errors)

## All Needed Context

### Documentation & References

```yaml
# MUST READ - Include these in your context window

- url: https://www.scalekit.com/blog/client-credentials-flow-oauth
  why: Understanding OAuth2 client credentials flow pattern
  critical: This flow is for machine-to-machine communication, no user context

- url: https://github.com/typestack/routing-controllers
  why: Official routing-controllers documentation and patterns
  section: @JsonController, @Post, @Get decorators, dependency injection with typedi

- url: https://mongoosejs.com/docs/typescript.html
  why: Mongoose TypeScript integration patterns
  critical: Don't extend Document interface, use HydratedDocument<T> pattern

- url: https://developer.okta.com/blog/2018/06/06/node-api-oauth-client-credentials
  why: OAuth2 implementation best practices in Node.js

- url: https://jasonwatmore.com/post/2020/06/17/nodejs-mongodb-api-jwt-authentication-with-refresh-tokens
  why: JWT with refresh tokens implementation pattern
  critical: Access tokens short-lived (15min), refresh tokens long-lived (7 days)

- url: https://www.npmjs.com/package/jsonwebtoken
  why: JWT signing and verification API
  section: jwt.sign(), jwt.verify(), token payload structure

- url: https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback
  why: Node.js crypto.scrypt for password hashing (built-in, secure)
  critical: Use scrypt for clientSecret hashing with proper salt and key derivation

- url: https://vitest.dev/guide/
  why: Vitest testing framework documentation
  section: Configuration, writing tests, coverage

- url: https://nodejs.org/api/crypto.html#cryptocreatecipherivalgorithm-key-iv-options
  why: Node.js crypto encryption/decryption for 3Scale clientSecret
  critical: Use AES-256-GCM for authenticated encryption with IV

- url: https://www.npmjs.com/package/nanoid
  why: Generate short, URL-friendly unique IDs for clientId
  critical: Use 8 characters for good uniqueness while keeping IDs compact

```

### Current Codebase Tree

```bash
.
├── .claude/
├── node_modules/
├── PRPs/
│   ├── templates/
│   │   └── prp_base.md
│   └── EXAMPLE_multi_agent_prp.md
├── src/
│   └── index.ts                    # Only imports dotenv
├── .gitignore
├── .prettierrc
├── CLAUDE.md                        # Project guidelines
├── INITIAL.md                       # Feature requirements
├── package.json                     # Has routing-controllers, mongoose, pino, typedi
├── package-lock.json
└── tsconfig.json                    # NodeNext modules, strict mode
```

### Desired Codebase Tree with Files to be Added

```bash
.
├── src/
│   ├── index.ts                          # Server bootstrap with routing-controllers
│   ├── config/
│   │   ├── database.ts                   # MongoDB connection setup
│   │   └── env.ts                        # Environment variable validation
│   ├── models/
│   │   ├── Application.model.ts          # Mongoose schema for applications
│   │   ├── RefreshToken.model.ts         # Mongoose schema for refresh tokens
│   │   └── RevokedToken.model.ts         # Mongoose schema for revoked tokens (blacklist)
│   ├── controllers/
│   │   ├── ApplicationController.ts      # Application onboarding endpoints
│   │   └── OAuthController.ts            # OAuth token endpoints
│   ├── services/
│   │   ├── ApplicationService.ts         # Business logic for applications
│   │   ├── TokenService.ts               # JWT generation/verification/refresh/revoke
│   │   └── EncryptionService.ts          # crypto.scrypt hashing for clientSecret
│   ├── middlewares/
│   │   ├── AuthMiddleware.ts             # JWT verification middleware
│   │   └── AuthorizationMiddleware.ts    # Check allowedTools/allowedApis
│   ├── dto/
│   │   ├── CreateApplicationDto.ts       # Validation for application creation
│   │   ├── TokenRequestDto.ts            # Validation for token request
│   │   ├── TokenRefreshDto.ts            # Validation for token refresh
│   │   └── TokenRevokeDto.ts             # Validation for token revocation
│   ├── types/
│   │   ├── TokenPayload.ts               # JWT payload structure
│   │   └── JwtTokens.ts                  # Access + Refresh token pair
│   └── utils/
│       ├── logger.ts                     # Pino logger setup
│       └── errors.ts                     # Custom error classes
├── tests/
│   ├── unit/
│   │   ├── ApplicationService.test.ts    # Unit tests for application service
│   │   ├── TokenService.test.ts          # Unit tests for token service
│   │   └── EncryptionService.test.ts     # Unit tests for encryption
│   └── integration/
│       ├── application.test.ts           # E2E tests for application endpoints
│       └── oauth.test.ts                 # E2E tests for OAuth endpoints
├── .env.example                          # Environment variables template
├── README.md                             # Comprehensive documentation
└── vitest.config.ts                      # Vitest configuration for testing
```

### Known Gotchas & Library Quirks

```typescript
// CRITICAL: routing-controllers requires "reflect-metadata" import FIRST in index.ts
// CRITICAL: Mongoose with TypeScript - don't extend Document, use Schema<T> generic
// CRITICAL: JWT tokens are stateless - revocation requires MongoDB RevokedToken collection with indexed jti
// CRITICAL: crypto.scrypt hashing is async - always use promisify and await
// CRITICAL: crypto.scrypt requires salt - generate with crypto.randomBytes(16) and store with hash
// CRITICAL: AES-256-GCM encryption for 3Scale clientSecret - requires 32-byte key and random IV
// CRITICAL: Never store 3Scale clientSecret in plaintext - always encrypt before storing
// CRITICAL: Never include 3Scale clientSecret in JWT token - only include clientId
// CRITICAL: OAuth2 client_credentials flow returns access_token + token_type in response
// CRITICAL: typedi Container must be set in routing-controllers options
// CRITICAL: Refresh tokens must be stored in DB for validation on refresh
// CRITICAL: JWT jti claim is required for token revocation
// CRITICAL: clientSecret must be hashed before storing using scrypt with salt
// CRITICAL: Use nanoid(8) for clientId generation - 8 chars gives ~7.5 million IDs before 1% collision probability
// CRITICAL: Environment variables must be validated on startup (fail fast)
// CRITICAL: ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters) for AES-256
// CRITICAL: MongoDB connection should use retry logic
// CRITICAL: RevokedToken collection should have TTL index on expiresAt for automatic cleanup
// CRITICAL: Use @ValidateIf in DTOs to require 3Scale fields when isDeveloperPortalAPIsEnabled is true
```

## Implementation Blueprint

### Data Models and Structure

```typescript
// models/Application.model.ts
import { Schema, model, HydratedDocument } from 'mongoose';

interface IApplication {
  applicationName: string;
  description: string;
  clientId: string; // Auto-generated nanoId (8 characters)
  clientSecret: string; // scrypt hashed (format: salt:hash)
  financialId: string; // Provided by user
  channelId: string; // Provided by user
  allowedTools: string[]; // Array of tool identifiers
  allowedApis: string[]; // Array of API endpoints
  isDeveloperPortalAPIsEnabled: boolean; // Enable 3Scale Developer Portal APIs
  threeScaleClientId?: string; // 3Scale client ID (optional)
  threeScaleClientSecret?: string; // AES-256-GCM encrypted (format: iv:authTag:encrypted)
  isActive: boolean; // For soft deletion/deactivation
  createdAt: Date;
  updatedAt: Date;
}

const applicationSchema = new Schema<IApplication>(
  {
    applicationName: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    clientId: { type: String, required: true, unique: true, index: true },
    clientSecret: { type: String, required: true }, // Hashed
    financialId: { type: String, required: true },
    channelId: { type: String, required: true },
    allowedTools: [{ type: String }],
    allowedApis: [{ type: String }],
    isDeveloperPortalAPIsEnabled: { type: Boolean, default: false },
    threeScaleClientId: { type: String, required: false },
    threeScaleClientSecret: { type: String, required: false }, // Encrypted
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export type ApplicationDocument = HydratedDocument<IApplication>;
export const Application = model<IApplication>(
  'Application',
  applicationSchema
);

// models/RefreshToken.model.ts
interface IRefreshToken {
  jti: string; // JWT ID (unique identifier)
  clientId: string; // Reference to application
  token: string; // Hashed refresh token
  expiresAt: Date;
  isRevoked: boolean;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    jti: { type: String, required: true, unique: true, index: true },
    clientId: { type: String, required: true, index: true },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }, // TTL index
    isRevoked: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export type RefreshTokenDocument = HydratedDocument<IRefreshToken>;
export const RefreshToken = model<IRefreshToken>(
  'RefreshToken',
  refreshTokenSchema
);

// models/RevokedToken.model.ts
interface IRevokedToken {
  jti: string; // JWT ID from revoked token
  tokenType: 'access' | 'refresh'; // Type of token revoked
  expiresAt: Date; // When token would naturally expire
  revokedAt: Date; // When it was revoked
}

const revokedTokenSchema = new Schema<IRevokedToken>(
  {
    jti: { type: String, required: true, unique: true, index: true },
    tokenType: { type: String, required: true, enum: ['access', 'refresh'] },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }, // TTL index
    revokedAt: { type: Date, default: Date.now }
  },
  { timestamps: false }
);

export type RevokedTokenDocument = HydratedDocument<IRevokedToken>;
export const RevokedToken = model<IRevokedToken>(
  'RevokedToken',
  revokedTokenSchema
);

// types/TokenPayload.ts
export interface TokenPayload {
  sub: string; // Subject (clientId)
  jti: string; // JWT ID
  applicationName: string;
  financialId: string;
  channelId: string;
  allowedTools: string[];
  allowedApis: string[];
  isDeveloperPortalAPIsEnabled: boolean; // Flag for 3Scale integration
  threeScaleClientId?: string; // 3Scale client ID (NOT the secret)
  iat: number; // Issued at
  exp: number; // Expires at
  type: 'access' | 'refresh';
}
```

### List of Tasks to be Completed

```yaml
Task 1: Project Setup and Configuration
- UPDATE package.json:
  - Add dependencies: jsonwebtoken, @types/jsonwebtoken, class-validator, class-transformer, nanoid
  - Add dev dependencies: vitest, @vitest/coverage-v8, supertest, @types/supertest
  - Add test script: "test": "vitest"
  - Add coverage script: "test:coverage": "vitest --coverage"

- CREATE src/config/env.ts:
  - PATTERN: Validate environment variables on startup (fail fast)
  - Required vars: MONGODB_URI, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, JWT_ACCESS_EXPIRATION, JWT_REFRESH_EXPIRATION, ENCRYPTION_KEY, PORT
  - Use dotenv to load from .env file
  - CRITICAL: ENCRYPTION_KEY must be 32 bytes (64 hex characters) for AES-256

- CREATE src/config/database.ts:
  - PATTERN: MongoDB connection with retry logic
  - Use mongoose.connect() with proper options
  - Log connection status with pino

- CREATE .env.example:
  - Include all required environment variables with examples

Task 2: Core Services Implementation
- CREATE src/services/EncryptionService.ts:
  - PATTERN: Service pattern with @Service() decorator from typedi
  - hash(plainText: string): Promise<string> - Uses crypto.scrypt with random salt
  - verify(plainText: string, hashedWithSalt: string): Promise<boolean> - Extracts salt and verifies
  - encrypt(plainText: string): string - Uses AES-256-GCM for 3Scale clientSecret encryption
  - decrypt(encryptedText: string): string - Decrypts AES-256-GCM encrypted text
  - CRITICAL: Store hash as "salt:derivedKey" format (both as hex strings)
  - CRITICAL: Use crypto.randomBytes(16) for salt generation
  - CRITICAL: Use scrypt with keylen=64 for strong hashing
  - CRITICAL: Use AES-256-GCM with random IV for encryption (format: iv:authTag:encrypted)
  - CRITICAL: Encryption key should be from environment variable ENCRYPTION_KEY (32 bytes)

- CREATE src/services/TokenService.ts:
  - PATTERN: Service with dependency injection
  - generateTokenPair(application: ApplicationDocument): Promise<{ accessToken, refreshToken }>
  - verifyAccessToken(token: string): Promise<TokenPayload>
  - verifyRefreshToken(token: string): Promise<TokenPayload>
  - refreshAccessToken(refreshToken: string): Promise<{ accessToken }>
  - revokeToken(jti: string, tokenType: 'access' | 'refresh', expiresAt: Date): Promise<void> - Adds to RevokedToken collection
  - isTokenRevoked(jti: string): Promise<boolean> - Checks RevokedToken collection
  - CRITICAL: Use uuid.v4() for jti generation
  - CRITICAL: Store token expiration date for TTL cleanup

- CREATE src/services/ApplicationService.ts:
  - PATTERN: Service with dependency injection
  - createApplication(data: CreateApplicationDto): Promise<ApplicationDocument>
  - findByClientId(clientId: string): Promise<ApplicationDocument | null>
  - validateCredentials(clientId: string, clientSecret: string): Promise<ApplicationDocument>
  - CRITICAL: Generate clientId using nanoid(8) for 8-character unique ID
  - CRITICAL: Hash clientSecret before saving

Task 3: Data Transfer Objects (DTOs)
- CREATE src/dto/CreateApplicationDto.ts:
  - PATTERN: Use class-validator decorators (@IsString, @IsNotEmpty, @IsArray, @IsBoolean, @IsOptional, @ValidateIf, etc.)
  - Fields: applicationName, description, clientSecret (plain), financialId, channelId, allowedTools?, allowedApis?, isDeveloperPortalAPIsEnabled?, threeScaleClientId?, threeScaleClientSecret?
  - CRITICAL: Validate all required fields
  - CRITICAL: Use @ValidateIf to make threeScaleClientId and threeScaleClientSecret required when isDeveloperPortalAPIsEnabled is true

- CREATE src/dto/TokenRequestDto.ts:
  - PATTERN: OAuth2 client_credentials grant
  - Fields: grant_type (must be 'client_credentials'), client_id, client_secret
  - CRITICAL: Validate grant_type === 'client_credentials'

- CREATE src/dto/TokenRefreshDto.ts:
  - Fields: grant_type (must be 'refresh_token'), refresh_token

- CREATE src/dto/TokenRevokeDto.ts:
  - Fields: token (can be access or refresh token)

Task 4: Controllers Implementation
- CREATE src/controllers/ApplicationController.ts:
  - PATTERN: @JsonController('/applications') decorator
  - POST /applications - Create application (onboarding)
  - GET /applications/:clientId - Get application details (requires auth)
  - GET /applications/:clientId/3scale-credentials - Get decrypted 3Scale credentials (requires auth)
  - CRITICAL: Return plaintext clientSecret only on creation, never again
  - CRITICAL: Hash clientSecret before storing
  - CRITICAL: Encrypt threeScaleClientSecret before storing
  - CRITICAL: Only return 3Scale credentials if isDeveloperPortalAPIsEnabled is true
  - CRITICAL: Validate that requesting application has permission to access 3Scale credentials

- CREATE src/controllers/OAuthController.ts:
  - PATTERN: @JsonController('/oauth') decorator
  - POST /oauth/token - Generate tokens (client_credentials or refresh_token grant)
  - POST /oauth/verify - Verify access token and return payload
  - POST /oauth/revoke - Revoke token (access or refresh)
  - CRITICAL: Follow OAuth2 response format: { access_token, token_type, expires_in, refresh_token }
  - CRITICAL: Validate credentials before generating token

Task 5: Middleware Implementation
- CREATE src/middlewares/AuthMiddleware.ts:
  - PATTERN: @Middleware({ type: 'before' }) decorator
  - Extract Bearer token from Authorization header
  - Verify token using TokenService
  - Check if token is revoked
  - Attach payload to request context
  - CRITICAL: Handle token expiration errors

- CREATE src/middlewares/AuthorizationMiddleware.ts:
  - PATTERN: Custom decorator @Authorize({ tools?: string[], apis?: string[] })
  - Check if request payload contains required tools/apis
  - Return 403 Forbidden if unauthorized

Task 6: Server Bootstrap
- UPDATE src/index.ts:
  - CRITICAL: Import 'reflect-metadata' FIRST
  - Initialize database connection
  - Setup routing-controllers with createExpressServer()
  - Configure CORS middleware
  - Configure error handling
  - Start server on PORT from env

- CREATE src/utils/logger.ts:
  - PATTERN: Setup pino logger with proper configuration
  - Export singleton instance

- CREATE src/utils/errors.ts:
  - PATTERN: Custom error classes extending Error
  - UnauthorizedError, ForbiddenError, ValidationError, NotFoundError

Task 7: Testing
- CREATE vitest.config.ts:
  - PATTERN: Configure for TypeScript
  - Coverage thresholds: 80%
  - Setup test environment for Node.js

- CREATE tests/unit/EncryptionService.test.ts:
  - Test hash() produces different hashes for same input
  - Test verify() returns true for correct password
  - Test verify() returns false for incorrect password

- CREATE tests/unit/TokenService.test.ts:
  - Test generateTokenPair() creates valid tokens
  - Test verifyAccessToken() validates correct token
  - Test verifyAccessToken() rejects expired token
  - Test revokeToken() adds to blacklist
  - Test isTokenRevoked() checks blacklist correctly

- CREATE tests/unit/ApplicationService.test.ts:
  - Test createApplication() generates unique clientId
  - Test createApplication() hashes clientSecret
  - Test validateCredentials() succeeds with correct credentials
  - Test validateCredentials() fails with incorrect credentials

- CREATE tests/integration/application.test.ts:
  - Test POST /applications creates application
  - Test POST /applications returns plaintext clientSecret once
  - Test GET /applications/:clientId requires authentication

- CREATE tests/integration/oauth.test.ts:
  - Test POST /oauth/token with valid credentials returns tokens
  - Test POST /oauth/token with invalid credentials returns 401
  - Test POST /oauth/verify with valid token returns payload
  - Test POST /oauth/verify with revoked token returns 401
  - Test POST /oauth/revoke revokes token
  - Test POST /oauth/token with refresh_token grant refreshes access token

Task 8: Add 3Scale Credentials Endpoint
- ADD to ApplicationController:
  - GET /applications/:clientId/3scale-credentials endpoint
  - Verify requesting application is authenticated
  - Check if isDeveloperPortalAPIsEnabled is true
  - Decrypt threeScaleClientSecret using EncryptionService
  - Return both threeScaleClientId and decrypted threeScaleClientSecret
  - Handle cases where 3Scale is not enabled

Task 9: Documentation
- CREATE README.md:
  - PATTERN: Include architecture overview, setup instructions, API documentation
  - Document all environment variables (including ENCRYPTION_KEY)
  - Provide example requests/responses
  - Include 3Scale integration workflow
  - Include security considerations
```

### Per Task Pseudocode

```typescript
// Task 2: EncryptionService implementation using Node crypto
import { scrypt, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// Hashing for clientSecret (one-way)
async hash(plainText: string): Promise<string> {
  // PATTERN: Generate random salt
  const salt = randomBytes(16).toString('hex');

  // CRITICAL: Derive key using scrypt (CPU and memory hard)
  const derivedKey = (await scryptAsync(plainText, salt, 64)) as Buffer;

  // PATTERN: Return salt:hash format for storage
  return `${salt}:${derivedKey.toString('hex')}`;
}

async verify(plainText: string, hashedWithSalt: string): Promise<boolean> {
  // PATTERN: Extract salt and hash from stored value
  const [salt, storedHash] = hashedWithSalt.split(':');

  // CRITICAL: Derive key with same salt
  const derivedKey = (await scryptAsync(plainText, salt, 64)) as Buffer;
  const storedHashBuffer = Buffer.from(storedHash, 'hex');

  // PATTERN: Use timing-safe comparison to prevent timing attacks
  return timingSafeEqual(derivedKey, storedHashBuffer);
}

// Encryption for 3Scale clientSecret (reversible)
encrypt(plainText: string): string {
  // CRITICAL: Get encryption key from environment (32 bytes for AES-256)
  const encryptionKey = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

  // PATTERN: Generate random IV for each encryption
  const iv = randomBytes(16);

  // CRITICAL: Use AES-256-GCM for authenticated encryption
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);

  // Encrypt the plaintext
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get authentication tag
  const authTag = cipher.getAuthTag().toString('hex');

  // PATTERN: Return iv:authTag:encrypted format
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

decrypt(encryptedText: string): string {
  // PATTERN: Extract IV, auth tag, and encrypted data
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');

  // CRITICAL: Get same encryption key from environment
  const encryptionKey = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  // CRITICAL: Use AES-256-GCM for authenticated decryption
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey, iv);
  decipher.setAuthTag(authTag);

  // Decrypt the data
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// Task 2: TokenService.generateTokenPair()
async generateTokenPair(application: ApplicationDocument): Promise<JwtTokens> {
  // PATTERN: Generate unique jti for both tokens
  const accessJti = uuid.v4();
  const refreshJti = uuid.v4();

  // PATTERN: Create payload with application details
  const basePayload = {
    sub: application.clientId,
    applicationName: application.applicationName,
    financialId: application.financialId,
    channelId: application.channelId,
    allowedTools: application.allowedTools,
    allowedApis: application.allowedApis,
    isDeveloperPortalAPIsEnabled: application.isDeveloperPortalAPIsEnabled,
    threeScaleClientId: application.threeScaleClientId // Include 3Scale client ID (NOT secret)
  };

  // CRITICAL: Sign access token with short expiration
  const accessToken = jwt.sign(
    { ...basePayload, jti: accessJti, type: 'access' },
    JWT_ACCESS_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRATION } // e.g., '15m'
  );

  // CRITICAL: Sign refresh token with long expiration
  const refreshToken = jwt.sign(
    { ...basePayload, jti: refreshJti, type: 'refresh' },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRATION } // e.g., '7d'
  );

  // PATTERN: Store refresh token in database for validation
  await RefreshToken.create({
    jti: refreshJti,
    clientId: application.clientId,
    token: await this.encryptionService.hash(refreshToken), // Hash before storing
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  return { accessToken, refreshToken };
}

// Task 2: TokenService.revokeToken()
async revokeToken(jti: string, tokenType: 'access' | 'refresh', expiresAt: Date): Promise<void> {
  // PATTERN: Add jti to RevokedToken collection
  await RevokedToken.create({
    jti,
    tokenType,
    expiresAt, // MongoDB TTL index will auto-delete after this date
    revokedAt: new Date()
  });

  // PATTERN: If refresh token, also mark as revoked in RefreshToken collection
  if (tokenType === 'refresh') {
    await RefreshToken.updateOne({ jti }, { isRevoked: true });
  }
}

// Task 2: TokenService.isTokenRevoked()
async isTokenRevoked(jti: string): Promise<boolean> {
  // PATTERN: Check if jti exists in RevokedToken collection
  const revokedToken = await RevokedToken.findOne({ jti });
  return revokedToken !== null;
}

// Task 4: ApplicationController.create() - with 3Scale support
import { nanoid } from 'nanoid';

@Post('/applications')
async create(@Body() dto: CreateApplicationDto) {
  // PATTERN: Generate unique 8-character clientId
  const clientId = nanoid(8); // e.g., "V1StGXR8"

  // CRITICAL: Hash clientSecret before storing
  const hashedSecret = await this.encryptionService.hash(dto.clientSecret);

  // PATTERN: Encrypt 3Scale clientSecret if provided
  let encryptedThreeScaleSecret: string | undefined;
  if (dto.isDeveloperPortalAPIsEnabled && dto.threeScaleClientSecret) {
    encryptedThreeScaleSecret = this.encryptionService.encrypt(dto.threeScaleClientSecret);
  }

  // Create application
  const application = await this.applicationService.createApplication({
    ...dto,
    clientId,
    clientSecret: hashedSecret,
    threeScaleClientSecret: encryptedThreeScaleSecret
  });

  // CRITICAL: Return plaintext clientSecret only on creation
  return {
    clientId: application.clientId,
    clientSecret: dto.clientSecret, // Plain text, only returned once!
    applicationName: application.applicationName,
    // ... other fields (but NOT threeScaleClientSecret in plain)
  };
}

// Task 8: ApplicationController.get3ScaleCredentials()
@Get('/applications/:clientId/3scale-credentials')
@UseBefore(AuthMiddleware) // Requires authentication
async get3ScaleCredentials(
  @Param('clientId') clientId: string,
  @Req() request: Request
) {
  // PATTERN: Get requesting application from token
  const requestingApp = request.user; // Set by AuthMiddleware

  // PATTERN: Fetch application data
  const application = await this.applicationService.findByClientId(clientId);

  if (!application) {
    throw new NotFoundError('Application not found');
  }

  // CRITICAL: Check if Developer Portal APIs are enabled
  if (!application.isDeveloperPortalAPIsEnabled) {
    throw new ForbiddenError('Developer Portal APIs are not enabled for this application');
  }

  // PATTERN: Decrypt 3Scale clientSecret
  const decryptedSecret = this.encryptionService.decrypt(application.threeScaleClientSecret!);

  // Return 3Scale credentials
  return {
    threeScaleClientId: application.threeScaleClientId,
    threeScaleClientSecret: decryptedSecret
  };
}

// Task 4: OAuthController.token()
@Post('/token')
async token(@Body() dto: TokenRequestDto | TokenRefreshDto) {
  // PATTERN: Handle different grant types
  if (dto.grant_type === 'client_credentials') {
    // CRITICAL: Validate credentials
    const app = await applicationService.validateCredentials(
      dto.client_id,
      dto.client_secret
    );

    if (!app || !app.isActive) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Generate token pair
    const tokens = await tokenService.generateTokenPair(app);

    // CRITICAL: Follow OAuth2 response format
    return {
      access_token: tokens.accessToken,
      token_type: 'Bearer',
      expires_in: 900, // 15 minutes in seconds
      refresh_token: tokens.refreshToken
    };
  } else if (dto.grant_type === 'refresh_token') {
    // PATTERN: Verify refresh token and generate new access token
    const payload = await tokenService.verifyRefreshToken(dto.refresh_token);

    // Check if refresh token is revoked
    if (await tokenService.isTokenRevoked(payload.jti)) {
      throw new UnauthorizedError('Token has been revoked');
    }

    // Get application and generate new access token
    const app = await applicationService.findByClientId(payload.sub);
    const { accessToken } = await tokenService.refreshAccessToken(app);

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 900
    };
  }

  throw new ValidationError('Invalid grant_type');
}

// Task 5: AuthMiddleware
@Middleware({ type: 'before' })
export class AuthMiddleware implements ExpressMiddlewareInterface {
  constructor(
     private tokenService: TokenService
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      // PATTERN: Extract Bearer token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        throw new UnauthorizedError('No token provided');
      }

      const token = authHeader.substring(7);

      // CRITICAL: Verify token signature
      const payload = await this.tokenService.verifyAccessToken(token);

      // CRITICAL: Check if token is revoked
      if (await this.tokenService.isTokenRevoked(payload.jti)) {
        throw new UnauthorizedError('Token has been revoked');
      }

      // PATTERN: Attach payload to request for use in controllers
      req.user = payload;
      next();
    } catch (error) {
      // PATTERN: Handle different error types
      if (error.name === 'TokenExpiredError') {
        res.status(401).json({ error: 'Token expired' });
      } else if (error.name === 'JsonWebTokenError') {
        res.status(401).json({ error: 'Invalid token' });
      } else {
        next(error);
      }
    }
  }
}
```

### Integration Points

```yaml
ENVIRONMENT:
  - .env file with:
    # Server
    PORT=3000
    NODE_ENV=development

    # MongoDB
    MONGODB_URI=mongodb://localhost:27017/identity-service

    # JWT
    JWT_ACCESS_SECRET=your-secret-access-key-change-in-production
    JWT_REFRESH_SECRET=your-secret-refresh-key-change-in-production
    JWT_ACCESS_EXPIRATION=15m
    JWT_REFRESH_EXPIRATION=7d

    # Encryption (AES-256 requires 32 bytes = 64 hex characters)
    ENCRYPTION_KEY=your-64-character-hex-encryption-key-change-in-production

DATABASE:
  - MongoDB indexes:
    - Application.clientId (unique)
    - Application.applicationName (unique)
    - RefreshToken.jti (unique)
    - RefreshToken.clientId
    - RefreshToken.expiresAt (TTL index for automatic cleanup)
    - RevokedToken.jti (unique)
    - RevokedToken.expiresAt (TTL index for automatic cleanup)

DEPENDENCIES:
  - npm install jsonwebtoken @types/jsonwebtoken
  - npm install class-validator class-transformer
  - npm install nanoid
  - npm install --save-dev vitest @vitest/coverage-v8 supertest @types/supertest
```

## Validation Loop

### Level 1: Build & Type Checking

```bash
# Run these FIRST - fix any errors before proceeding
npm run build                    # Compile TypeScript
npx tsc --noEmit                 # Type checking without emitting files

# Expected: No errors. If errors, READ and fix.
```

### Level 2: Unit Tests

```bash
# Run unit tests for services
npm test -- tests/unit

# Expected tests:
# ✓ EncryptionService.hash() produces valid hash
# ✓ EncryptionService.verify() validates correctly
# ✓ TokenService.generateTokenPair() creates valid tokens
# ✓ TokenService.verifyAccessToken() validates tokens
# ✓ TokenService.revokeToken() adds to blacklist
# ✓ ApplicationService.createApplication() generates clientId
# ✓ ApplicationService.validateCredentials() works correctly

# If failing: Debug specific test, fix code, re-run
```

### Level 3: Integration Tests

```bash
# Start dependencies (MongoDB only)
# Option 1: Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Option 2: Local MongoDB
# Make sure MongoDB is running locally

# Run integration tests
npm test tests/integration

# Expected tests:
# ✓ POST /applications creates application with hashed secret
# ✓ POST /oauth/token returns tokens with valid credentials
# ✓ POST /oauth/token returns 401 with invalid credentials
# ✓ POST /oauth/verify validates token correctly
# ✓ POST /oauth/revoke revokes token
# ✓ POST /oauth/token with refresh_token grant works
# ✓ Revoked token fails verification

# If failing: Check logs, fix code, re-run
```

### Level 4: Manual Integration Test

```bash
# Start the service
npm run dev

# Test 1: Create application without 3Scale
curl -X POST http://localhost:3000/applications \
  -H "Content-Type: application/json" \
  -d '{
    "applicationName": "TestApp",
    "description": "Test application",
    "clientSecret": "test-secret-123",
    "financialId": "FIN-001",
    "channelId": "CH-001",
    "allowedTools": ["tool1", "tool2"],
    "allowedApis": ["/api/users", "/api/products"],
    "isDeveloperPortalAPIsEnabled": false
  }'

# Expected:
# {
#   "clientId": "V1StGXR8",  // 8-character nanoId
#   "clientSecret": "test-secret-123",  // Only returned once!
#   "applicationName": "TestApp",
#   ...
# }

# Test 1b: Create application with 3Scale enabled
curl -X POST http://localhost:3000/applications \
  -H "Content-Type: application/json" \
  -d '{
    "applicationName": "TestAppWith3Scale",
    "description": "Test application with 3Scale",
    "clientSecret": "test-secret-456",
    "financialId": "FIN-002",
    "channelId": "CH-001",
    "allowedTools": ["tool1"],
    "allowedApis": ["/api/external"],
    "isDeveloperPortalAPIsEnabled": true,
    "threeScaleClientId": "3scale-client-id-123",
    "threeScaleClientSecret": "3scale-secret-789"
  }'

# Expected:
# {
#   "clientId": "A2kT9xLm",  // 8-character nanoId
#   "clientSecret": "test-secret-456",  // Only returned once!
#   "applicationName": "TestAppWith3Scale",
#   ...
# }

# Test 2: Get access token
curl -X POST http://localhost:3000/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "client_credentials",
    "client_id": "V1StGXR8",
    "client_secret": "test-secret-123"
  }'

# Expected:
# {
#   "access_token": "eyJhbGc...",
#   "token_type": "Bearer",
#   "expires_in": 900,
#   "refresh_token": "eyJhbGc..."
# }

# Test 3: Verify token
curl -X POST http://localhost:3000/oauth/verify \
  -H "Content-Type: application/json" \
  -d '{"token": "eyJhbGc..."}'

# Expected: Token payload with allowedTools and allowedApis

# Test 4: Revoke token
curl -X POST http://localhost:3000/oauth/revoke \
  -H "Content-Type: application/json" \
  -d '{"token": "eyJhbGc..."}'

# Expected: Success response

# Test 5: Verify revoked token fails
curl -X POST http://localhost:3000/oauth/verify \
  -H "Content-Type: application/json" \
  -d '{"token": "eyJhbGc..."}'

# Expected: 401 Unauthorized

# Test 6: Get 3Scale credentials (if enabled)
curl -X GET http://localhost:3000/applications/V1StGXR8/3scale-credentials \
  -H "Authorization: Bearer eyJhbGc..."

# Expected (if isDeveloperPortalAPIsEnabled is true):
# {
#   "threeScaleClientId": "3scale-client-id-123",
#   "threeScaleClientSecret": "3scale-secret-789"  // Decrypted
# }

# Expected (if isDeveloperPortalAPIsEnabled is false):
# 403 Forbidden - Developer Portal APIs are not enabled
```

## Final Validation Checklist

- [ ] All unit tests pass: `npm test tests/unit`
- [ ] All integration tests pass: `npm test tests/integration`
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] Code coverage > 80%: `npm run test:coverage`
- [ ] MongoDB connection successful on startup
- [ ] Environment variables validated on startup (including ENCRYPTION_KEY)
- [ ] Application creation generates unique 8-character clientId using nanoId
- [ ] ClientSecret is hashed before storage using scrypt
- [ ] 3Scale clientSecret is encrypted before storage using AES-256-GCM
- [ ] Tokens include isDeveloperPortalAPIsEnabled flag
- [ ] Tokens include threeScaleClientId (but NOT secret)
- [ ] Tokens follow OAuth2 format
- [ ] Token verification works correctly
- [ ] Token revocation via MongoDB RevokedToken collection works
- [ ] TTL indexes clean up expired tokens automatically
- [ ] Refresh token flow works
- [ ] Authorization checks allowedTools/allowedApis
- [ ] 3Scale credentials endpoint returns decrypted secrets
- [ ] 3Scale credentials endpoint checks isDeveloperPortalAPIsEnabled
- [ ] README.md has clear setup instructions
- [ ] .env.example includes all variables (including ENCRYPTION_KEY)

---

## Anti-Patterns to Avoid

- ❌ Don't store plaintext clientSecret - always hash with crypto.scrypt
- ❌ Don't extend Document in Mongoose TypeScript - use Schema<T> generic
- ❌ Don't forget 'reflect-metadata' import at top of index.ts
- ❌ Don't skip token revocation collection - JWTs need blacklist mechanism
- ❌ Don't use short expiration for refresh tokens - defeats their purpose
- ❌ Don't return clientSecret after initial creation - security risk
- ❌ Don't skip environment variable validation - fail fast on startup
- ❌ Don't use md5 or sha1 for passwords - use scrypt (CPU and memory hard)
- ❌ Don't forget to set MongoDB TTL indexes on expiresAt - automatic cleanup
- ❌ Don't skip jti claim in JWT - needed for revocation
- ❌ Don't use synchronous hashing - crypto.scrypt should be async
- ❌ Don't skip typedi Container setup in routing-controllers
- ❌ Don't hardcode secrets - use environment variables
- ❌ Don't forget salt when hashing - crypto.scrypt requires it
- ❌ Don't use timing-unsafe comparison for hashes - use timingSafeEqual
- ❌ Don't store 3Scale clientSecret in plaintext - always encrypt with AES-256-GCM
- ❌ Don't include 3Scale clientSecret in JWT payload - only include clientId
- ❌ Don't reuse IV for encryption - generate new random IV for each encryption
- ❌ Don't use weak encryption (AES-CBC, DES) - use AES-256-GCM for authenticated encryption
- ❌ Don't skip conditional validation - use @ValidateIf for isDeveloperPortalAPIsEnabled

## Security Considerations

- **ClientID generation**: Use nanoid(8) for URL-friendly, collision-resistant 8-character IDs
- **ClientSecret hashing**: Use crypto.scrypt with 64-byte key derivation (CPU and memory-hard)
- **Salt generation**: Use crypto.randomBytes(16) for cryptographically secure random salts
- **Hash comparison**: Use timingSafeEqual() to prevent timing attacks
- **3Scale encryption**: Use AES-256-GCM for authenticated encryption of 3Scale clientSecret
- **Encryption key**: ENCRYPTION_KEY must be 32 bytes (64 hex characters), securely generated and stored
- **IV generation**: Generate random IV for each encryption operation using crypto.randomBytes(16)
- **JWT secrets**: Use strong, random secrets (minimum 256 bits)
- **Token expiration**: Access tokens short (15m), refresh tokens longer (7d)
- **Token payload**: Never include secrets in JWT payload (only include threeScaleClientId, not secret)
- **HTTPS**: Use HTTPS in production (not handled in this implementation)
- **Rate limiting**: Consider adding rate limiting to token endpoint (future enhancement)
- **Input validation**: Use class-validator on all DTOs with conditional validation for 3Scale
- **Error messages**: Don't leak sensitive information in error responses
- **MongoDB**: Use connection string with authentication in production
- **TTL indexes**: Ensure TTL indexes are active for automatic token cleanup
- **Access control**: Only return 3Scale credentials when isDeveloperPortalAPIsEnabled is true
- **Key rotation**: Plan for ENCRYPTION_KEY rotation strategy in production

## Extension Points (Future Enhancements)

- **Scope-based permissions**: Add OAuth2 scopes for finer-grained control
- **Token introspection**: Add /oauth/introspect endpoint
- **Client management**: Add update/delete endpoints for applications
- **3Scale credential updates**: Add endpoint to update 3Scale credentials without re-onboarding
- **Audit logging**: Log all authentication attempts, token operations, and 3Scale credential access
- **Rate limiting**: Add rate limiting per clientId
- **Token rotation**: Implement refresh token rotation for better security
- **Encryption key rotation**: Implement strategy to rotate ENCRYPTION_KEY without data loss
- **Multi-tenancy**: Add organization/tenant support
- **Webhook notifications**: Notify on security events (revocations, failed attempts, 3Scale access)
- **3Scale credential caching**: Cache decrypted 3Scale credentials temporarily to reduce decryption overhead

---

## Confidence Score: 9/10

**High confidence due to:**

- Clear OAuth2 client credentials flow pattern (well-documented)
- Strong examples from routing-controllers documentation
- Mongoose TypeScript patterns well-established
- JWT implementation with jsonwebtoken is straightforward
- Node.js crypto module is built-in, well-documented, and battle-tested
- AES-256-GCM encryption is industry standard for sensitive data
- MongoDB TTL indexes provide automatic cleanup (no external dependencies)
- All necessary libraries are mature and stable
- Clear validation gates at each level
- Vitest is modern, fast, and well-suited for TypeScript projects
- Simplified architecture (no Redis dependency to manage)
- 3Scale integration follows secure encryption best practices

**Minor uncertainty (confidence adjusted from 9.5 to 9):**

- routing-controllers + typedi integration might have version-specific quirks
- 3Scale encryption/decryption adds complexity but follows established patterns
- Conditional validation with @ValidateIf needs careful implementation
- These can be resolved during implementation with error messages and testing

**Why this will succeed:**

1. Implementation follows proven patterns from documented sources
2. Clear separation of concerns (services, controllers, models)
3. Comprehensive testing strategy (unit + integration with vitest)
4. Progressive validation (build → unit → integration → manual)
5. Fail-fast approach (env validation, connection checks)
6. All security best practices included (scrypt, AES-256-GCM, timing-safe comparison)
7. Clear extension points for future growth
8. Uses Node.js built-in crypto module (no external crypto dependencies)
9. MongoDB TTL indexes handle cleanup automatically
10. Simplified deployment (one database instead of two)
11. 3Scale integration is optional and properly validated
12. Encryption keys managed via environment variables with clear documentation
13. Compact, URL-friendly clientIds (8 chars vs 36 for UUID) improve UX and reduce storage
