import { QueueBridgeConsumer  } from "./src/QueueBridgeConsumer"
import configSolace from "./config/int_solace.json"
import configSolaceBridge from "./config/int_solace_bridge.json"



const queueBridgeConsumer = new QueueBridgeConsumer(
    configSolace,
    configSolaceBridge
)

queueBridgeConsumer.startup()