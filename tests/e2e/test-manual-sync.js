// Manually trigger tool sync to see errors
const IDENTITY_SERVICE = 'http://localhost:8080';
const MANAGEMENT_API = 'http://localhost:3000/api';

async function manualSync() {
  console.log('Testing manual tool sync...\n');

  // Get token
  const appData = {
    applicationName: `SyncTest-${Date.now()}`,
    description: 'Sync test',
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
  console.log(`✅ Got token\n`);

  // Try to reconnect playwright-mcp server
  console.log('Triggering reconnect for playwright-mcp...');
  const reconnectResponse = await fetch(`${MANAGEMENT_API}/mcp-servers/playwright-mcp/reconnect`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  console.log(`Status: ${reconnectResponse.status}`);
  const reconnectResult = await reconnectResponse.json();
  console.log('Result:', JSON.stringify(reconnectResult, null, 2));

  // Check database for tools
  console.log('\nChecking database for tools...');
  const mongoose = (await import('mongoose')).default;
  await mongoose.connect('mongodb://localhost:27017/agent-gateway');

  const tools = await mongoose.connection.db.collection('mcp_tools').find().toArray();
  console.log(`Found ${tools.length} tools in database`);
  if (tools.length > 0) {
    tools.slice(0, 5).forEach(t => {
      console.log(`  - ${t.toolId}: ${t.name}`);
    });
  }

  await mongoose.disconnect();
}

manualSync().catch(console.error);
