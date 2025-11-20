import { Request, Response, NextFunction } from 'express';
import { ExpressMiddlewareInterface } from 'routing-controllers';
import { Service, Container } from 'typedi';
import { TokenValidationService } from '../services/TokenValidationService';
import { AuthenticatedRequest } from '../types/AuthenticatedRequest';
import { logger } from '../utils/logger';

/**
 * Authentication Middleware
 *
 * Validates JWT tokens via Identity Service API
 * Attaches decoded payload to request.user for downstream use
 *
 * Returns 401 for:
 * - Missing authorization header
 * - Invalid Bearer token format
 * - Invalid/expired token
 *
 * Returns 503 for:
 * - Identity service unavailable
 */
@Service()
export class AuthMiddleware implements ExpressMiddlewareInterface {
  private tokenValidationService: TokenValidationService;
  constructor() {
    this.tokenValidationService = Container.get(TokenValidationService);
  }

  async use(req: Request, res: Response, next?: NextFunction): Promise<any> {
    console.log('token servie', this.tokenValidationService);
    logger.info({ path: req.path }, '🔐 AuthMiddleware executed');
    try {
      console.log(req.headers);
      // Extract Authorization header
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        logger.warn({ path: req.path }, 'No authorization header provided');
        res.status(401).json({
          error: 'Unauthorized',
          message: 'No authorization header provided'
        });
        return;
      }

      // Extract token from header
      const token =
        this.tokenValidationService.extractTokenFromHeader(authHeader);

      if (!token) {
        logger.warn({ path: req.path }, 'Invalid authorization format');
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Authorization header must be "Bearer <token>"'
        });
        return;
      }

      // Validate token via identity-service API
      const payload = await this.tokenValidationService.validateToken(token);

      // Attach payload to request
      (req as AuthenticatedRequest).user = payload;

      logger.debug(
        {
          clientId: payload.sub,
          path: req.path
        },
        'Request authenticated'
      );

      if (next) next();
    } catch (error: any) {
      logger.warn(
        {
          path: req.path,
          error: error.message
        },
        'Authentication failed'
      );

      // Handle identity service unavailable (fail-closed with 503)
      if (error.message.includes('Identity service unavailable')) {
        res.status(503).json({
          error: 'Service Unavailable',
          message: 'Authentication service is currently unavailable'
        });
        return;
      }

      // Handle invalid/expired tokens (401)
      if (
        error.message.includes('Invalid') ||
        error.message.includes('expired') ||
        error.message.includes('Malformed')
      ) {
        res.status(401).json({
          error: 'Unauthorized',
          message: error.message
        });
        return;
      }

      // Generic authentication error (401)
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication failed'
      });
    }
  }
}
