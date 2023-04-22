"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalRetryQueue = void 0;
const Logger_1 = require("./Logger");
const retryStrategy = {
// 1: 1000,
// 2: 1000,
// 3: 1000
};
class InternalRetryQueue {
    constructor() {
        this.notConfirmedMessages = {};
        this.messageCount = 0;
    }
    /*
      TO=Do:
          message type,., handler type
  
      */
    processMessageLater(message, retry, delay, handler, acknowledger, sendDeadLetter) {
        const msg = message.getBinaryAttachment().toString();
        const msgId = message.getCorrelationId();
        (0, Logger_1.writeToLogs)(`WILL RETRY ${msgId} ${msg} RETRY:${retry} DELAY:${delay}`);
        setTimeout(() => this.processMessage(message, retry, handler, acknowledger, sendDeadLetter), delay, message);
        this.messageCount++;
        //console.log(this.messageCount, new Date().toLocaleTimeString());
    }
    processMessage(message, retry, handler, acknowledger, sendDeadLetter) {
        this.log(`Processing message retry ${retry}`, this.messageCount.toString());
        handler(message)
            .then(() => {
            const msg = message.getBinaryAttachment().toString();
            const msgId = message.getCorrelationId();
            (0, Logger_1.writeToLogs)(`SUCCESS TRY ${msgId} ${msg} TRY:${retry}`);
            acknowledger(message);
        })
            .catch(() => {
            const msg = message.getBinaryAttachment().toString();
            const msgId = message.getCorrelationId();
            (0, Logger_1.writeToLogs)(`FAILED RETRY ${msgId} ${msg} RETRY:${retry}`);
            if (retryStrategy[retry]) {
                this.processMessageLater(message, retry + 1, 1000, handler, acknowledger, sendDeadLetter);
            }
            else {
                this.notConfirmedMessages[msgId] = { message, sent: false };
                (0, Logger_1.writeToLogs)(`sent message id to dead letter queue: ${msgId}`);
                sendDeadLetter(message);
            }
        });
        this.messageCount--;
    }
    processAcknowledge(message) {
        const msgId = message.getCorrelationId();
        if (msgId) {
            const messageSentToDLQ = this.notConfirmedMessages[msgId].message;
            if (messageSentToDLQ) {
                messageSentToDLQ.acknowledge();
                // else  ?? this should not happen, anyway if we have no message... nothing to do.. log this
            }
            // else  ?? this should not happen, anyway if we have no message... nothing to do.. log this
        }
    }
    log(label, message) {
        /*
        console.log(
          `${label} ${message} at ${new Date().toLocaleTimeString()} count:${
            this.messageCount
          }`
        );
        */
    }
}
exports.InternalRetryQueue = InternalRetryQueue;
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
