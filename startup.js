"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const QueueBridgeConsumer_1 = require("./src/QueueBridgeConsumer");
const int_solace_json_1 = __importDefault(require("./config/int_solace.json"));
const int_solace_bridge_json_1 = __importDefault(require("./config/int_solace_bridge.json"));
const InternalRetryQueue_1 = require("./src/InternalRetryQueue");
const internalRetryQueue = new InternalRetryQueue_1.InternalRetryQueue();
const queueBridgeConsumer = new QueueBridgeConsumer_1.QueueBridgeConsumer(int_solace_json_1.default, int_solace_bridge_json_1.default, internalRetryQueue);
queueBridgeConsumer.startup();
