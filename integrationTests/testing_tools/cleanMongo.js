
const { MongoClient } = require('mongodb');

const mongoUrl = 'mongodb://localhost:27017/qb_stats';
const dbOptions = { useNewUrlParser: true, useUnifiedTopology: true };

async function cleanDatabase() {
  try {
    const client = await MongoClient.connect(mongoUrl, dbOptions);
    const db = client.db('qb-stats');

    await db.dropDatabase();
    console.log('Database dropped');

    await db.createCollection('dummy');
    console.log('Collection created');

    client.close();
  } catch (err) {
    console.error(`Error cleaning database: ${err}`);
  }
}

cleanDatabase();
