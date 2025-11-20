// Test backend MCP servers directly
const PLAYWRIGHT_MCP = 'http://localhost:8888/mcp';
const SECOND_MCP = 'http://localhost:3001/mcp';

async function testBackendMCPs() {
  console.log('🧪 Testing Backend MCP Servers Directly\n');

  const servers = [
    { name: 'Playwright MCP (8888)', url: PLAYWRIGHT_MCP },
    { name: 'Second MCP (3001)', url: SECOND_MCP }
  ];

  for (const server of servers) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${server.name}`);
    console.log('='.repeat(60));

    try {
      // Step 1: Initialize
      console.log('\n1. Sending initialize request...');
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          clientInfo: {
            name: 'test-client',
            version: '1.0.0'
          },
          capabilities: {}
        }
      };

      const initResponse = await fetch(server.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify(initRequest)
      });

      if (!initResponse.ok) {
        const text = await initResponse.text();
        console.log(`   ❌ Initialize failed: ${text.substring(0, 200)}`);
        continue;
      }

      const initData = await initResponse.json();
      console.log(`   ✅ Initialized successfully`);
      console.log(`   Server: ${JSON.stringify(initData.result?.serverInfo || {})}`);

      // Step 2: Send initialized notification
      console.log('\n2. Sending initialized notification...');
      const initializedNotif = {
        jsonrpc: '2.0',
        method: 'notifications/initialized',
        params: {}
      };

      await fetch(server.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify(initializedNotif)
      });
      console.log(`   ✅ Notification sent`);

      // Step 3: List tools
      console.log('\n3. Listing tools...');
      const toolsRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      };

      const toolsResponse = await fetch(server.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        body: JSON.stringify(toolsRequest)
      });

      console.log(`   Status: ${toolsResponse.status}`);

      if (toolsResponse.ok) {
        const toolsData = await toolsResponse.json();
        if (toolsData.result && toolsData.result.tools) {
          console.log(`   ✅ Found ${toolsData.result.tools.length} tools:`);
          toolsData.result.tools.slice(0, 10).forEach((tool, i) => {
            console.log(`      ${i + 1}. ${tool.name} - ${tool.description || 'No description'}`);
          });
        } else {
          console.log('   Response:', JSON.stringify(toolsData, null, 2));
        }
      } else {
        const text = await toolsResponse.text();
        console.log(`   ❌ Error: ${text.substring(0, 300)}`);
      }
    } catch (error) {
      console.log(`❌ Connection Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Test Complete');
  console.log('='.repeat(60));
}

testBackendMCPs().catch(console.error);
