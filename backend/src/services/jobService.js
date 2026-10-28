const Job = require("../models/Job");

async function createJob(data) {
  const job = await Job.create({
    type: data.type,
    payload: data.payload,
  });

  return job;
}

async function getJobById(id) {
  return Job.findById(id);
}

module.exports = {createJob,getJobById};
