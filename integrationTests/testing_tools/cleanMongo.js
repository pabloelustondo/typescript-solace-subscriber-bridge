
const getConfig = require('./getConfig');
const argv = require('yargs').argv;
const { MongoClient } = require('mongodb');

const dbOptions = { useNewUrlParser: true, useUnifiedTopology: true };

async function cleanDatabase() {
  try {

    const config = await getConfig(argv);

    const client = await MongoClient.connect(config.mongoUrl, dbOptions);
    const db = client.db(config.test_db_name);

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
