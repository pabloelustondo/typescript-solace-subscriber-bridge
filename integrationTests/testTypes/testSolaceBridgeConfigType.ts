import { SolaceBridgeConfigType } from "../../src/SolaceBridgeConfigType";

import config from "../../config/int_solace_bridge.json"
function test(config: SolaceBridgeConfigType) { 
    console.log(config)
}
test(config)