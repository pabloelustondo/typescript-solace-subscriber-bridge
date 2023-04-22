const { exec } = require('child_process');

const cleanQueue = (queueName) => {
  const cmd = `curl -X DELETE -u admin:admin -H "Content-Type: application/json" http://localhost:8080/SEMP/v2/config/msgVpns/default/queues/${queueName}`;
  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error cleaning queue: ${error}`);
    } else {
      console.log(`Queue cleaned: ${stdout}`);
      createQueue(queueName); // call createQueue after the queue is cleaned
    }
  });
};

const createQueue = (queueName) => {
  const cmd = `curl -X POST -u admin:admin -H "Content-Type: application/json" http://localhost:8080/SEMP/v2/config/msgVpns/default/queues -d '{ "queueName": "${queueName}", "accessType": "exclusive", "maxMsgSpoolUsage": 200, "permission": "consume", "ingressEnabled": true, "egressEnabled": true }'`;
  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error creating queue: ${error}`);
    } else {
      console.log(`Queue created: ${stdout}`);
    }
  });
};

cleanQueue('q-1');
cleanQueue('q-2');
cleanQueue('q-1-dlq');
cleanQueue('q-2-dlq');
