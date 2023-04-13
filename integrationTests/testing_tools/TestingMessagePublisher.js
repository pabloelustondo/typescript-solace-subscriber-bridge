var solace = require('solclientjs').debug; // logging supported
const DEFAULT_URL = "ws://localhost:8008";
const DEFAULT_USER_NAME = "admin";
const DEFAULT_PASSWORD = "admin";
const DEFAULT_VPN = "default";
const DEFAULT_QUEUE_NAME = "sample-queue";
const NUMBER_OF_TEST_MESSAGES = 1000;
const WINDOW_SIZE = 50;
const { v4: uuidv4 } = require('uuid');




var QueueProducer = function (solaceModule, queueName) {
    'use strict';
    var solace = solaceModule;
    var producer = {};
    producer.session = null;
    producer.queueName = queueName;
    producer.numOfMessages = NUMBER_OF_TEST_MESSAGES;
    producer.numOfMessagesSent = 0;
    producer.numOfMessagesConfirmed = 0;
    producer.numOfMessagesInWindow = 0;
    producer.messageAckRecvd = 0;

    // Logger
    producer.log = function (line) {
        var now = new Date();
        var time = [('0' + now.getHours()).slice(-2), ('0' + now.getMinutes()).slice(-2),
            ('0' + now.getSeconds()).slice(-2)];
        var timestamp = '[' + time.join(':') + '] ';
        console.log(timestamp + line);
    };

    producer.log('\n*** Producer to queue "' + producer.queueName + '" is ready to connect ***');

    // main function
    producer.run = async function (argv) {
        await (producer.connect(argv));
        console.log("DONE");
    };

    // Establishes connection to Solace PubSub+ Event Broker
    producer.connect = async function (argv) {
        if (producer.session !== null) {
            producer.log('Already connected and ready to publish.');
            return;
        }

        var hosturl = DEFAULT_URL;
        producer.log('Connecting to Solace PubSub+ Event Broker using url: ' + hosturl);
        var username = DEFAULT_USER_NAME
        producer.log('Client username: ' + username);
        var vpn = DEFAULT_VPN
        producer.log('Solace PubSub+ Event Broker VPN name: ' + vpn);
        var pass = DEFAULT_PASSWORD
        // create session
        try {
            producer.session = solace.SolclientFactory.createSession({
                // solace.SessionProperties
                url:      hosturl,
                vpnName:  vpn,
                userName: username,
                password: pass,
                publisherProperties: {
                    acknowledgeMode: solace.MessagePublisherAcknowledgeMode.PER_MESSAGE,
                },
            });
            // configure the GM window size
            const flowProps = new solace.FlowProperties()
            flowProps.setGuaranteedWindowSize(WINDOW_SIZE)

        } catch (error) {
            producer.log(error.toString());
        }
        // define session event listeners
        producer.session.on(solace.SessionEventCode.UP_NOTICE, function (sessionEvent) {
            producer.log('UP_NOTICE === Successfully connected and ready to send messages. ===');
            producer.sendMessages();
        });
        producer.session.on(solace.SessionEventCode.CONNECT_FAILED_ERROR, function (sessionEvent) {
            producer.log('CONNECT_FAILED_ERRORConnection failed to the message router: ' + sessionEvent.infoStr +
                ' - check correct parameter values and connectivity!');
        });
        producer.session.on(solace.SessionEventCode.ACKNOWLEDGED_MESSAGE, async function (sessionEvent) {
            const ta = (new Date()).toLocaleTimeString();
            producer.log(`ACKNOWLEDGED_MESSAGE ${ta} ${sessionEvent.correlationKey}`);
            producer.messageAckRecvd++;
            producer.numOfMessagesInWindow--;
            if (producer.numOfMessagesSent < producer.numOfMessages) {
                await producer.sendMessages();
             }

            if (producer.messageAckRecvd === producer.numOfMessages) {
                producer.exit();
            }
        });
        producer.session.on(solace.SessionEventCode.REJECTED_MESSAGE_ERROR, function (sessionEvent) {
            producer.log('REJECTED_MESSAGE_ERROR Delivery of message with correlation key = ' +
                JSON.stringify(sessionEvent.correlationKey) + ' rejected, info: ' + sessionEvent.infoStr);
            producer.messageAckRecvd++;
            if (producer.messageAckRecvd === producer.numOfMessages) {
                producer.exit();
            }
        });
        producer.session.on(solace.SessionEventCode.DISCONNECTED, function (sessionEvent) {
            producer.log('Disconnected.');
            if (producer.session !== null) {
                producer.session.dispose();
                producer.session = null;
            }
        });
        // connect the session
        try {
            producer.session.connect();
        } catch (error) {
            producer.log(error.toString());
        }
    };

    producer.sendMessages = async function () {
        console.log("CALLING SEND MESSAGES" + producer.numOfMessagesSent);
        if (producer.session !== null) {
            //TO DO FIX THIS LOOP WHEN NUMBER OF MESSAGES IS SMALL
            for (let x = producer.numOfMessagesInWindow;
                x < WINDOW_SIZE && this.numOfMessagesSent < this.numOfMessages;
                x++) { 
                await producer.sendMessage(producer.numOfMessagesSent);
            }
        } else {
            producer.log('Cannot send messages because not connected to Solace PubSub+ Event Broker.');
        }
    }

    // Sends one message
    producer.sendMessage = async function (sequenceNr) {
        var messageText = 'Sample Message';
        var message = solace.SolclientFactory.createMessage();
        message.setDestination(solace.SolclientFactory.createDurableQueueDestination(producer.queueName));
        message.setBinaryAttachment(messageText);
        message.setDeliveryMode(solace.MessageDeliveryModeType.PERSISTENT);
        // Define a correlation key object
        console.log("sequenceNr : " + sequenceNr)

        // Generate a new UUID
        const newId = uuidv4();
        console.log(" NEW ID " + newId);
        message.setCorrelationId(newId);

        const correlationKey = {
            name: "uuidv4();",
            id: newId,
        };
        message.setCorrelationKey(correlationKey);

        try {
            producer.numOfMessagesSent++;
            producer.numOfMessagesInWindow++;
            const t = (new Date()).toLocaleTimeString();
            await producer.session.send(message);
            producer.log(`SENT: ${producer.numOfMessagesSent}  ${t} ` );

        } catch (error) {
            producer.log(error.toString());
        }
    };

    producer.exit = function () {
        producer.disconnect();
        setTimeout(function () {
            process.exit();
        }, 1000); // wait for 1 second to finish
    };

    // Gracefully disconnects from Solace PubSub+ Event Broker
    producer.disconnect = function () {
        producer.log('Disconnecting from Solace PubSub+ Event Broker...');
        if (producer.session !== null) {
            try {
                producer.session.disconnect();
            } catch (error) {
                producer.log(error.toString());
            }
        } else {
            producer.log('Not connected to Solace PubSub+ Event Broker.');
        }
    };

    return producer;
};

async function runTest() {
    // Initialize factory with the most recent API defaults
    var factoryProps = new solace.SolclientFactoryProperties();
    factoryProps.profile = solace.SolclientFactoryProfiles.version10;
    solace.SolclientFactory.init(factoryProps);

    // enable logging to JavaScript console at WARN level
    // NOTICE: works only with ('solclientjs').debug
    solace.SolclientFactory.setLogLevel(solace.LogLevel.WARN);

    // create the producer, specifying the name of the destination queue
    var producer = new QueueProducer(solace, DEFAULT_QUEUE_NAME);

    // send message to Solace PubSub+ Event Broker
    await producer.run(process.argv);

    console.log("DONE"); 
}

runTest();

