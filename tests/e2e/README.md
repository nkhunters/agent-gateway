# End-to-End Testing for Universal MCP Gateway

This directory contains end-to-end tests for the Universal MCP Gateway that verify the complete flow from client to gateway to downstream MCP servers.

## Test Script: `test-gateway-flow.js`

A standalone Node.js script that tests the complete integration flow.

### What It Tests

1. **Authentication** - Authenticates with Identity Service and obtains JWT token
2. **Server Registration** - Registers downstream MCP servers with the gateway
3. **Tool Discovery** - Syncs and discovers tools from all registered servers
4. **Tool Execution** - Executes tools through the Universal MCP Gateway
5. **Health Verification** - Verifies gateway health and connectivity

### Prerequisites

Before running the test, ensure the following services are running:

1. **MongoDB** - Database for the gateway
   ```bash
   # Default: mongodb://localhost:27017/agent-gateway
   ```

2. **Identity Service** - For authentication
   ```bash
   # Default: http://localhost:8080
   ```

3. **Universal MCP Gateway**
   ```bash
   # Management API: http://localhost:3000
   # MCP Endpoint: http://localhost:3002/mcp
   npm run dev
   ```

4. **Downstream MCP Servers**
   - Playwright MCP Server: `http://localhost:8888/mcp`
   - Second MCP Server: `http://localhost:3001/mcp`

### Running the Test

#### Basic Usage

```bash
node tests/e2e/test-gateway-flow.js
```

Or, since it's executable:

```bash
./tests/e2e/test-gateway-flow.js
```

#### With Environment Variables

You can customize the test endpoints using environment variables:

```bash
GATEWAY_MANAGEMENT_API=http://localhost:3000 \
GATEWAY_MCP_ENDPOINT=http://localhost:3002/mcp \
IDENTITY_SERVICE_URL=http://localhost:8080 \
PLAYWRIGHT_MCP_URL=http://localhost:8888/mcp \
SECOND_MCP_URL=http://localhost:3001/mcp \
node tests/e2e/test-gateway-flow.js
```

#### Using Existing Credentials

If you already have a client registered in the Identity Service:

```bash
CLIENT_ID=your-client-id \
CLIENT_SECRET=your-client-secret \
node tests/e2e/test-gateway-flow.js
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GATEWAY_MANAGEMENT_API` | Gateway Management API URL | `http://localhost:3000` |
| `GATEWAY_MCP_ENDPOINT` | Gateway Universal MCP endpoint | `http://localhost:3002/mcp` |
| `IDENTITY_SERVICE_URL` | Identity Service URL | `http://localhost:8080` |
| `PLAYWRIGHT_MCP_URL` | Playwright MCP Server URL | `http://localhost:8888/mcp` |
| `SECOND_MCP_URL` | Second MCP Server URL | `http://localhost:3001/mcp` |
| `CLIENT_ID` | OAuth Client ID (optional) | Auto-created |
| `CLIENT_SECRET` | OAuth Client Secret (optional) | Auto-created |

### Test Output

The script provides colorful, detailed output showing:

- 🔵 Info messages - Current operation
- ✅ Success messages - Completed operations
- ⚠️ Warning messages - Non-critical issues
- ❌ Error messages - Failed operations

#### Example Output

```
================================================================================
STEP 1: Authentication with Identity Service
================================================================================
ℹ Creating new test application in Identity Service...
ℹ POST http://localhost:8080/applications
✓ Application created: abc123
ℹ Requesting access token...
ℹ POST http://localhost:8080/oauth/token
✓ Access token obtained: eyJhbGciOiJIUzI1NiI...
✓ Authentication: Successfully authenticated with Identity Service

================================================================================
STEP 2: Register Downstream MCP Servers
================================================================================
ℹ Registering Playwright MCP Server...
ℹ POST http://localhost:3000/api/mcp-servers
✓ Registered: playwright-mcp at http://localhost:8888/mcp
...

================================================================================
STEP SUMMARY: Test Results
================================================================================

Test Results:
  ✓ Authentication: Successfully authenticated with Identity Service
  ✓ Register playwright-mcp: Successfully registered at http://localhost:8888/mcp
  ✓ Register second-mcp: Successfully registered at http://localhost:3001/mcp
  ✓ Tool Discovery: Discovered 10 tools across 2 servers
  ✓ Execute playwright-mcp:screenshot: Tool executed successfully through gateway
  ✓ Health Check: Gateway is healthy

================================================================================
Total Tests: 6
Passed: 6
Failed: 0
Success Rate: 100.0%
================================================================================

🎉 All tests passed!
```

### Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed or unexpected error occurred

### Test Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     End-to-End Test Flow                        │
└─────────────────────────────────────────────────────────────────┘

1. Authentication
   └─> Identity Service ──> JWT Token

2. Server Registration
   ├─> POST /api/mcp-servers (Playwright MCP)
   └─> POST /api/mcp-servers (Second MCP)

3. Tool Discovery
   ├─> POST /api/tools/sync
   └─> GET /api/tools ──> List of discovered tools

4. Tool Execution
   ├─> Test Client
   │   └─> Universal MCP Gateway (port 3002)
   │       ├─> Playwright MCP Server (port 8888)
   │       └─> Second MCP Server (port 3001)
   └─> Verify responses

5. Health Check
   └─> GET /api/health
```

### Troubleshooting

#### Test fails at authentication

- Ensure Identity Service is running on the configured port
- Check that the Identity Service is accessible
- Verify MongoDB is running

#### Server registration fails

- Ensure the gateway is running
- Check that MongoDB is connected
- Verify the Management API port is correct

#### Tool discovery returns no tools

- Ensure downstream MCP servers are running
- Check that the MCP servers respond to the `tools/list` method
- Verify the server endpoints are correct

#### Tool execution fails

- Ensure the Universal MCP Server is running on port 3002
- Check that tools were discovered in the previous step
- Verify the JWT token is valid and includes appropriate permissions

### Adding More Tests

You can extend the test script by:

1. Adding more test scenarios in the `testToolExecution()` function
2. Creating additional test files in this directory
3. Testing error cases and edge scenarios
4. Adding performance/load testing

### Dependencies

This script uses only Node.js built-in modules:
- `fetch` - HTTP requests (Node.js 18+)
- No external dependencies required

**Note**: Requires Node.js 18 or higher for native `fetch` support.

### See Also

- [Gateway Architecture Documentation](../../README.md)
- [API Documentation](../../docs/api.md)
- [Integration Tests](../integration/)
