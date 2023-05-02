const { MongoClient } = require('mongodb');
const getConfig = require('./getConfig');
const argv = require('yargs').argv;

const exit = () => {
  console.log('Exiting');
  process.exit();
}
async function checkDatabase(exitFunction) {
  try {
    console.log('CHECK DATABASE STARTS');
    const config = await getConfig(argv);

    console.log('Starting Test Config:', config);

    const client = await MongoClient.connect(config.mongoUrl, config.dbOptions);
    const db = client.db(config.test_db_name);

    setInterval(() => checkCollections(db,config, exitFunction), config.check_database_interval);

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
