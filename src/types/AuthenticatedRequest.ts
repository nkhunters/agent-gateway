import { Request } from 'express';
import { TokenPayload } from './TokenPayload';

/**
 * Express Request with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}
