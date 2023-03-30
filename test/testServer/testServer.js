const http = require('http');

const hostname = '127.0.0.1';
const port = 3000;
count = 0;
FAILURE_RATE = 2;  // 2 => 50%   3=>33%   4=>25%...etc

const server = http.createServer((req, res) => {
  if (count % FAILURE_RATE == 0) {
    res.statusCode = 200;
    console.log('I am ok')
  } else { 
    res.statusCode = 400;
    console.log('I crushed ')
  }

   res.setHeader('Content-Type', 'text/plain');
   console.log('Received ' + count + " " + req.url)
   count++;
   res.end('Received ' + req.url);
    
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});