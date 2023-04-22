"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuaranteedSubscriber = void 0;
const solclientjs_1 = __importDefault(require("solclientjs"));
const Logger_1 = require("./Logger");
const uuid_1 = require("uuid");
const WINDOW_SIZE = 50;
class GuaranteedSubscriber {
    constructor(solaceConfig, queueName, messageHandler, internalRetryQueue) {
        this.session = null;
        this.messagesReceived = 0;
        this.messagesAcknowledged = 0;
        this.flow = null;
        this.consuming = false;
        this.subscribed = false;
        this.topicName = ""; //NOT USED FOR NOW
        this.session = null;
        this.flow = null;
        this.consuming = false;
        this.subscribed = false;
        this.url = solaceConfig.solace.url;
        this.vpnName = solaceConfig.solace.vpnName;
        this.userName = solaceConfig.solace.userName;
        this.password = solaceConfig.solace.password;
        this.queueName = queueName;
        this.topicName = queueName + "-dlq";
        this.messageHandler = messageHandler;
        this.internalRetryQueue = internalRetryQueue;
    }
    init() {
        // Initialize factory with the most recent API defaults
        var factoryProps = new solclientjs_1.default.SolclientFactoryProperties();
        factoryProps.profile = solclientjs_1.default.SolclientFactoryProfiles.version10;
        solclientjs_1.default.SolclientFactory.init(factoryProps);
        // enable logging to JavaScript console at WARN level
        // NOTICE: works only with ('solclientjs').debug
        solclientjs_1.default.SolclientFactory.setLogLevel(solclientjs_1.default.LogLevel.WARN);
        setInterval(() => {
            this.checkFlow();
        }, 1000);
    }
    checkFlow() {
        const now = new Date();
        console.log(`HEARTBEAT  ${this.queueName} ${this.messagesAcknowledged}  - ${this.messagesReceived} ${now.toLocaleTimeString()} ${now.getMilliseconds()}`);
    }
    // Logger
    log(line) {
        var now = new Date();
        var time = [('0' + now.getHours()).slice(-2), ('0' + now.getMinutes()).slice(-2),
            ('0' + now.getSeconds()).slice(-2)];
        var timestamp = '[' + time.join(':') + '] ';
        //console.log(timestamp + line);
    }
    ;
    // Establishes connection to Solace PubSub+ Event Broker
    connect() {
        if (this.session !== null) {
            this.log('Already connected and ready to consume messages.');
            return;
        }
        this.log('Connecting to Solace PubSub+ Event Broker using url: ' + this.url);
        this.log('Client username: ' + this.userName);
        this.log('Solace PubSub+ Event Broker VPN name: ' + this.vpnName);
        // create session
        try {
            this.session = solclientjs_1.default.SolclientFactory.createSession({
                // solace.SessionProperties
                url: this.url,
                vpnName: this.vpnName,
                userName: this.userName,
                password: this.password,
                publisherProperties: {
                    acknowledgeMode: solclientjs_1.default.MessagePublisherAcknowledgeMode.PER_MESSAGE,
                    enabled: true
                },
            });
            (0, Logger_1.writeToLogs)("QB Consumer Session Started");
            // configure the GM window size
            const sol = solclientjs_1.default;
            const flowProps = new sol.FlowProperties();
            flowProps.setGuaranteedWindowSize(WINDOW_SIZE);
        }
        catch (error) {
            this.log("ERROR:" + error.toString());
            (0, Logger_1.writeToLogs)("ERROR QB Consumer Session NOT Started");
        }
        if (this.session != null) {
            // define session event listeners
            this.session.on(solclientjs_1.default.SessionEventCode.UP_NOTICE, (sessionEvent) => {
                this.log('=== Successfully connected and ready to start the message subscriber. ===');
                this.log(sessionEvent.toString());
                this.startConsume();
            });
            this.session.on(solclientjs_1.default.SessionEventCode.CONNECT_FAILED_ERROR, (sessionEvent) => {
                this.log('Connection failed to the message router: ' + sessionEvent.infoStr +
                    ' - check correct parameter values and connectivity!');
            });
            this.session.on(solclientjs_1.default.SessionEventCode.DISCONNECTED, (sessionEvent) => {
                this.log('Disconnected.');
                this.log('Session Event: ' + sessionEvent.toString());
                this.consuming = false;
                if (this.session !== null) {
                    this.session.dispose();
                    this.session = null;
                }
            });
            // ACKNOWLEDGEMENT RECEIVED
            this.session.on(solclientjs_1.default.SessionEventCode.ACKNOWLEDGED_MESSAGE, (ack) => {
                const message = ack.message;
                this.log('ACKNOWLEDGEMENT message: "');
                const correlationId = message.getCorrelationId() || "no id";
                const correlationKey = message.getCorrelationKey();
                //        const sentMessage = this.sentDeadLetterQueues[correlationId];
                this.log(`ACKN: ${message} | ${correlationId} | ${correlationKey}`);
                this.internalRetryQueue.processAcknowledge(message);
            });
            this.connectToSolace();
        }
        else {
            this.log("ERROR: Did not find a session to connect");
        }
    }
    ;
    connectToSolace() {
        try {
            this.session.connect();
        }
        catch (error) {
            this.log(error.toString());
        }
    }
    ;
    // Starts consuming messages from Solace PubSub+ Event Broker
    startConsume() {
        if (this.session !== null) {
            if (this.consuming) {
                this.log('Already started subscriber for queue "' + this.queueName + '" and ready to receive messages.');
            }
            else {
                this.log('Starting subscriber for queue: ' + this.queueName);
                try {
                    // Create a message subscriber
                    this.messageSubscriber = this.session.createMessageConsumer({
                        // solace.MessageConsumerProperties
                        queueDescriptor: { name: this.queueName, type: solclientjs_1.default.QueueType.QUEUE },
                        acknowledgeMode: solclientjs_1.default.MessageConsumerAcknowledgeMode.CLIENT,
                        createIfMissing: true // Create queue if not exists
                    });
                    // Define message subscriber event listeners
                    this.messageSubscriber.on(solclientjs_1.default.MessageConsumerEventName.UP, () => {
                        this.subscribe();
                        this.consuming = true;
                        this.log('=== Ready to receive messages. ===');
                    });
                    this.messageSubscriber.on(solclientjs_1.default.MessageConsumerEventName.CONNECT_FAILED_ERROR, () => {
                        this.consuming = false;
                        this.log('=== Error: the message subscriber could not bind to queue "' + this.queueName +
                            '" ===\n   Ensure this queue exists on the message router vpn');
                        this.exit();
                    });
                    this.messageSubscriber.on(solclientjs_1.default.MessageConsumerEventName.DOWN, () => {
                        this.consuming = false;
                        this.log('=== The message subscriber is now down ===');
                    });
                    this.messageSubscriber.on(solclientjs_1.default.MessageConsumerEventName.DOWN_ERROR, () => {
                        this.consuming = false;
                        this.log('=== An error happened, the message subscriber is down ===');
                    });
                    this.messageSubscriber.on(solclientjs_1.default.MessageConsumerEventName.SUBSCRIPTION_ERROR, (sessionEvent) => {
                        this.log('Cannot subscribe to topic ' + sessionEvent.reason);
                    });
                    this.messageSubscriber.on(solclientjs_1.default.MessageConsumerEventName.SUBSCRIPTION_OK, (sessionEvent) => {
                        if (this.subscribed) {
                            this.subscribed = false;
                            this.log('Successfully unsubscribed from topic: ' + sessionEvent.correlationKey);
                        }
                        else {
                            this.subscribed = true;
                            this.log('Successfully subscribed to topic: ' + sessionEvent.correlationKey);
                            this.log('=== Ready to receive messages. ===');
                        }
                    });
                    // Define message received event listener
                    this.messageSubscriber.on(solclientjs_1.default.MessageConsumerEventName.MESSAGE, (message) => {
                        const correlationKey = message.getCorrelationKey();
                        const load = Object.keys(this.internalRetryQueue.notConfirmedMessages).length;
                        this.log(`LOAD: ${load}`);
                        this.log('Received message: "' + message.getBinaryAttachment() + '",' +
                            ' details:\n' + message.dump());
                        // =======  MESSAGE IS RECEIVED AND WILL BE CONSUMED 
                        this.messagesReceived++;
                        const msg = message.getBinaryAttachment().toString();
                        const msgId = message.getGuaranteedMessageId();
                        const msgId2 = message.getCorrelationId();
                        (0, Logger_1.writeToLogs)(`Message Received ${msgId}   ${msg}  msgId2 ${msgId2} ${correlationKey}`);
                        this.messageHandler(message).
                            then(() => {
                            (0, Logger_1.writeToLogs)(`SUCCESS PROCESSING ${msg} ${msgId}`);
                            message.acknowledge();
                            this.messagesAcknowledged++;
                        }).
                            catch((error) => {
                            (0, Logger_1.writeToLogs)(`ERROR PROCESSING ${msg} ${msgId} ${error.toString()}}}`);
                            this.internalRetryQueue.processMessage(message, 0, this.messageHandler, (message) => {
                                message.acknowledge();
                                this.messagesAcknowledged++;
                            }, (deadLetter) => {
                                this.publish(deadLetter);
                            });
                        });
                    });
                    // Connect the message subscriber
                    this.messageSubscriber.connect();
                }
                catch (error) {
                    this.log(error.toString());
                }
            }
        }
        else {
            this.log('Cannot start the queue subscriber because not connected to Solace PubSub+ Event Broker.');
        }
    }
    ;
    /*

    handleMessage(message: Message) {

        this.messageHandler(message)
        .then(() => {
            console.log("SUCCESS PROCESSING SERVICE, ACK MESSAGE")
            message.acknowledge();
        })
        .catch(() => {
            console.log("ERROR PROCESSING SERVICE ADD TO RETRY QUEUE")
            const delay = 1000;
            this.internalRetryQueue.processMessageLater(
                message,
                1,
                delay,
                this.messageHandler
            )
        })
        .finally(() => {
            console.log("GOING TO Acknowledge the message  ")

        });

    }
    */
    // Subscribes to topic on Solace PubSub+ Event Broker
    subscribe() {
        if (this.messageSubscriber !== null) {
            if (this.subscribed) {
                this.log('Already subscribed to "' + this.topicName
                    + '" and ready to receive messages.');
            }
            else {
                this.log('Subscribing to topic: ' + this.topicName);
                try {
                    this.messageSubscriber.addSubscription(solclientjs_1.default.SolclientFactory.createTopicDestination(this.topicName), this.topicName, // correlation key as topic name
                    10000 // 10 seconds timeout for this operation
                    );
                }
                catch (error) {
                    this.log(error.toString());
                }
            }
        }
        else {
            this.log('Cannot subscribe because not connected to Solace PubSub+ Event Broker.');
        }
    }
    ;
    exit() {
        this.unsubscribe();
        setTimeout(() => {
            this.stopConsume();
            this.disconnect();
            process.exit();
        }, 1000); // wait for 1 second to get confirmation on removeSubscription
    }
    ;
    // Disconnects the subscriber from queue on Solace PubSub+ Event Broker
    stopConsume() {
        if (this.session !== null) {
            if (this.consuming) {
                this.consuming = false;
                this.log('Disconnecting consumption from queue: ' + this.queueName);
                try {
                    this.messageSubscriber.disconnect();
                    this.messageSubscriber.dispose();
                }
                catch (error) {
                    this.log(error.toString());
                }
            }
            else {
                this.log('Cannot disconnect the subscriber because it is not connected to queue "' +
                    this.queueName + '"');
            }
        }
        else {
            this.log('Cannot disconnect the subscriber because not connected to Solace PubSub+ Event Broker.');
        }
    }
    ;
    // Unsubscribes from topic on Solace PubSub+ Event Broker
    unsubscribe() {
        if (this.session !== null) {
            if (this.subscribed) {
                this.log('Unsubscribing from topic: ' + this.topicName);
                try {
                    this.messageSubscriber.removeSubscription(solclientjs_1.default.SolclientFactory.createTopicDestination(this.topicName), this.topicName, // correlation key as topic name
                    10000 // 10 seconds timeout for this operation
                    );
                }
                catch (error) {
                    this.log(error.toString());
                }
            }
            else {
                this.log('Cannot unsubscribe because not subscribed to the topic "'
                    + this.topicName + '"');
            }
        }
        else {
            this.log('Cannot unsubscribe because not connected to Solace PubSub+ Event Broker.');
        }
    }
    ;
    // Gracefully disconnects from Solace PubSub+ Event Broker
    disconnect() {
        this.log('Disconnecting from Solace PubSub+ Event Broker...');
        if (this.session !== null) {
            try {
                setTimeout(() => {
                    this.session.disconnect();
                }, 1000); // wait for 1 second to get confirmation on removeSubscription
            }
            catch (error) {
                this.log(error.toString());
            }
        }
        else {
            this.log('Not connected to Solace PubSub+ Event Broker.');
        }
    }
    ;
    // Publish message to DEAD LETTER QUEUE
    publish(message) {
        var _a;
        const correlationKey = message.getCorrelationKey();
        const correlationId = message.getCorrelationId();
        const messageContent = (_a = message.getBinaryAttachment()) === null || _a === void 0 ? void 0 : _a.toString();
        const appMsgId = message.getApplicationMessageId();
        var messageText = 'Sample Message';
        var message = solclientjs_1.default.SolclientFactory.createMessage();
        message.setCorrelationId(correlationId);
        message.setDestination(solclientjs_1.default.SolclientFactory.createDurableQueueDestination(this.topicName));
        message.setBinaryAttachment(messageText);
        message.setDeliveryMode(solclientjs_1.default.MessageDeliveryModeType.PERSISTENT);
        // Define a correlation key object
        // Generate a new UUID
        const newId = (0, uuid_1.v4)();
        //console.log(" NEW ID " + newId);
        message.setCorrelationId(correlationId);
        if (this.session !== null) {
            this.log('Publishing message to dead letter queue correlationId ' + correlationId + '" to topic "' + this.topicName + '/' + correlationKey + '"...' + messageContent + "  appMsgId:" + appMsgId);
            try {
                // Delivery not yet confirmed. to dead letter queue
                message.setCorrelationKey(correlationKey);
                this.session.send(message);
            }
            catch (error) {
                this.log(error.toString());
                if (error.message = "Guaranteed Message Window Closed") {
                    this.log("Guaranteed Message Window Closed, retrying in 1 second");
                    /*
                    setTimeout(() => {
                        this.publish(message);
                    }, 1000);
                    */
                }
            }
        }
        else {
            this.log('Cannot publish messages because not connected to Solace PubSub+ Event Broker.');
        }
    }
    ;
}
exports.GuaranteedSubscriber = GuaranteedSubscriber;
;
