const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: true,
    unique: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["queued", "processing", "completed", "failed"],
    default: "queued",
  },
  logs: [
    {
      supplierName: {
        type: String,
        required: true,
      },
      status: {
        type: String,
        enum: ["success", "failed"], 
      },
    },
  ],
});

const Job = mongoose.model("Job", jobSchema);

module.exports = Job;
