import solace, { Message } from "solclientjs"
import { SolaceConfigType } from "./SolaceConfigType"
import { InternalRetryQueue } from "./InternalRetryQueue"
import { writeToLogs } from "./Logger";
import { v4 as uuidv4 } from 'uuid';
const WINDOW_SIZE = 50;

export class GuaranteedSubscriber {
    session: solace.Session;
    messagesReceived: number = 0;
    messagesAcknowledged: number = 0;

    flow = null;
    consuming:boolean = false;
    subscribed: boolean = false;
    messageSubscriber: any;
    url: string;
    vpnName: string;
    userName: string;
    password: string;
    queueName: string;
    topicName: string = "";   //NOT USED FOR NOW
    internalRetryQueue: InternalRetryQueue
    messageHandler: (message:any) => Promise<void>
    
    constructor(
        solaceConfig: SolaceConfigType,
        queueName: string,
        messageHandler: (message: any) => Promise<void>,
        internalRetryQueue: InternalRetryQueue
    
    ) { 
        this.flow = null;
        this.consuming = false;
        this.subscribed = false;
        this.url =  solaceConfig.solace.url;
        this.vpnName = solaceConfig.solace.vpnName;
        this.userName = solaceConfig.solace.userName;
        this.password = solaceConfig.solace.password;
        this.queueName = queueName;
        this.topicName = queueName + "-dlq";
        this.messageHandler = messageHandler;
        this.internalRetryQueue = internalRetryQueue  
    }

    init() { 
        // Initialize factory with the most recent API defaults
        var factoryProps = new solace.SolclientFactoryProperties();
        factoryProps.profile = solace.SolclientFactoryProfiles.version10;
        solace.SolclientFactory.init(factoryProps);

        // enable logging to JavaScript console at WARN level
        // NOTICE: works only with ('solclientjs').debug
        solace.SolclientFactory.setLogLevel(solace.LogLevel.WARN);

        setInterval(() => {
            this.checkFlow()
        }, 1000);
        
    }

    checkFlow() {
        const now = new Date();
        console.log(`HEARTBEAT  ${this.queueName} ${this.messagesAcknowledged}  - ${this.messagesReceived} ${now.toLocaleTimeString()} ${now.getMilliseconds()}`);
     }
    // Logger
    log(line:any) {
        var now = new Date();
        var time = [('0' + now.getHours()).slice(-2), ('0' + now.getMinutes()).slice(-2),
            ('0' + now.getSeconds()).slice(-2)];
        var timestamp = '[' + time.join(':') + '] ';
        //console.log(timestamp + line);
    };

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
            this.session = solace.SolclientFactory.createSession({
                // solace.SessionProperties
                url:      this.url,
                vpnName:  this.vpnName,
                userName: this.userName,
                password: this.password,
                publisherProperties: {
                    acknowledgeMode: solace.MessagePublisherAcknowledgeMode.PER_MESSAGE,
                    enabled: true
                },
            })            writeToLogs("QB Consumer Session Started");
                       // configure the GM window size
            const sol: any = solace;
            const flowProps = new sol.FlowProperties();
            flowProps.setGuaranteedWindowSize(WINDOW_SIZE)
            
        } catch (error: any) {
            this.log("ERROR:" + error.toString());
            writeToLogs("ERROR QB Consumer Session NOT Started");
        }

        if (this.session != null) {
            // define session event listeners
            this.session.on(solace.SessionEventCode.UP_NOTICE, (sessionEvent: any) => {
                this.log('=== Successfully connected and ready to start the message subscriber. ===');
                this.log(sessionEvent.toString());
                this.startConsume();
            });

            this.session.on(solace.SessionEventCode.CONNECT_FAILED_ERROR,  (sessionEvent: any) => {
                this.log('Connection failed to the message router: ' + sessionEvent.infoStr +
                    ' - check correct parameter values and connectivity!');
            });

            this.session.on(solace.SessionEventCode.DISCONNECTED,  (sessionEvent: any) => {
                this.log('Disconnected.');
                this.log('Session Event: ' + sessionEvent.toString());
                this.consuming = false;
                if (this.session !== null) {
                    this.session.dispose();
                    this.session = null;
                }
            });

            // ACKNOWLEDGEMENT RECEIVED

            this.session.on(solace.SessionEventCode.ACKNOWLEDGED_MESSAGE, (ack: any) => {
                const message = ack.message;
                this.log('ACKNOWLEDGEMENT message: "');
                const correlationId: string = message.getCorrelationId() || "no id";
                
                const correlationKey  = message.getCorrelationKey();
                
        //        const sentMessage = this.sentDeadLetterQueues[correlationId];
                this.log(`ACKN: ${message} | ${correlationId} | ${correlationKey}`);

                this.internalRetryQueue.processAcknowledge(message)

            });

            this.connectToSolace();
        } else { 
            this.log("ERROR: Did not find a session to connect")
        }
    };

    connectToSolace() {
        try {
            this.session.connect();
        } catch (error: any) {
            this.log(error.toString());
        }
    };

    // Starts consuming messages from Solace PubSub+ Event Broker
    startConsume() {
        if (this.session !== null) {
            this.session.deleteQueue(this.queueName, 1);
            if (this.consuming) {
                this.log('Already started subscriber for queue "' + this.queueName + '" and ready to receive messages.');
            } else {
                this.log('Starting subscriber for queue: ' + this.queueName);
                try {
                    // Create a message subscriber
                    this.messageSubscriber = this.session.createMessageConsumer({
                        // solace.MessageConsumerProperties
                        queueDescriptor: { name: this.queueName, type: solace.QueueType.QUEUE },
                        acknowledgeMode: solace.MessageConsumerAcknowledgeMode.CLIENT, // Enabling Client ack
                        createIfMissing: true // Create queue if not exists
                    });
                    // Define message subscriber event listeners
                   
                    this.messageSubscriber.on(solace.MessageConsumerEventName.UP,  () =>  {
                        this.subscribe();
                        this.consuming = true;
                        this.log('=== Ready to receive messages. ===');
                    });
                    
                    this.messageSubscriber.on(solace.MessageConsumerEventName.CONNECT_FAILED_ERROR,  () =>  {
                        this.consuming = false;
                        this.log('=== Error: the message subscriber could not bind to queue "' + this.queueName +
                            '" ===\n   Ensure this queue exists on the message router vpn');
                            this.exit();
                    });

                    this.messageSubscriber.on(solace.MessageConsumerEventName.DOWN,  () => {
                        this.consuming = false;
                        this.log('=== The message subscriber is now down ===');
                    });

                    this.messageSubscriber.on(solace.MessageConsumerEventName.DOWN_ERROR,  () =>  {
                        this.consuming = false;
                        this.log('=== An error happened, the message subscriber is down ===');
                    });
                   
                    this.messageSubscriber.on(solace.MessageConsumerEventName.SUBSCRIPTION_ERROR,  (sessionEvent: any) => {
                        this.log('Cannot subscribe to topic ' + sessionEvent.reason);
                    });
                   
                    this.messageSubscriber.on(solace.MessageConsumerEventName.SUBSCRIPTION_OK,  (sessionEvent: any) => {
                      if (this.subscribed) {
                        this.subscribed = false;
                        this.log('Successfully unsubscribed from topic: ' + sessionEvent.correlationKey);
                      } else {
                        this.subscribed = true;
                        this.log('Successfully subscribed to topic: ' + sessionEvent.correlationKey);
                        this.log('=== Ready to receive messages. ===');
                      }
                    });
                   
                    // Define message received event listener
                    this.messageSubscriber.on(solace.MessageConsumerEventName.MESSAGE, (message: any) => {
                        
                        const correlationKey = message.getCorrelationKey();
                        const load = Object.keys(this.internalRetryQueue.notConfirmedMessages).length;

                        this.log(`LOAD: ${load}`);

                        this.log('Received message: "' + message.getBinaryAttachment() + '",' +
                            ' details:\n' + message.dump());
                        
// =======  MESSAGE IS RECEIVED AND WILL BE CONSUMED 
                        this.messagesReceived++;
                        const msg = message.getBinaryAttachment().toString()
                        const msgId = message.getGuaranteedMessageId()
                        const msgId2 = message.getCorrelationId();

                        writeToLogs(`Message Received ${msgId}   ${msg}  msgId2 ${msgId2} ${correlationKey}`);

                        this.messageHandler(message).
                            then(() => {
                                writeToLogs(`SUCCESS PROCESSING ${msg} ${msgId}`)
                                message.acknowledge();
                                this.messagesAcknowledged++;
                            }).
                            catch((error) => {
                                writeToLogs(`ERROR PROCESSING ${msg} ${msgId} ${error.toString()}}}`)
                                this.internalRetryQueue.processMessage(
                                    message,
                                    0,
                                    this.messageHandler,
                                    (message) => { 
                                        message.acknowledge();
                                        this.messagesAcknowledged++;
                                    },
                                    (deadLetter) => { 
                                        this.publish(deadLetter)
                                    },
                                )
                            })
                    });
                   
                    // Connect the message subscriber
                    this.messageSubscriber.connect();
                } catch (error: any) {
                    this.log(error.toString());
                }
            }
        } else {
            this.log('Cannot start the queue subscriber because not connected to Solace PubSub+ Event Broker.');
        }
    };
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
        } else {
            this.log('Subscribing to topic: ' + this.topicName);
          try {
            this.messageSubscriber.addSubscription(
              solace.SolclientFactory.createTopicDestination(this.topicName),
              this.topicName, // correlation key as topic name
              10000 // 10 seconds timeout for this operation
            );
          } catch (error: any) {
            this.log(error.toString());
          }
        }
      } else {
        this.log('Cannot subscribe because not connected to Solace PubSub+ Event Broker.');
      }
    };
  
    exit() {
        this.unsubscribe();
        setTimeout( () =>  {
            this.stopConsume();
            this.disconnect();
            process.exit();
        }, 1000); // wait for 1 second to get confirmation on removeSubscription
    };

    // Disconnects the subscriber from queue on Solace PubSub+ Event Broker
    stopConsume( ) {
        if (this.session !== null) {
            this.session.deleteQueue(this.queueName, 1);
            if (this.consuming) {
                this.consuming = false;
                this.log('Disconnecting consumption from queue: ' + this.queueName);
                try {
                    this.messageSubscriber.disconnect();
                    this.messageSubscriber.dispose();
                } catch (error: any) {
                    this.log(error.toString());
                }
            } else {
                this.log('Cannot disconnect the subscriber because it is not connected to queue "' +
                this.queueName + '"');
            }
        } else {
            this.log('Cannot disconnect the subscriber because not connected to Solace PubSub+ Event Broker.');
        }
    };

    // Unsubscribes from topic on Solace PubSub+ Event Broker
    unsubscribe( ) {
      if (this.session !== null) {
        if (this.subscribed) {
            this.log('Unsubscribing from topic: ' + this.topicName);
          try {
            this.messageSubscriber.removeSubscription(
              solace.SolclientFactory.createTopicDestination( this.topicName ),
              this.topicName, // correlation key as topic name
              10000 // 10 seconds timeout for this operation
            );
          } catch (error: any) {
            this.log(error.toString());
          }
        } else {
            this.log('Cannot unsubscribe because not subscribed to the topic "'
              + this.topicName + '"');
        }
      } else {
        this.log('Cannot unsubscribe because not connected to Solace PubSub+ Event Broker.');
      }
    };

    // Gracefully disconnects from Solace PubSub+ Event Broker
    disconnect() {
        this.log('Disconnecting from Solace PubSub+ Event Broker...');
        if (this.session !== null) {
            try {
                setTimeout( () =>  {
                    this.session.disconnect();
                }, 1000); // wait for 1 second to get confirmation on removeSubscription
            } catch (error: any) {
                this.log(error.toString());
            }
        } else {
            this.log('Not connected to Solace PubSub+ Event Broker.');
        }
    };

        // Publish message to DEAD LETTER QUEUE
    publish(message: Message) {

        const correlationKey = message.getCorrelationKey();

        const correlationId = message.getCorrelationId();
        const messageContent = message.getBinaryAttachment()?.toString();
        const appMsgId = message.getApplicationMessageId();


        var messageText = 'Sample Message';
        var message = solace.SolclientFactory.createMessage();
        message.setCorrelationId(correlationId);
        message.setDestination(solace.SolclientFactory.createDurableQueueDestination(this.topicName));
        message.setBinaryAttachment(messageText);
        message.setDeliveryMode(solace.MessageDeliveryModeType.PERSISTENT);
        // Define a correlation key object

        // Generate a new UUID
        const newId = uuidv4();
        //console.log(" NEW ID " + newId);
        message.setCorrelationId(correlationId);




        if (this.session !== null) {

            this.log('Publishing message to dead letter queue correlationId ' + correlationId + '" to topic "' + this.topicName + '/' + correlationKey + '"...' + messageContent + "  appMsgId:" + appMsgId);

            try {
                // Delivery not yet confirmed. to dead letter queue
                message.setCorrelationKey(correlationKey);
                this.session.send(message);
               
            } catch (error: any) {
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
        } else {
            this.log('Cannot publish messages because not connected to Solace PubSub+ Event Broker.');
        }
    };

};

