const http = require('http');
const fs = require('fs');
const MongoClient = require('mongodb').MongoClient;
const getConfig = require('./getConfig');
const argv = require('yargs').argv;

// MongoDB connection URL





const logtimestamp = (new Date()).toLocaleTimeString();
const logfilename1 = `./logs/qb_consumer-log${logtimestamp}.log`;
const logfilename = logfilename1.replace(":","-")

let count = 0;
let countSuccess = 0;


function writeToLogs(message) { 
  const timestamp = (new Date()).toLocaleTimeString();
 /*
  fs.writeFile(logfilename, `${message} ${timestamp} \r\n`, { 'flag': 'a' }, (err) => {
    if (err) throw err;
  });
  console.log(`Data written to ${logfilename} ${message} ${timestamp}` );
  */
}

async function run() {


  const config = await getConfig(argv);
    // Create a new MongoClient
  const client = new MongoClient(config.server.url);

// Connect to MongoDB
  try {
    await client.connect();
    console.log('SERVER Connected to MongoDB!');
    await client.db(config.server.test_db_name).dropDatabase();
    console.log('SERVER Database dropped');
  } catch(e) { 
    console.log(`SERVER FAILED Connected to MongoDB! ${e}`);
  };


  const server = http.createServer(async (req, res) => {
    // Send a response back to the client
    if (config.server.ALWAYS_SUCCEEDS || ((!config.server.ALWAYS_FAILS) && (count % config.server.FAILURE_RATE == 0))) {
      res.statusCode = 200;
      countSuccess++;
      console.log(`SERVER SEND 200  ok processed ${countSuccess} total processed ${count}`)
      writeToLogs(`DID OK. total processed : ${countSuccess} total received ${count}`);
    } else {
      res.statusCode = 400;
      console.log(`SERVER SEND 400  ok processed ${countSuccess} total processed ${count}`)
      writeToLogs(`CRASHED. total processed : ${countSuccess} total received ${count}`);
    }

    const parsedUrl = req.url
    try {
      collectionName = `req-${parsedUrl.replace("/", "")}-${res.statusCode}`
              // Insert the requested URL and timestamp into the database
      const result = await client.db(config.server.test_db_name).collection(collectionName).insertOne({
          url: parsedUrl,
          statusCode: res.statusCode,
          timestamp: new Date()

      })
        res.setHeader('Content-Type', 'text/plain');
        count++;
        res.end(`SERVER Received ${req.url}  responded status: ${res.statusCode}`);
      }
      catch (e) {
        console.log(`SERVER ERROR: ${e}`)
      }
  });

  server.listen(config.server.port, config.server.hostname, () => {
    writeToLogs(`SERVER running at http://${config.server.hostname}:${config.server.port}/`);
  });

}

run();