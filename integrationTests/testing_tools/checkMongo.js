const { MongoClient } = require('mongodb');
const fs = require('fs').promises;
const argv = require('yargs').argv;
const path = require('path');

async function checkDatabase() {
  try {
    const cwd = path.resolve(__dirname);
    const configFileName = argv.config ||`${cwd}/test-config.json`;
    const config = JSON.parse(await fs.readFile(configFileName, 'utf-8'));

    console.log('Starting Test Config:', config);

    const client = await MongoClient.connect(config.mongoUrl, config.dbOptions);
    const db = client.db('qb_stats');

    for (const collection of config.collections) {
      const res = (await db.collection(collection).find({}).toArray()).length;
      console.log(`Collection ${collection} read: `, res);
      if (res !== config.expectedLength) {
        console.error('TEST FAILS FOR NOW');
        break;
      }
    }

    console.log('TEST PASSED OK');
    client.close();
  } catch (err) {
    console.error(`Error reaching database: ${err}`);
  }
}

checkDatabase();
