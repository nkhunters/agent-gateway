import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createExpressServer, useContainer } from 'routing-controllers';
import mongoose from 'mongoose';
import { Container } from 'typedi';
import { MCPServer } from '../../src/models/MCPServer.model';
import { MCPTool } from '../../src/models/MCPTool.model';
import { TokenValidationService } from '../../src/services/TokenValidationService';
import { TokenPayload } from '../../src/types/TokenPayload';
import path from 'path';

// Mock TokenValidationService to bypass real Identity Service calls
jest.mock('../../src/services/TokenValidationService');

describe('MCP Servers API Integration Tests', () => {
  let app: express.Application;
  const mockUserId = 'test-user-123';
  const mockClientId = 'test-client-456';

  beforeAll(async () => {
    // Connect to test database
    const mongoUri = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/agent-gateway-test';
    await mongoose.connect(mongoUri);

    // Set up TypeDI
    useContainer(Container);

    // Mock TokenValidationService
    const MockTokenValidationService = TokenValidationService as jest.MockedClass<typeof TokenValidationService>;
    MockTokenValidationService.prototype.validateToken = jest.fn().mockResolvedValue({
      sub: mockUserId,
      clientId: mockClientId,
      allowedTools: ['*']
    } as TokenPayload);

    // Create Express app with routing-controllers
    app = createExpressServer({
      routePrefix: '/api',
      controllers: [path.join(__dirname, '/../../src/controllers/*.ts')],
      middlewares: [path.join(__dirname, '/../../src/middlewares/*.ts')],
      defaultErrorHandler: true
    });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await MCPServer.deleteMany({});
    await MCPTool.deleteMany({});
  });

  describe('POST /api/mcp-servers', () => {
    test('should register new MCP server', async () => {
      const response = await request(app)
        .post('/api/mcp-servers')
        .set('Authorization', 'Bearer mock-token')
        .send({
          serverId: 'test-mcp',
          name: 'Test MCP Server',
          description: 'Test server for integration tests',
          endpoint: 'http://localhost:8080/mcp'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.server.serverId).toBe('test-mcp');
      expect(response.body.server.name).toBe('Test MCP Server');

      // Verify server was created in database
      const server = await MCPServer.findByServerId('test-mcp');
      expect(server).not.toBeNull();
      expect(server?.serverId).toBe('test-mcp');
    });

    test('should reject duplicate serverId', async () => {
      // Create server first
      await MCPServer.create({
        serverId: 'duplicate-server',
        name: 'Duplicate',
        description: 'Test duplicate',
        endpoint: 'http://localhost:8080/mcp'
      });

      // Try to create again
      const response = await request(app)
        .post('/api/mcp-servers')
        .set('Authorization', 'Bearer mock-token')
        .send({
          serverId: 'duplicate-server',
          name: 'Duplicate 2',
          description: 'Test duplicate again',
          endpoint: 'http://localhost:8081/mcp'
        });

      expect(response.body.error).toBe('Server already exists');
      expect(response.body.message).toContain('duplicate-server');
    });

    test('should reject invalid serverId format', async () => {
      const response = await request(app)
        .post('/api/mcp-servers')
        .set('Authorization', 'Bearer mock-token')
        .send({
          serverId: 'INVALID SERVER!',
          name: 'Test',
          description: 'Test description here',
          endpoint: 'http://localhost:8080/mcp'
        });

      expect(response.status).toBe(400);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .post('/api/mcp-servers')
        .send({
          serverId: 'test-mcp',
          name: 'Test',
          description: 'Test description',
          endpoint: 'http://localhost:8080/mcp'
        });

      expect(response.status).toBe(401);
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/mcp-servers')
        .set('Authorization', 'Bearer mock-token')
        .send({
          serverId: 'test'
          // Missing name, description, endpoint
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/mcp-servers', () => {
    test('should list all servers', async () => {
      // Create test servers
      await MCPServer.create([
        {
          serverId: 'server1',
          name: 'Server 1',
          description: 'Test server 1',
          endpoint: 'http://localhost:8080/mcp'
        },
        {
          serverId: 'server2',
          name: 'Server 2',
          description: 'Test server 2',
          endpoint: 'http://localhost:8081/mcp'
        }
      ]);

      const response = await request(app)
        .get('/api/mcp-servers')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.servers).toHaveLength(2);
      expect(response.body.totalCount).toBe(2);
    });

    test('should return empty list when no servers exist', async () => {
      const response = await request(app)
        .get('/api/mcp-servers')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.servers).toHaveLength(0);
      expect(response.body.totalCount).toBe(0);
    });
  });

  describe('GET /api/mcp-servers/:serverId', () => {
    test('should get specific server', async () => {
      await MCPServer.create({
        serverId: 'test-server',
        name: 'Test Server',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp'
      });

      const response = await request(app)
        .get('/api/mcp-servers/test-server')
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.server.serverId).toBe('test-server');
      expect(response.body.server.name).toBe('Test Server');
    });

    test('should return error for non-existent server', async () => {
      const response = await request(app)
        .get('/api/mcp-servers/non-existent')
        .set('Authorization', 'Bearer mock-token');

      expect(response.body.error).toBe('Not found');
      expect(response.body.message).toContain('non-existent');
    });
  });

  describe('DELETE /api/mcp-servers/:serverId', () => {
    test('should remove server', async () => {
      const server = await MCPServer.create({
        serverId: 'test-server',
        name: 'Test',
        description: 'Test server to delete',
        endpoint: 'http://localhost:8080/mcp'
      });

      const response = await request(app)
        .delete(`/api/mcp-servers/${server.serverId}`)
        .set('Authorization', 'Bearer mock-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('test-server');

      // Verify server was deleted
      const deleted = await MCPServer.findByServerId('test-server');
      expect(deleted).toBeNull();
    });

    test('should return error when deleting non-existent server', async () => {
      const response = await request(app)
        .delete('/api/mcp-servers/non-existent')
        .set('Authorization', 'Bearer mock-token');

      expect(response.body.error).toBe('Not found');
    });
  });

  describe('POST /api/mcp-servers/:serverId/reconnect', () => {
    test('should attempt reconnection', async () => {
      await MCPServer.create({
        serverId: 'test-server',
        name: 'Test',
        description: 'Test',
        endpoint: 'http://localhost:8080/mcp'
      });

      const response = await request(app)
        .post('/api/mcp-servers/test-server/reconnect')
        .set('Authorization', 'Bearer mock-token');

      // Note: This will likely fail to connect since there's no real MCP server
      // But the endpoint should respond without crashing
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
    });

    test('should return error for non-existent server', async () => {
      const response = await request(app)
        .post('/api/mcp-servers/non-existent/reconnect')
        .set('Authorization', 'Bearer mock-token');

      expect(response.body.error).toBe('Not found');
    });
  });
});
