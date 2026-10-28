const express = require("express");
const jobRoutes = require("./routes/jobRoutes");

const app = express();

app.use(express.json());

app.use("/api/jobs", jobRoutes);

app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    message: "Internal server error",
  });
});
module.exports = app;
