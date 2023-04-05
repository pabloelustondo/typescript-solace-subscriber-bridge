/*
This class will implement a mechanism to keep messages for a future "retry" execution.
The Queue Bridge Subscriber will use this class to defer the execution of failed messages.
This class will keep a counter to the number of messages in the queue and raise an exception if the maximum number of messages has been reached.
A message will be delayed based on a configuration set up per message type.
 
*/
//import { Message } from 'solclientjs'
//const MAXIMUM_NUMBER_RETRY_OF_MESSAGES: number = 1000

import { Message } from 'solclientjs'
import { writeToLogs } from "./Logger"

const retryStrategy: { [key:number]:number } = {
    1: 1000,
   // 2: 1000,
   // 3: 1000
}

export class InternalRetryQueue { 

    messageCount: number = 0;
    
    /*
    TO=Do:
        message type,., handler type

    */
    processMessageLater(
        message: any,
        retry: number,
        delay: number,
        handler: (message: any) => Promise<void>,
        acknowledger: (message: any) => void,
        sendDeadLetter: (message: any) => void )
    {

        const msg = message.getBinaryAttachment().toString()
        const msgId = message.getGuaranteedMessageId()

        writeToLogs(`WILL RETRY ${msgId} ${msg} RETRY:${retry} DELAY:${delay}`);

        setTimeout(
            () =>
                this.processMessage(message, retry, handler, acknowledger, sendDeadLetter),
            delay,
            message) 
        this.messageCount++;
        console.log(this.messageCount, (new Date()).toLocaleTimeString())

    }

    processMessage(
        message: any,
        retry: number,
        handler: (message: Message) => Promise<void>,
        acknowledger: (message: any) => void,
        sendDeadLetter: (message: any) => void ) { 

        this.log(`Processing message retry ${retry}` , this.messageCount.toString());
        handler(message)
            .then(
                () => { 
                const msg = message.getBinaryAttachment().toString()
                const msgId = message.getGuaranteedMessageId()
                    writeToLogs(`SUCCESS RETRY ${msgId} ${msg} RETRY:${retry}`);
                    acknowledger(message);
                }

            )
            .catch(
                () =>
                { 
                    const msg = message.getBinaryAttachment().toString()
                    const msgId = message.getGuaranteedMessageId()
                    writeToLogs(`FAILED RETRY ${msgId} ${msg} RETRY:${retry}`);

                    if (retryStrategy[retry]) {
                        this.processMessageLater(
                            message,
                            retry + 1,
                            1000,
                            handler,
                            acknowledger,
                            sendDeadLetter
                        )
                    } else { 
                        const deadLetter = `GAVE UP RETRY ${msgId} ${msg} RETRY:${retry}${message.dump()}`;

                        writeToLogs(deadLetter);
                        sendDeadLetter(deadLetter);
                        acknowledger(message);
                    }

                }
            )

        this.messageCount--;


    }

    log(label: string, message: string) { 
        console.log(`${label} ${message} at ${(new Date()).toLocaleTimeString()} count:${this.messageCount}`)
    }
}


/*
quick test




import axios from "axios"

const internalRetryQueue = new InternalRetryQueue();
const testMessage: string = "message content"


async function messageHandler(message: string ): Promise<void> { 
    const messageContent = message || "no payload";
    console.log("EVENT HANDLER GOT A MESSAGE" + messageContent)
    return axios({
        method: "get",
        url: "http://localhost:3000/message"
      });
}


internalRetryQueue.processMessageLater("Hello", 1000, () => messageHandler("Hi 1 "));
internalRetryQueue.processMessageLater("Hello", 1000, () => messageHandler("Hi 2 "));

*/
    