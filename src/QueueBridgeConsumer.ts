import { GuaranteedSubscriber } from "./GuaranteedSubscriber"
import { SolaceConfigType } from "./SolaceConfigType"
import { SolaceBridgeConfigType } from "./SolaceBridgeConfigType"
import axios from "axios"

async function messageHandler(): Promise<void> { 

    console.log("EVENT HANDLER GOT A MESSAGE")
    axios({
        method: "get",
        url: "http://localhost:3000/message"
      });

}

export class QueueBridgeConsumer {
    solaceConfig: SolaceConfigType;
    solaceBridgeConfig: SolaceBridgeConfigType;
    subscriber?: GuaranteedSubscriber;

    constructor(
        solaceConfig: SolaceConfigType,
        solaceBridgeConfig: SolaceBridgeConfigType) {
        
        this.solaceConfig = solaceConfig;
        this.solaceBridgeConfig = solaceBridgeConfig;
    }

    startup() {
        console.log("QueueBridgeConsumer Starting")
        console.log("Solace Configuration")
        console.log(this.solaceConfig)
        console.log("Solace Bridge Configuration")
        console.log(this.solaceBridgeConfig)
        try {
                // create the consumer, specifying the name of the queue
            this.subscriber = new GuaranteedSubscriber(
                this.solaceConfig,
                "consumer-group/shared-queue",
                messageHandler
                );
                this.subscriber.init();
                // subscribe to messages on Solace PubSub+ Event Broker
                this.subscriber.connect();

                // wait to be told to exit
                this.subscriber.log("Press Ctrl-C to exit");
                process.stdin.resume();
                
                process.on('SIGINT',  () =>  {
                    'use strict';
                    if (this.subscriber) { 
                        this.subscriber.exit();
                    }
                });
            } catch (error: any) {
                console.log("ERROR:    ", error.toString());
            }
    }
}