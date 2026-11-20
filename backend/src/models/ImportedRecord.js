// The ImportedRecord model will represent each successfully imported CSV record.

//** The need for a new model - the Job model tracks the import operation. 
// There is no way as of now to track indivisual record
// */

const mongoose = require("mongoose");

const importedRecordSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    age: {
      type: Number,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
  },
  {
    versionKey: false,
  }
);

const ImportedRecord = mongoose.model("ImportedRecord",importedRecordSchema);

module.exports = ImportedRecord;