import { QueueBridgeConsumer } from "./src/QueueBridgeConsumer";
import configSolace from "./config/int_solace.json";
import configSolaceBridge from "./config/int_solace_bridge.json";
import { InternalRetryQueue } from "./src/InternalRetryQueue";

const internalRetryQueue = new InternalRetryQueue();

const queueBridgeConsumer = new QueueBridgeConsumer(
    configSolace,
    configSolaceBridge,
    internalRetryQueue
)

queueBridgeConsumer.startup()