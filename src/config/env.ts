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

  const missing = requiredVars.filter(key => !process.env[key] || process.env[key]?.trim() === '');

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
