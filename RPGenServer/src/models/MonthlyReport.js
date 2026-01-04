const mongoose = require("mongoose");

const RowSchema = new mongoose.Schema(
  {
    // PM fields
    title: { type: String, default: "", trim: true },
    hours: { type: Number, default: 0, min: 0 },

    // Expert fields
    activity: { type: String, default: "", trim: true },
    results: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const MonthlyReportSchema = new mongoose.Schema(
  {
    expertId: { type: mongoose.Schema.Types.ObjectId, ref: "Expert", required: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },

    pmVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },

    rows: { type: [RowSchema], default: [] },

    // Expert narrative section
    description: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

// Unique report per expert per (year, month)
MonthlyReportSchema.index({ expertId: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("MonthlyReport", MonthlyReportSchema);
