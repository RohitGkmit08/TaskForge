const { Queue } = require("bullmq");

// BullMQ needs Redis to store and coordinate its queue data.
const connection = require("../config/redis");

// first argument, "csv-import-queue" is the name of the queue.
// second argument, "connection" provides the Redis connection.
const csvImportQueue = new Queue("csv-import-queue", {
  connection,
});

module.exports = csvImportQueue;

// csvImport.queue.js (creates BullMQ instance) --> redis.js (provides ioredis connection) --> Redis server (Stores and coordinates queue data)