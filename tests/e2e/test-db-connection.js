// Test to check if the running server is writing to MongoDB
import mongoose from 'mongoose';

async function checkConnection() {
  console.log('Checking MongoDB connection...\n');

  try {
    await mongoose.connect('mongodb://localhost:27017/agent-gateway');
    console.log('✅ Connected to MongoDB\n');

    // Insert a test document
    const testCollection = mongoose.connection.db.collection('test_connection');
    const testDoc = { test: 'hello', timestamp: new Date() };

    console.log('Inserting test document...');
    const result = await testCollection.insertOne(testDoc);
    console.log(`✅ Inserted with ID: ${result.insertedId}\n`);

    // Read it back
    console.log('Reading test document back...');
    const found = await testCollection.findOne({ _id: result.insertedId });
    console.log('✅ Found:', found);

    // Clean up
    await testCollection.deleteOne({ _id: result.insertedId });
    console.log('\n✅ MongoDB read/write working correctly!');

    // List all collections
    console.log('\nExisting collections:');
    const collections = await mongoose.connection.db.listCollections().toArray();
    collections.forEach(c => {
      console.log(`  - ${c.name}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkConnection();
