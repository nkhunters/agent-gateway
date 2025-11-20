import { Service } from 'typedi';
import { TokenPayload } from '../types/TokenPayload';
import { IdentityServiceVerifyResponse } from '../types/IdentityServiceResponse';
import { identityServiceClient, isAxiosError } from '../utils/httpClient';
import { logger } from '../utils/logger';

/**
 * Token Validation Service
 *
 * Validates JWT tokens by calling Identity Service API
 * NO JWT secrets stored locally - all validation via API
 */
@Service()
export class TokenValidationService {
  /**
   * Validate JWT token via Identity Service /oauth/verify endpoint
   *
   * @param token - JWT token string
   * @returns TokenPayload if valid
   * @throws Error if token invalid or identity-service unavailable
   */
  async validateToken(token: string): Promise<TokenPayload> {
    try {
      logger.debug('Validating token with identity-service');

      // Call POST /oauth/verify
      const response = await identityServiceClient.post<IdentityServiceVerifyResponse>(
        '/oauth/verify',
        { token }
      );

      const data = response.data;

      // Check if valid
      if (!data.valid || !data.payload) {
        logger.warn(
          {
            error: data.error,
            message: data.message
          },
          'Token validation failed'
        );

        // Return specific error message
        throw new Error(data.error || 'Token validation failed');
      }

      // Convert response payload to TokenPayload
      const payload: TokenPayload = {
        sub: data.payload.clientId,
        jti: data.payload.jti,
        applicationName: data.payload.applicationName,
        financialId: data.payload.financialId,
        channelId: data.payload.channelId,
        allowedTools: data.payload.allowedTools,
        allowedApis: data.payload.allowedApis,
        isDeveloperPortalAPIsEnabled: data.payload.isDeveloperPortalAPIsEnabled,
        threeScaleClientId: data.payload.threeScaleClientId,
        iat: new Date(data.payload.issuedAt).getTime() / 1000,
        exp: new Date(data.payload.expiresAt).getTime() / 1000,
        type: 'access' // Assuming access tokens only for agent-gateway
      };

      logger.info(
        {
          clientId: payload.sub,
          allowedToolsCount: payload.allowedTools.length
        },
        'Token validated successfully'
      );

      return payload;

    } catch (error: any) {
      // Handle network/connection errors (fail-closed)
      if (
        error.message.includes('unavailable') ||
        error.message.includes('timeout') ||
        error.message.includes('connection refused')
      ) {
        logger.error(
          { error: error.message },
          'Identity service unavailable - failing closed'
        );
        throw new Error('Identity service unavailable');
      }

      // Handle axios errors
      if (isAxiosError(error)) {
        if (error.response) {
          // Server responded with error
          const status = error.response.status;

          if (status === 401) {
            logger.warn('Token validation failed: Unauthorized');
            throw new Error('Invalid or expired token');
          }

          if (status === 400) {
            logger.warn('Token validation failed: Bad request');
            throw new Error('Malformed token');
          }

          // Other server errors
          logger.error(
            { status, data: error.response.data },
            'Identity service error'
          );
          throw new Error('Identity service error');
        }
      }

      // Re-throw other errors
      logger.error({ error: error.message }, 'Token validation failed');
      throw error;
    }
  }

  /**
   * Extract token from Authorization header
   *
   * @param authHeader - Authorization header value
   * @returns Token string or null
   */
  extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null;
    }

    // Check Bearer format
    if (!authHeader.startsWith('Bearer ')) {
      return null;
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer '

    if (!token || token.trim() === '') {
      return null;
    }

    return token;
  }
}
