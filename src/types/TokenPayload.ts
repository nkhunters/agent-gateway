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
  [key: string]: unknown;           // Index signature for FastMCP compatibility
}
