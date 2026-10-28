const express = require("express");
const jobController = require("../controllers/jobController");

const router = express.Router();

router.post("/", jobController.createJob);
router.get("/:id", jobController.getJobById);

module.exports = router;
