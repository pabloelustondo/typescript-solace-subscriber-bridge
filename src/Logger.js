"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeToLogs = void 0;
const logtimestamp = (new Date()).toLocaleTimeString();
const logfilename1 = `./logs/qb_consumer-log${logtimestamp}.log`;
const logfilename = logfilename1.replace(":", "-");
function writeToLogs(message) {
    /*
        const timestamp = (new Date()).toLocaleTimeString();
        fs.writeFile(logfilename, `${message} ${timestamp} \r\n`, {'flag':'a'}, (err) => {
          if (err) throw err;
        });
        */
}
exports.writeToLogs = writeToLogs;
