const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
    type:{
        type:String,
        required:true,
         enum: ["CSV_IMPORT"]
    },

    status: {
        type:String,
        required:true,
        enum: ["QUEUED", "PROCESSING", "COMPLETED", "FAILED"],
        default: "QUEUED"
    },
    payload: {
        // Mixed lets us accommodate different payload structures.
        // different types of payload strs -> key-value, json/bson, binary, heirarchal
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },
    progress: {
        type: Number,
        default: 0,
        min:0,
        max:100
    },
    attempts:{
        type:Number,
        default:0,
        min: 0
    },
    result:{
        type: mongoose.Schema.Types.Mixed,
        default:null
    },
    error:{
        type:String,
        default:null
    }
}, {
    timestamps: true
    // with timestamps: true, Mongoose automatically maintains createdAt and updatedAt
  }
);

module.exports = mongoose.model("Job", jobSchema);