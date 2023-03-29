const http = require('http');

const hostname = '127.0.0.1';
const port = 3000;

count = 0;

const server = http.createServer((req, res) => {
  if (count % 2 == 0) {
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