const { exec } = require('child_process');

const deleteQueue = () => {
  const cmd = `curl -X DELETE -u admin:admin -H "Content-Type: application/json" http://localhost:8080/SEMP/v2/config/msgVpns/default/queues/testQ2`;
  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error deleting queue: ${error}`);
    } else {
      console.log(`Queue deleted: ${stdout}`);
      createQueue(); // call createQueue after the queue is deleted
    }
  });
};

const createQueue = () => {
  const cmd = `curl -X POST -u admin:admin -H "Content-Type: application/json" http://localhost:8080/SEMP/v2/config/msgVpns/default/queues -d '{ "queueName": "testQ2", "accessType": "exclusive", "maxMsgSpoolUsage": 200, "permission": "consume", "ingressEnabled": true, "egressEnabled": true }'`;
  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error creating queue: ${error}`);
    } else {
      console.log(`Queue created: ${stdout}`);
    }
  });
};

deleteQueue();
