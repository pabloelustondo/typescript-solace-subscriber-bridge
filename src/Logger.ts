import fs from 'fs';

const logtimestamp = (new Date()).toLocaleTimeString();
const logfilename1 = `./logs/qb_consumer-log${logtimestamp}.log`;
const logfilename = logfilename1.replace(":", "-")

export function writeToLogs(message: string) { 
/*
    const timestamp = (new Date()).toLocaleTimeString();
    fs.writeFile(logfilename, `${message} ${timestamp} \r\n`, {'flag':'a'}, (err) => {
      if (err) throw err;
    });
    */
}