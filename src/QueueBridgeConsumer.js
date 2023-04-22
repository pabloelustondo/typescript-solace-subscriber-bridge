"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueBridgeConsumer = void 0;
const GuaranteedSubscriber_1 = require("./GuaranteedSubscriber");
const axios_1 = __importDefault(require("axios"));
function messageHandler(message) {
    return __awaiter(this, void 0, void 0, function* () {
        const queueName = message.getDestination().getName() || "no queue name";
        const messageContent = message.getBinaryAttachment() || "no payload";
        //console.log("SENDING MESSAGE TO SERVICE" + messageContent.toString())
        return (0, axios_1.default)({
            method: "post",
            url: `http://localhost:3000/${queueName}`,
            data: messageContent.toString(),
        });
    });
}
class QueueBridgeConsumer {
    constructor(solaceConfig, solaceBridgeConfig, internalRetryQueue) {
        this.solaceConfig = solaceConfig;
        this.solaceBridgeConfig = solaceBridgeConfig;
        this.internalRetryQueue = internalRetryQueue;
    }
    startup() {
        console.log("QueueBridgeConsumer Starting");
        console.log("Solace Configuration");
        console.log(this.solaceConfig);
        console.log("Solace Bridge Configuration");
        console.log(this.solaceBridgeConfig);
        try {
            // create the consumer, specifying the name of the queue
            this.subscriber = new GuaranteedSubscriber_1.GuaranteedSubscriber(this.solaceConfig, "q-1", messageHandler, this.internalRetryQueue);
            this.subscriber.init();
            // subscribe to messages on Solace PubSub+ Event Broker
            this.subscriber.connect();
            // wait to be told to exit
            this.subscriber.log("Press Ctrl-C to exit");
            process.stdin.resume();
            process.on('SIGINT', () => {
                'use strict';
                if (this.subscriber) {
                    this.subscriber.exit();
                }
            });
        }
        catch (error) {
            console.log("ERROR:    ", error.toString());
        }
        // QUEUE 2
        try {
            // create the consumer, specifying the name of the queue
            this.subscriber = new GuaranteedSubscriber_1.GuaranteedSubscriber(this.solaceConfig, "q-2", messageHandler, this.internalRetryQueue);
            this.subscriber.init();
            // subscribe to messages on Solace PubSub+ Event Broker
            this.subscriber.connect();
            // wait to be told to exit
            this.subscriber.log("Press Ctrl-C to exit");
            process.stdin.resume();
            process.on('SIGINT', () => {
                'use strict';
                if (this.subscriber) {
                    this.subscriber.exit();
                }
            });
        }
        catch (error) {
            console.log("ERROR:    ", error.toString());
        }
    }
}
exports.QueueBridgeConsumer = QueueBridgeConsumer;
