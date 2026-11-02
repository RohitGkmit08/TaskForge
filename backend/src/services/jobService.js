const Job = require("../models/Job");
const csvImportQueue = require("../queues/csvImport.queue");

async function createJob(data) {
  // Step 1: Create the job record in MongoDB
  const job = await Job.create({
    type: data.type,
    payload: data.payload,
  });

  try {
    // Step 2: Adding a job to BullMQ. 
    // It takes 3 arguments - name of the job, data the worker will recieve, Configuration for the queued job queue
    await csvImportQueue.add("process-csv-import",

      // mongoJobId -> we have 2 seperate systems here, MongoDB and BullMQ.That's why we're passing MongoDB's _id to BullMQ to connect them.
      {mongoJobId: job._id.toString(), 
      payload: job.payload,}, 

      // jobId -> This gives the BullMQ job a predictable ID corresponding to the MongoDB record.
      {jobId: job._id.toString(),}
    );
  } catch (error) {
    // Step 3: Mark the MongoDB job as failed if enqueueing fails
    await Job.findByIdAndUpdate(job._id, {
      status: "FAILED",
      error: error.message,
    });

    throw error;
  }

  return job;
}

async function getJobById(id) {
  return Job.findById(id);
}

module.exports = {
  createJob,
  getJobById,
};
