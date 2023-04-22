const http = require('http');
const fs = require('fs');
const MongoClient = require('mongodb').MongoClient;

// MongoDB connection URL
const url = 'mongodb://localhost:27017';

// Create a new MongoClient
const client = new MongoClient(url);


const logtimestamp = (new Date()).toLocaleTimeString();
const logfilename1 = `./logs/qb_consumer-log${logtimestamp}.log`;
const logfilename = logfilename1.replace(":","-")

const hostname = '127.0.0.1';
const port = 3000;
let count = 0;
let countSuccess = 0;

const ALWAYS_SUCCEEDS = true;
const ALWAYS_FAILS = false;
const FAILURE_RATE = 2;  // 2 => 50%   3=>33%   4=>25%...etc


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

// Connect to MongoDB
  try {
    await client.connect();
    console.log('SERVER Connected to MongoDB!');
    await client.db('qb_stats').dropDatabase();
    console.log('SERVER Database dropped');
  } catch(e) { 
    console.log(`SERVER FAILED Connected to MongoDB! ${e}`);
  };


  const server = http.createServer(async (req, res) => {
    // Send a response back to the client
    if (ALWAYS_SUCCEEDS || ((!ALWAYS_FAILS) && (count % FAILURE_RATE == 0))) {
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
      const result = await client.db('qb_stats').collection(collectionName).insertOne({
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

  server.listen(port, hostname, () => {
    writeToLogs(`SERVER running at http://${hostname}:${port}/`);
  });

}

run();