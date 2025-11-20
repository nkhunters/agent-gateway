// Direct test of MCP connection without going through the API
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function testDirectConnection() {
  const mcpServers = [
    { name: 'Playwright', url: 'http://localhost:8888/mcp' },
    { name: 'Second', url: 'http://localhost:3001/mcp' }
  ];

  for (const server of mcpServers) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing ${server.name} MCP Server: ${server.url}`);
    console.log('='.repeat(60));

    try {
      const client = new Client({
        name: 'diagnostic-test',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      const transport = new StreamableHTTPClientTransport(
        new URL(server.url)
      );

      console.log('1. Connecting to MCP server...');
      await client.connect(transport);
      console.log('✅ Connected successfully\n');

      console.log('2. Listing tools...');
      const result = await client.listTools();
      console.log(`✅ Found ${result.tools.length} tools:\n`);

      if (result.tools.length > 0) {
        result.tools.slice(0, 10).forEach((tool, i) => {
          console.log(`   ${i + 1}. ${tool.name}`);
          console.log(`      Description: ${tool.description || 'No description'}`);
        });
        if (result.tools.length > 10) {
          console.log(`   ... and ${result.tools.length - 10} more`);
        }
      } else {
        console.log('   ⚠️  No tools found on this server');
      }

      await client.close();

    } catch (error) {
      console.error('❌ Error:', error.message);
      if (error.stack) {
        console.error('Stack trace:');
        console.error(error.stack.split('\n').slice(0, 5).join('\n'));
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Diagnostic complete');
  console.log('='.repeat(60));
}

testDirectConnection().catch(console.error);
