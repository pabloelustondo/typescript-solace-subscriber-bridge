import { GuaranteedSubscriber } from "./GuaranteedSubscriber"


export class QueueBridgeConsumer {
    config: QueueBridgeConsumerConfigType;
    constructor(config:QueueBridgeConsumerConfigType) {
            this.config = config
    }
    startup() {
        console.log("QueueBridgeConsumer Starting")
        console.log(this.config)
        try {
                // create the consumer, specifying the name of the queue
            const subscriber = new GuaranteedSubscriber(
                // TO_DO cleanup this parameters
                this.config.solaceBrokerConfig.main_queue,
                "unused topic",
                this.config.solaceBrokerConfig.url,
                this.config.solaceBrokerConfig.vpn,
                this.config.solaceBrokerConfig.user,
                this.config.solaceBrokerConfig.password,
                );
                subscriber.init();
                // subscribe to messages on Solace PubSub+ Event Broker
            subscriber.connect();

                // wait to be told to exit
                subscriber.log("Press Ctrl-C to exit");
                process.stdin.resume();
                
                process.on('SIGINT',  () =>  {
                    'use strict';
                    subscriber.exit();
                });
            } catch (error: any) {
                console.log("ERROR:    ", error.toString());
            }
    }
}
type SolaceBrokerConfigType =  { 
    url: string; 
    vpn: string; 
    user: string; 
    password: string; 
    main_queue: string; 
    retry_queue1: string; 
    retry_queue2: string; 
    retry_queue3: string; 
};

export type QueueBridgeConsumerConfigType = {
    solaceBrokerConfig: SolaceBrokerConfigType
}