import { QueueBridgeConsumer  } from "./src/QueueBridgeConsumer"
import  config from "./config.json"


const queueBridgeConsumer = new QueueBridgeConsumer(config)

queueBridgeConsumer.startup()