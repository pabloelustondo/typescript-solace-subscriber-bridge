const { MongoClient } = require('mongodb');
const fs = require('fs').promises;
const argv = require('yargs').argv;
const path = require('path');

const exit = () => {
  console.log('Exiting');
  process.exit();
}
async function checkDatabase(exitFunction) {
  try {
    console.log('CHECK DATABASE STARTS');
    const cwd = path.resolve(__dirname);
    const configFileName = argv.config ||`${cwd}/test-config.json`;
    const config = JSON.parse(await fs.readFile(configFileName, 'utf-8'));

    console.log('Starting Test Config:', config);

    const client = await MongoClient.connect(config.mongoUrl, config.dbOptions);
    const db = client.db('qb_stats');

    setInterval(() => checkCollections(db,config, exitFunction), 1000);

  } catch (err) {
    console.error(`Error reaching database: ${err}`);
  }
}


async function checkCollections(db, config, exitFunction) { 
  const collectionStatus = [];
  for (const collection of config.collections) {
    const res = (await db.collection(collection).find({}).toArray()).length;
    collectionStatus.push(res);
    console.log(`Collection ${collection} read: `, res);
    if (res !== config.expectedLength) {
      console.error('TEST FAILS FOR NOW');
      return;
    }
  }
  console.log(`========= TEST PASSED OK ========='`);
  console.log(`========= TEST PASSED OK ========= ${collectionStatus}`);
  console.log(`========= TEST PASSED OK =========`);
  exitFunction();
}
//checkDatabase(exit);

module.exports =  checkDatabase;
