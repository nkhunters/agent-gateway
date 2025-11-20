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
