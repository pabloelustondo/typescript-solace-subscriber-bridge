const { exec } = require('child_process');

PRODUCER = "node testing_tools/TestingMessagePublisher.js";
SERVER = "node testing_tools/BackEndServiceSimulator.js";
CONSUMER = "node ../src/QueueBridgeConsumer.js";

async function cleanQueues(queueName) {
  return new Promise((resolve, reject) => {
    const command = `curl http://localhost:8080/SEMP/v2/config/msgVpns/default/queues/${queueName} -X DELETE -u admin:admin`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        console.log(`Queue ${queueName} deleted`);
        resolve();
      }
    });
  });
}

function runProducer() {
  return new Promise((resolve, reject) => {
    const childProcess = exec(PRODUCER, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        console.log('Producer finished');
        resolve();
      }
    });

    childProcess.stdout.pipe(process.stdout);
    childProcess.stderr.pipe(process.stderr);
  });
}

function runServer() {
  return new Promise((resolve, reject) => {
    const childProcess = exec(SERVER, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        console.log('Server finished');
        resolve();
      }
    });

    childProcess.stdout.pipe(process.stdout);
    childProcess.stderr.pipe(process.stderr);
  });
}

function runConsumer() {
  return new Promise((resolve, reject) => {
    const childProcess = exec(CONSUMER, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        console.log('Consumer finished');
        resolve();
      }
    });

    childProcess.stdout.pipe(process.stdout);
    childProcess.stderr.pipe(process.stderr);
  });
}

async function main() {
  try {
    // Clean queues
    await cleanQueues('testQ');

    // Run producer
    await runProducer();

    // Run server and consumer concurrently
    await Promise.all([runServer(), runConsumer()]);
  } catch (err) {
    console.error(`Error running integration test: ${err}`);
  }
}

main();
