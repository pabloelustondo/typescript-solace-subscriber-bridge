import { GuaranteedSubscriber } from "./GuaranteedSubscriber"
import { SolaceConfigType } from "./SolaceConfigType"
import { SolaceBridgeConfigType, SolaceBridgeConfigUrlType } from "./SolaceBridgeConfigType"
import axios from "axios"
import  http from 'http';
import { Message } from 'solclientjs'
import {  InternalRetryQueue } from "./InternalRetryQueue"

async function messageHandler(message: Message): Promise<void> { 
    /* NOTE: this message sender may fail due to The ECONNRESET error occurs when a connection is forcibly closed by the other end. In this case, it looks like the connection between your node.js Solace queue consumer and the server at 127.0.0.1:3000 is being closed unexpectedly.
    to try to avoid that ia that we can try:
    axios.get(url, { timeout: 10000 })
    axios.get(url, { keepAlive: false })
    */
    const queueName = message.getDestination()!.getName() || "no queue name";
    const messageContent = message.getBinaryAttachment() || "no payload";
    //console.log("SENDING MESSAGE TO SERVICE" + messageContent.toString())
    return axios({
        method: "post",
        url: `http://localhost:3000/${queueName}`,
        data: messageContent.toString(),
        timeout: 1000000,  // put this in config.
        httpAgent: new http.Agent({ keepAlive: false })
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

        for (const config of this.solaceBridgeConfig.bridgeConfig) { 
            try {

                // create the consumer, specifying the name of the queue
            this.subscriber = new GuaranteedSubscriber(
                this.solaceConfig,
                config.queueName,
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
}