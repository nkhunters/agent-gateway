import mongoose from 'mongoose';

async function checkTools() {
  try {
    await mongoose.connect('mongodb://localhost:27017/agent-gateway');

    console.log('\n=== MCP Servers ===');
    const servers = await mongoose.connection.db.collection('mcp_servers').find().toArray();
    console.log(`Found ${servers.length} servers:`);
    servers.forEach(s => {
      console.log(`  - ${s.serverId}: ${s.endpoint} (Active: ${s.isActive})`);
    });

    console.log('\n=== MCP Tools ===');
    const tools = await mongoose.connection.db.collection('mcp_tools').find().toArray();
    console.log(`Found ${tools.length} tools:`);
    if (tools.length > 0) {
      tools.slice(0, 10).forEach(t => {
        console.log(`  - ${t.toolId}: ${t.name} (Server: ${t.serverId}, Active: ${t.isActive})`);
      });
      if (tools.length > 10) {
        console.log(`  ... and ${tools.length - 10} more`);
      }
    } else {
      console.log('  (No tools found - this is the issue!)');
    }

  } finally {
    await mongoose.disconnect();
  }
}

checkTools().catch(console.error);
