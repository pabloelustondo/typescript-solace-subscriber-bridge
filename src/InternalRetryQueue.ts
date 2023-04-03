/*
This class will implement a mechanism to keep messages for a future "retry" execution.
The Queue Bridge Subscriber will use this class to defer the execution of failed messages.
This class will keep a counter to the number of messages in the queue and raise an exception if the maximum number of messages has been reached.
A message will be delayed based on a configuration set up per message type.
 
*/
//import { Message } from 'solclientjs'
//const MAXIMUM_NUMBER_RETRY_OF_MESSAGES: number = 1000

class InternalRetryQueue { 

    messageCount: number = 0;
    
    /*
    TO=Do:
        message type,., handler type

    */
    processMessageLater(message: string, delay: number, handler: (message: string ) =>  Promise<void> ) { 

        setTimeout(() => this.processMessage(message, handler) , delay, message) 
        this.messageCount++;
        console.log(this.messageCount, (new Date()).toLocaleTimeString())

    }

    processMessage(message: string, handler: (message: string ) =>  Promise<void>) { 

        this.log("Processing message", message);
        handler(message).
            then(
                () => this.log("successfully processed ", message)
            ).
            catch(
                () => this.log("error when processing", message)
            ).
            finally(
                () => this.log("finally when processing", message)
            )

        this.messageCount--;


    }

    log(label: string, message: string) { 
        console.log(`${label} ${message} at ${(new Date()).toLocaleTimeString()} count:${this.messageCount}`)
    }
}


/*
quick test


*/

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
    