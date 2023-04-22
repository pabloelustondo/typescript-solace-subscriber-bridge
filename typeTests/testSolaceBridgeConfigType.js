"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const int_solace_bridge_json_1 = __importDefault(require("../config/int_solace_bridge.json"));
function test(config) {
    console.log(config);
}
test(int_solace_bridge_json_1.default);
