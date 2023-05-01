const fs = require('fs').promises;
const argv = require('yargs').argv;
const path = require('path');

getConfig = async (argv) => { 
    const cwd = path.resolve(__dirname);
    const configFileName = argv.config ||`${cwd}/test-config.json`;
    const config = JSON.parse(await fs.readFile(configFileName, 'utf-8'));
    return config
}



module.exports = getConfig;