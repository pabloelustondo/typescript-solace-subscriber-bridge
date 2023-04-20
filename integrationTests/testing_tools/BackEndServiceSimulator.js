const http = require('http');
const fs = require('fs');
const MongoClient = require('mongodb').MongoClient;

// MongoDB connection URL
const url = 'mongodb://localhost:27017/mydb';

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
  */
  console.log(`Data written to ${logfilename} ${message} ${timestamp}` );
}

async function run() {

// Connect to MongoDB
  try {
    await client.connect();
    console.log('Connected to MongoDB!');
  } catch(e) { 
    console.log(`FAILED Connected to MongoDB! ${e}`);
  };


  const server = http.createServer(async (req, res) => {
    // Send a response back to the client
    if (ALWAYS_SUCCEEDS || ((!ALWAYS_FAILS) && (count % FAILURE_RATE == 0))) {
      res.statusCode = 200;
      countSuccess++;
      writeToLogs(`DID OK. total processed : ${countSuccess} total received ${count}`);
    } else {
      res.statusCode = 400;
      console.log('I crushed ')
      writeToLogs(`CRASHED. total processed : ${countSuccess} total received ${count}`);
    }

    const parsedUrl = req.url
      try {
      // Insert the requested URL and timestamp into the database
      const result = await client.db('qb_stats').collection('requests').insertOne({
          url: parsedUrl,
          statusCode: res.statusCode,
          timestamp: new Date()

      })
        console.log('Inserted document with _id: ' + result.insertedId);
        res.setHeader('Content-Type', 'text/plain');
        console.log('Received ' + count + " " + req.url)
        count++;
        res.end(`Received ${req.url}  responded status: ${res.statusCode}`);
      }
      catch (e) {
        console.log(`ERROR: ${e}`)
      }
  });

  server.listen(port, hostname, () => {
    writeToLogs(`Server running at http://${hostname}:${port}/`);
  });

}

run();