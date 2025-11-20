// Simple MCP protocol test
const IDENTITY_SERVICE = 'http://localhost:8080';
const UNIVERSAL_MCP = 'http://localhost:3002/mcp';

async function testMCPProtocol() {
  console.log('🔍 Testing MCP Protocol\n');

  // Get token
  console.log('1. Getting token...');
  const appData = {
    applicationName: `MCPTest-${Date.now()}`,
    description: 'Simple MCP test',
    financialId: 'FIN001',
    channelId: 'TEST',
    clientSecret: `secret-${Date.now()}`,
    allowedTools: ['*'],
    allowedApis: ['*'],
    isDeveloperPortalAPIsEnabled: false
  };

  const appResponse = await fetch(`${IDENTITY_SERVICE}/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(appData)
  });
  const appResult = await appResponse.json();

  const tokenResponse = await fetch(`${IDENTITY_SERVICE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: appResult.clientId,
      client_secret: appData.clientSecret
    })
  });
  const tokenResult = await tokenResponse.json();
  const token = tokenResult.access_token;
  console.log(`   ✅ Token: ${token.substring(0, 30)}...\n`);

  // Test 1: Initialize
  console.log('2. Testing MCP initialize...');
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

  const initResponse = await fetch(UNIVERSAL_MCP, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(initRequest)
  });

  console.log(`   Status: ${initResponse.status}`);
  const initText = await initResponse.text();
  console.log(`   Response: ${initText}\n`);

  // Test 2: Tools list
  console.log('3. Testing MCP tools/list...');
  const toolsRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  };

  const toolsResponse = await fetch(UNIVERSAL_MCP, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(toolsRequest)
  });

  console.log(`   Status: ${toolsResponse.status}`);
  const toolsText = await toolsResponse.text();

  if (toolsResponse.ok) {
    try {
      const toolsData = JSON.parse(toolsText);
      if (toolsData.result && toolsData.result.tools) {
        console.log(`   ✅ Found ${toolsData.result.tools.length} tools:`);
        toolsData.result.tools.slice(0, 5).forEach((tool, i) => {
          console.log(`      ${i + 1}. ${tool.name}`);
        });
      } else {
        console.log(`   Response: ${toolsText}`);
      }
    } catch (e) {
      console.log(`   Response: ${toolsText}`);
    }
  } else {
    console.log(`   ❌ Error response: ${toolsText.substring(0, 500)}`);
  }

  console.log('\n✅ Test complete');
}

testMCPProtocol().catch(console.error);
