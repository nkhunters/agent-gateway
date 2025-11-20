import 'reflect-metadata'; // MUST BE FIRST
import { createExpressServer, useContainer } from 'routing-controllers';
import { Container } from 'typedi';
import cors from 'cors';
import { logger } from './utils/logger.js';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { MCPClientManager } from './services/MCPClientManager.js';
import { UniversalMCPServer } from './services/UniversalMCPServer.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set up TypeDI container
useContainer(Container);

async function bootstrap() {
  try {
    // Connect to database
    logger.info('Connecting to database...');
    await connectDatabase();
    logger.info('Database connected successfully');

    // // Initialize MCP Client Manager
    // logger.info('Initializing MCP client connections...');
    // const mcpClientManager = Container.get(MCPClientManager);
    // await mcpClientManager.initializeFromDatabase();
    // logger.info('MCP clients initialized');

    // Create Express server with routing-controllers
    const app = createExpressServer({
      routePrefix: '/api',
      controllers: [path.join(__dirname, '/controllers/*.ts')],
      defaultErrorHandler: true
    });

    // Enable CORS
    app.use(cors());

    // Start Management API
    app.listen(env.MANAGEMENT_API_PORT, () => {
      logger.info(`Management API started on port ${env.MANAGEMENT_API_PORT}`);
      logger.info(`Environment: ${env.NODE_ENV}`);
      logger.info(`API prefix: /api`);
    });

    // Start Universal MCP Server
    logger.info('Starting Universal MCP Server...');
    const universalMCPServer = Container.get(UniversalMCPServer);
    await universalMCPServer.start();
    logger.info('Universal MCP Server started successfully');
  } catch (error) {
    logger.fatal({ error }, 'Failed to start server');
    console.error('Error details:', error);
    process.exit(1);
  }
}

bootstrap();
