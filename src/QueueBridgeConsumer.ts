import { GuaranteedSubscriber } from "./GuaranteedSubscriber"
import { SolaceConfigType } from "./SolaceConfigType"
import { SolaceBridgeConfigType } from "./SolaceBridgeConfigType"
import axios from "axios"
import { Message } from 'solclientjs'
import {  InternalRetryQueue } from "./InternalRetryQueue"

async function messageHandler(message: Message): Promise<void> { 
    const messageContent = message.getBinaryAttachment() || "no payload";
    console.log("EVENT HANDLER GOT A MESSAGE" + messageContent.toString())
    return axios({
        method: "get",
        url: "http://localhost:3000/message"
      });
}

export class QueueBridgeConsumer {
    solaceConfig: SolaceConfigType;
    solaceBridgeConfig: SolaceBridgeConfigType;
    subscriber?: GuaranteedSubscriber;
    internalRetryQueue: InternalRetryQueue

    constructor(
        solaceConfig: SolaceConfigType,
        solaceBridgeConfig: SolaceBridgeConfigType,
        internalRetryQueue: InternalRetryQueue
    
    ) {
        
        this.solaceConfig = solaceConfig;
        this.solaceBridgeConfig = solaceBridgeConfig;
        this.internalRetryQueue = internalRetryQueue;
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
                messageHandler,
                this.internalRetryQueue
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