import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from './logger';
import { env } from '../config/env';

/**
 * Axios instance configured for Identity Service API calls
 *
 * Features:
 * - Base URL from environment
 * - 5-second timeout (fail-fast)
 * - Request/response logging
 * - Error transformation
 */
export const identityServiceClient: AxiosInstance = axios.create({
  baseURL: env.IDENTITY_SERVICE_URL,
  timeout: 5000, // 5 seconds - fail fast
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

/**
 * Request interceptor: Log outgoing requests
 */
identityServiceClient.interceptors.request.use(
  (config) => {
    logger.debug(
      {
        method: config.method,
        url: config.url,
        baseURL: config.baseURL
      },
      'Outgoing request to identity-service'
    );
    return config;
  },
  (error) => {
    logger.error({ error }, 'Request interceptor error');
    return Promise.reject(error);
  }
);

/**
 * Response interceptor: Log responses and transform errors
 */
identityServiceClient.interceptors.response.use(
  (response) => {
    logger.debug(
      {
        status: response.status,
        url: response.config.url
      },
      'Response from identity-service'
    );
    return response;
  },
  (error: AxiosError) => {
    if (error.code === 'ECONNREFUSED') {
      logger.error(
        {
          url: error.config?.url,
          baseURL: error.config?.baseURL
        },
        'Identity service connection refused'
      );
      return Promise.reject(
        new Error('Identity service unavailable (connection refused)')
      );
    }

    if (error.code === 'ETIMEDOUT') {
      logger.error(
        {
          url: error.config?.url,
          timeout: error.config?.timeout
        },
        'Identity service request timeout'
      );
      return Promise.reject(
        new Error('Identity service unavailable (timeout)')
      );
    }

    if (error.response) {
      // Server responded with error status
      logger.warn(
        {
          status: error.response.status,
          data: error.response.data,
          url: error.config?.url
        },
        'Identity service error response'
      );
    }

    return Promise.reject(error);
  }
);

/**
 * Helper to check if error is axios error
 */
export function isAxiosError(error: any): error is AxiosError {
  return error.isAxiosError === true;
}
