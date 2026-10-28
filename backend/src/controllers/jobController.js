const mongoose = require("mongoose");
const jobService = require("../services/jobService");

async function createJob(req, res, next) {
  try {
    const { type, payload } = req.body;

    if (!type || !payload || typeof payload !== "object" || Array.isArray(payload)) {
      return res.status(400).json({
        message: "type and a valid payload object are required",
      });
    }

    const job = await jobService.createJob({ type, payload });
    return res.status(201).json({ job });

  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: error.message,
      });
    }
    next(error);
  }
}

async function getJobById(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid job ID",
      });
    }

    const job = await jobService.getJobById(id);

    if (!job) {
      return res.status(404).json({
        message: "Job not found",
      });
    }
    return res.status(200).json({ job });

  } catch (error) {
    next(error);
  }
}

module.exports = {createJob,getJobById};
