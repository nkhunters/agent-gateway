// Simple test to just register a server and check database
const IDENTITY_SERVICE = 'http://localhost:8080';
const MANAGEMENT_API = 'http://localhost:3000/api';

async function testRegister() {
  console.log('Testing server registration...\n');

  // Get token
  const appData = {
    applicationName: `RegTest-${Date.now()}`,
    description: 'Registration test',
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
  console.log(`✅ Got token: ${token.substring(0, 30)}...\n`);

  // Register a test server
  const testServer = {
    serverId: `test-server-${Date.now()}`,
    name: 'Test MCP Server',
    endpoint: 'http://localhost:9999/mcp',
    description: 'Test server for debugging registration'
  };

  console.log(`Registering server: ${testServer.serverId}...`);
  const response = await fetch(`${MANAGEMENT_API}/mcp-servers`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(testServer)
  });

  console.log(`Response status: ${response.status}`);
  const result = await response.json();
  console.log(`Response:`, JSON.stringify(result, null, 2));

  // Now check if it's in the database
  console.log('\nChecking database...');
  const mongoose = (await import('mongoose')).default;
  await mongoose.connect('mongodb://localhost:27017/agent-gateway');

  const servers = await mongoose.connection.db.collection('mcp_servers').find().toArray();
  console.log(`\nFound ${servers.length} servers in database:`);
  servers.forEach(s => {
    console.log(`  - ${s.serverId}: ${s.endpoint}`);
  });

  await mongoose.disconnect();
}

testRegister().catch(console.error);
