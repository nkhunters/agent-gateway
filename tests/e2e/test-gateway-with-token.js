// Test gateway directly with a valid token
async function testGatewayAuth() {
  // Get a valid token
  const appData = {
    applicationName: `GWTest-${Date.now()}`,
    description: 'Gateway auth test',
    financialId: 'FIN001',
    channelId: 'TEST',
    clientSecret: `secret-${Date.now()}`,
    allowedTools: ['*'],
    allowedApis: ['*'],
    isDeveloperPortalAPIsEnabled: false
  };

  console.log('1. Getting token from Identity Service...');
  let appResponse = await fetch('http://localhost:8080/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(appData)
  });
  let appResult = await appResponse.json();

  let tokenResponse = await fetch('http://localhost:8080/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: appResult.clientId,
      client_secret: appData.clientSecret
    })
  });
  let tokenResult = await tokenResponse.json();
  const token = tokenResult.access_token;
  console.log(`   Token obtained: ${token.substring(0, 30)}...`);

  console.log('\n2. Testing gateway /api/health WITH token...');
  let healthResp = await fetch('http://localhost:3000/api/health', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  console.log(`   Status: ${healthResp.status}`);
  let healthBody = await healthResp.text();
  console.log(`   Body: ${healthBody}`);

  console.log('\n3. Testing gateway /api/mcp-servers WITH token...');
  let serversResp = await fetch('http://localhost:3000/api/mcp-servers', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  console.log(`   Status: ${serversResp.status}`);
  let serversBody = await serversResp.text();
  console.log(`   Body: ${serversBody.substring(0, 200)}`);

  if (serversResp.status === 200) {
    console.log('\n✅ Gateway authentication works!');
  } else {
    console.log('\n❌ Gateway authentication failed');
    console.log('Check gateway logs for "AuthMiddleware" or "TokenValidationService" errors');
  }
}

testGatewayAuth().catch(console.error);
