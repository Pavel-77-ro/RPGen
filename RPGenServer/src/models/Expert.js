const mongoose = require("mongoose");

const ExpertSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    position: { type: String, required: true, trim: true },
    contract: { type: String, required: true, trim: true },
    responsibility: { type: String, required: true, trim: true },
    activeMonths: { type: [String], default: [] }, // ["2026-01","2026-02"]

  },
  { timestamps: true }
);
ExpertSchema.index({ activeMonths: 1 });

module.exports = mongoose.model("Expert", ExpertSchema);
