import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const client = new Client(
  {
    name: 'agent-gateway',
    version: '1.0.0'
  },
  {
    capabilities: {
      roots: { listChanged: true },
      sampling: {}
    }
  }
);

// Create HTTPStream transport
const transport = new StreamableHTTPClientTransport(
  'http://localhost:3002/mcp',
  {
    requestInit: {
      headers: {
        authorization:
          'Bearer '
      }
    }
  }
);

(async () => {
  // Connect
  await client.connect(transport);
  const tools = await client.listTools();
  console.log('Available tools:', tools);
})();
