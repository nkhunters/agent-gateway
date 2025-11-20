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
          'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzbjdldGFkYSIsImFwcGxpY2F0aW9uTmFtZSI6InRlc3QtY2xpZW50aWQtMTIzIiwiZmluYW5jaWFsSWQiOiJ0ZXN0LWNsaWVudGlkLTEyMyIsImNoYW5uZWxJZCI6InRlc3QtY2xpZW50aWQtMTIzIiwiYWxsb3dlZFRvb2xzIjpbInBsYXl3cmlnaHQtbWNwLXNlcnZlcjpicm93c2VyX2Nsb3NlIiwicGxheXdyaWdodC1tY3Atc2VydmVyOmJyb3dzZXJfcmVzaXplIiwicGxheXdyaWdodC1tY3Atc2VydmVyOmJyb3dzZXJfY29uc29sZV9tZXNzYWdlcyIsInBsYXl3cmlnaHQtbWNwLXNlcnZlcjpicm93c2VyX2hhbmRsZV9kaWFsb2ciLCJwbGF5d3JpZ2h0LW1jcC1zZXJ2ZXI6YnJvd3Nlcl9ldmFsdWF0ZSIsInBsYXl3cmlnaHQtbWNwLXNlcnZlcjpicm93c2VyX2luc3RhbGwiLCJwbGF5d3JpZ2h0LW1jcC1zZXJ2ZXI6YnJvd3Nlcl9uYXZpZ2F0ZSIsInBsYXl3cmlnaHQtbWNwLXNlcnZlcjpicm93c2VyX3Rha2Vfc2NyZWVuc2hvdCJdLCJhbGxvd2VkQXBpcyI6WyJ0ZXN0LWNsaWVudGlkLTEyMyJdLCJpc0RldmVsb3BlclBvcnRhbEFQSXNFbmFibGVkIjpmYWxzZSwianRpIjoiZDhlNGI3MzktNmY4Mi00NjgwLTg4Y2EtOGM5OGJlYWEwMzExIiwidHlwZSI6ImFjY2VzcyIsImlhdCI6MTc2MzY0MDMwNSwiZXhwIjoxNzYzNjQxMjA1fQ.I_cth3iiQfenJGUYcKkJDoKgaMmDaToKzFdDnSF7Nxo'
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
