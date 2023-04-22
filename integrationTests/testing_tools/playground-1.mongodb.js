

// Select the database to use.
use('qb_stats');
//view all records
const numberRecords = db.getCollection('request').find({
}).count();

// Print a message to the output window.
console.log(`${numberRecords} records.`);
