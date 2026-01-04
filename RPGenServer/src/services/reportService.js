const MonthlyReport = require("../models/MonthlyReport");

async function getOrCreateReport(expertId, year, month) {
  let report = await MonthlyReport.findOne({ expertId, year, month }).exec();
  if (!report) {
    report = await MonthlyReport.create({
      expertId,
      year,
      month,
      rows: [],
      description: "",
      pmVerified: false,
      verifiedAt: null,
    });
  }
  return report;
}

module.exports = { getOrCreateReport };
