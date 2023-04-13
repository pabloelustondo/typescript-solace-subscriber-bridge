const http = require('http');
const fs = require('fs');

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
  fs.writeFile(logfilename, `${message} ${timestamp} \r\n`, {'flag':'a'}, (err) => {
    if (err) throw err;
  });
  console.log(`Data written to ${logfilename} ${message} ${timestamp}` );
}

const server = http.createServer((req, res) => {
  if (ALWAYS_SUCCEEDS || ((!ALWAYS_FAILS) && (count % FAILURE_RATE == 0))) {
    res.statusCode = 200;
    countSuccess++;
    writeToLogs(`DID OK. total processed : ${ countSuccess } total received ${count}`);
  } else { 
    res.statusCode = 400;
    console.log('I crushed ')
    writeToLogs(`CRASHED. total processed : ${ countSuccess } total received ${count}`);
  }

   res.setHeader('Content-Type', 'text/plain');
   console.log('Received ' + count + " " + req.url)
   count++;
   res.end(`Received ${req.url}  responded status: ${res.statusCode}`);
    
});

server.listen(port, hostname, () => {
  writeToLogs(`Server running at http://${hostname}:${port}/`);
});