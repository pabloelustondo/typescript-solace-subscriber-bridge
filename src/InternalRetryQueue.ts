/*
This class will implement a mechanism to keep messages for a future "retry" execution.
The Queue Bridge Subscriber will use this class to defer the execution of failed messages.
This class will keep a counter to the number of messages in the queue and raise an exception if the maximum number of messages has been reached.
A message will be delayed based on a configuration set up per message type.
 
*/
//import { Message } from 'solclientjs'
//const MAXIMUM_NUMBER_RETRY_OF_MESSAGES: number = 1000
import { v1 as uuidv4 } from "uuid";
import { Message } from "solclientjs";
import { writeToLogs } from "./Logger";

/*
This is an example of retry strategy. we could add functions to calculate the delay based on the retry number and other ideas. One good idea  is the exponential back-off strategy.
*/

const retryStrategy: { [key: number]: number } = {
   1: 1000,
   2: 1000,
   3: 1000
};

export class InternalRetryQueue {
  notConfirmedMessages: {
    [key: string]: {
      message: Message,
      sent: boolean
    }
    } = { };

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
    sendDeadLetter: (message: any) => void
  ) {
    const msg = message.getBinaryAttachment().toString();
    const msgId = message.getCorrelationId();

    console.log(`WILL RETRY LATER ${msgId} ${msg} RETRY:${retry} DELAY:${delay}`);

    setTimeout(
      () =>
        this.processMessage(
          message,
          retry,
          handler,
          acknowledger,
          sendDeadLetter
        ),
      delay,
      message
    );
    this.messageCount++;
    //console.log(this.messageCount, new Date().toLocaleTimeString());
  }

  processMessage(
    message: any,
    retry: number,
    handler: (message: Message) => Promise<void>,
    acknowledger: (message: any) => void,
    sendDeadLetter: (message: any) => void
  ) {
    console.log(`PROCESSING RETRY ${retry}`, this.messageCount.toString());
    handler(message)
      .then(() => {
        const msg = message.getBinaryAttachment().toString();
        const msgId = message.getCorrelationId();
        console.log(`SUCCESS TRY ${msgId} ${msg} TRY:${retry}`);
        acknowledger(message);
      })
      .catch(() => {
        const msg = message.getBinaryAttachment().toString();
        const msgId = message.getCorrelationId();
        writeToLogs(`FAILED RETRY ${msgId} ${msg} RETRY:${retry}`);

        if (retryStrategy[retry]) {
          this.processMessageLater(
            message,
            retry + 1,
            1000,
            handler,
            acknowledger,
            sendDeadLetter
          );
        } else {
          this.notConfirmedMessages[msgId] = { message, sent: false };

          writeToLogs(`sent message id to dead letter queue: ${msgId}`);
          sendDeadLetter(message);
        }
      });

    this.messageCount--;
  }

  processAcknowledge(message: Message) {
    const msgId = message.getCorrelationId();

    if (msgId) {
      const messageSentToDLQ: Message = this.notConfirmedMessages[msgId].message;

      if (messageSentToDLQ) {
        messageSentToDLQ.acknowledge();
        // else  ?? this should not happen, anyway if we have no message... nothing to do.. log this
      }
        // else  ?? this should not happen, anyway if we have no message... nothing to do.. log this
    }
  }

  log(label: string, message: string) {
    /*
    console.log(
      `${label} ${message} at ${new Date().toLocaleTimeString()} count:${
        this.messageCount
      }`
    );
    */
  }
}