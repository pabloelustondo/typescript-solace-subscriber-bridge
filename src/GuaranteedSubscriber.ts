import solace from "solclientjs"
import { SolaceConfigType } from "./SolaceConfigType"


export class GuaranteedSubscriber {
    session:any = null;
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
    messageHandler: (message:any) => Promise<void>
    
    constructor(
        solaceConfig: SolaceConfigType,
        queueName: string,
        messageHandler: (message:any) => Promise<void>
    
    ) { 
        this.session = null;
        this.flow = null;
        this.consuming = false;
        this.subscribed = false;
        this.url =  solaceConfig.solace.url;
        this.vpnName = solaceConfig.solace.vpnName;
        this.userName = solaceConfig.solace.userName;
        this.password = solaceConfig.solace.password;
        this.queueName = queueName;
        this.topicName = queueName + "-retry";
        this.messageHandler = messageHandler;

        this.log('*** Queue Bridge Consumer to is ready to connect ***');
        
    }

    init() { 
        // Initialize factory with the most recent API defaults
        var factoryProps = new solace.SolclientFactoryProperties();
        factoryProps.profile = solace.SolclientFactoryProfiles.version10;
        solace.SolclientFactory.init(factoryProps);

        // enable logging to JavaScript console at WARN level
        // NOTICE: works only with ('solclientjs').debug
        solace.SolclientFactory.setLogLevel(solace.LogLevel.WARN);
    }

    // Logger
    log(line:any) {
        var now = new Date();
        var time = [('0' + now.getHours()).slice(-2), ('0' + now.getMinutes()).slice(-2),
            ('0' + now.getSeconds()).slice(-2)];
        var timestamp = '[' + time.join(':') + '] ';
        console.log(timestamp + line);
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
                publisherProperties: null
            });
        } catch (error: any) {
            this.log(error.toString());
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
                    this.messageSubscriber.on(solace.MessageConsumerEventName.MESSAGE,  (message:any) => {
                        this.log('Received message: "' + message.getBinaryAttachment() + '",' +
                            ' details:\n' + message.dump());
                        
                        
                        // =======  MESSAGE IS RECEIVED AND WILL BE CONSUMED 

                        this.messageHandler(message).
                            then(() => console.log("SUCCESS PROCESSING SERVICE")).
                            catch(() => {
                                console.log("ERROR PROCESSING SERVICE")
                                this.publish('ERROR')
                            }).
                            finally(() => { 
                                console.log("GOING TO Acknowledge the message  ")
                                message.acknowledge();
                            });
                        
                        // Need to explicitly ack otherwise it will not be deleted from the message 
    
     
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

        // Publish one message
    publish(msg:string) {
        if (this.session !== null) {
            const now = new Date;
            var messageText = 'Sample Message ' + msg + " "+ now.toLocaleTimeString()
            var message = solace.SolclientFactory.createMessage();
            message.setBinaryAttachment(messageText);
            message.setDeliveryMode(solace.MessageDeliveryModeType.PERSISTENT);
            // OPTIONAL: You can set a correlation key on the message and check for the correlation
            // in the ACKNOWLEDGE_MESSAGE callback. Define a correlation key object
            const correlationKey = {
                name: "MESSAGE_CORRELATIONKEY",
                id: Date.now()
            };
            message.setCorrelationKey(correlationKey);
            this.log('Publishing message "' + messageText + '" to topic "' + this.topicName + '/' + correlationKey.id + '"...');
            /*
            message.setDestination(solace.SolclientFactory.createTopicDestination(publisher.topicName + '/' + correlationKey.id));
            */

            message.setDestination(solace.SolclientFactory.createDurableQueueDestination(this.topicName))

            try {
                // Delivery not yet confirmed. See ConfirmedPublish.js
                this.session.send(message);
                this.log('Message sent with correlation key: ' + correlationKey.id);
            } catch (error: any) {
                this.log(error.toString());
            }
        } else {
            this.log('Cannot publish messages because not connected to Solace PubSub+ Event Broker.');
        }
    };

};

