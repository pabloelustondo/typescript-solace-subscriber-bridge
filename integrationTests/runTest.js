const util = require('util');
const exec = util.promisify(require('child_process').exec);

CONSUMER = "npm start";
PRODUCER = "node ./testing_tools/TestingMessagePublisher.js";
SERVER = "node ./testing_tools/BackEndServiceSimulator.js";

const cleanQueue = async (queueName) => {
  try {
    const cmd = `curl -X DELETE -u admin:admin -H "Content-Type: application/json" http://localhost:8080/SEMP/v2/config/msgVpns/default/queues/${queueName}`;
    await exec(cmd);
    console.log(`Queue cleaned: ${queueName}`);
    await createQueue(queueName);
  } catch (error) {
    console.error(`Error cleaning queue: ${error}`);
    throw error;
  }
};

const createQueue = async (queueName) => {
  try {
    const cmd = `curl -X POST -u admin:admin -H "Content-Type: application/json" http://localhost:8080/SEMP/v2/config/msgVpns/default/queues -d '{ "queueName": "${queueName}", "accessType": "exclusive", "maxMsgSpoolUsage": 200, "permission": "consume", "ingressEnabled": true, "egressEnabled": true }'`;

    await exec(cmd);
    console.log(`Queue created: ${queueName}`);

  } catch (error) {
    console.error(`Error creating queue: ${error}`);
    throw error;
  }
};


async function runProducer() {
  console.log('PRODUCER starting');
  try {
    await exec(PRODUCER);
  } catch (error) {
    console.error(`Error running producer: ${error}`);
  }
}

async function runConsumer() {
  console.log('PRODUCER starting');
  try {
    await exec(CONSUMER);
  } catch (error) {
    console.error(`Error running producer: ${error}`);
  }
}

async function runServer() {
  console.log('SERVER  starting');
  try {
    exec(SERVER);
  } catch (error) {
    console.error(`Error running server: ${error}`);
  }
}


async function main() {
  try {
    // Clean queues and wait until done 
    await cleanQueue('q-1');
    await cleanQueue('q-2');
    await cleanQueue('q-1-dlq');
    await cleanQueue('q-2-dlq');

    // Run producer and wait until done 
    
    
    await runProducer();

     // Run Server  for ever... this will have to be killed manually
    runServer();


    await runConsumer();

  } catch (err) {
    console.error(`Error running integration test preparation: ${err}`);
  }
}

main();
