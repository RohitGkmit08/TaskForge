/**
 *  Here 3 things would be happening -
 * a. "csv-import-queue" tells the worker which queue to listen to.
 * b. The async function is the processor. BullMQ calls it when a job is picked up.
 * c. "connection" tells the worker how to communicate with Redis.
 */

require("dotenv").config();

const { Worker } = require("bullmq");

const connection = require("../config/redis");
const connectDB = require("../config/db");
const Job = require("../models/Job");

async function startWorker() {
  // Step 1 -  Establish MongoDB connection
  await connectDB();

  // Step 2 - Start BullMQ worker
  const worker = new Worker(
    "csv-import-queue",

    async (job) => {
      const mongoJobId = job.data.mongoJobId;

      try {
        console.log("Worker picked up job:", job.id);

        // Step 3 -  Mark job as PROCESSING
        await Job.findByIdAndUpdate(mongoJobId, {
          status: "PROCESSING",
          $inc: { attempts: 1 },
        });

        // Actual CSV processing will be implemented later.
        const result = {
          received: true,
          message: "Worker execution verified",
        };

        // Step 4 -  Mark job as COMPLETED
        await Job.findByIdAndUpdate(mongoJobId, {
          status: "COMPLETED",
          progress: 100,
          result,
          error: null,
        });

        return result;

      } catch (error) {
        // Step 5 -  Mark job as FAILED
        await Job.findByIdAndUpdate(mongoJobId, {
          status: "FAILED",
          error: error.message,
        });

        throw error;
      }
    },

    {
      connection,
    }
  );

  worker.on("completed", (job, result) => {
    console.log(`Job ${job.id} completed`);
    console.log("Result:", result);
  });

  worker.on("failed", (job, error) => {
    console.error(`Job ${job?.id} failed:`, error.message);
  });

  worker.on("error", (error) => {
    console.error("Worker error:", error);
  });

  console.log("CSV Import Worker is listening...");
}

startWorker().catch((error) => {
  console.error("Worker startup failed:", error);
  process.exit(1);
});
