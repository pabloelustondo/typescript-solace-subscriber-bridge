import { SolaceConfigType } from "../../src/SolaceConfigType";
import config from "../../config/int_solace.json"
function test(config: SolaceConfigType) { 
    console.log(config)
}
test(config)