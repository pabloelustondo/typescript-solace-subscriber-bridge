import solace from "solclientjs"

export class GuaranteedSubscriber {
    session:any = null;
    flow = null;
    queueName:string;
    consuming:boolean = false;
    topicName:string;
    subscribed: boolean = false;
    messageSubscriber: any;
    url: string;
    vpnName: string;
    userName: string;
    password: string;
    
    constructor(
        queueName: any,
        topicName: any,
        url:      string,
        vpnName:  string,
        userName: string,
        password: string,
    
    ) { 
        this.session = null;
        this.flow = null;
        this.queueName = queueName;
        this.consuming = false;
        this.topicName = topicName;
        this.subscribed = false;
        this.url =  url;
        this.vpnName = vpnName;
        this.userName = userName;
        this.password = password;

        this.log('*** Consumer to "' + this.queueName + '" is ready to connect ***');
        
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
                        // Need to explicitly ack otherwise it will not be deleted from the message router
                        message.acknowledge();
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
    stopConsume() {
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
    unsubscribe() {
      if (this.session !== null) {
        if (this.subscribed) {
            this.log('Unsubscribing from topic: ' + this.topicName);
          try {
            this.messageSubscriber.removeSubscription(
              solace.SolclientFactory.createTopicDestination(this.topicName),
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

};

