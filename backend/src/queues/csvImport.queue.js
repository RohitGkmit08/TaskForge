const { Queue } = require("bullmq");
const connection = require("../config/redis");

const csvImportQueue = new Queue("csv-import-queue", {
  connection,
});

module.exports = csvImportQueue;