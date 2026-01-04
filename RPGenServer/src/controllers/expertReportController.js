const Expert = require("../models/Expert");
const MonthlyReport = require("../models/MonthlyReport");

function parseIntStrict(v) {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

// Simple helper to compute "current" month/year.
// We'll use server local time; later we can lock timezone if needed.
function getCurrentYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

// GET /reports/mine  (expert)
async function listMyReports(req, res, next) {
  try {
    const expertId = req.user.expertId;

    const docs = await MonthlyReport.find({ expertId })
      .select("year month pmVerified updatedAt")
      .sort({ year: -1, month: -1 })
      .lean()
      .exec();

    return res.json({
      ok: true,
      items: docs.map(d => ({
        year: d.year,
        month: d.month,
        pmVerified: !!d.pmVerified,
        updatedAt: d.updatedAt,
      })),
    });
  } catch (e) {
    next(e);
  }
}

// GET /me
async function getMe(req, res, next) {
  try {
    const expertId = req.user.expertId;
    const expert = await Expert.findById(expertId).lean().exec();
    if (!expert) return res.status(404).json({ ok: false, error: "Expert not found" });

    return res.json({
      ok: true,
      expert: {
        id: String(expert._id),
        uid: expert.uid,
        name: expert.name,
        position: expert.position,
        contract: expert.contract,
        responsibility: expert.responsibility,
      },
    });
  } catch (e) {
    next(e);
  }
}

// GET /me/reports/current
async function getCurrentReport(req, res, next) {
  try {
    const expertId = req.user.expertId;
    const { year, month } = getCurrentYearMonth();

    let report = await MonthlyReport.findOne({ expertId, year, month }).lean().exec();

    return res.json({
      ok: true,
      year,
      month,
      report: report
        ? {
            id: String(report._id),
            pmVerified: !!report.pmVerified,
            verifiedAt: report.verifiedAt,
            rows: report.rows || [],
            description: report.description || "",
          }
        : null,
    });
  } catch (e) {
    next(e);
  }
}

// GET /me/reports/:year/:month
async function getReportByMonth(req, res, next) {
  try {
    const expertId = req.user.expertId;
    const year = parseIntStrict(req.params.year);
    const month = parseIntStrict(req.params.month);

    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ ok: false, error: "Invalid year/month" });
    }

    const report = await MonthlyReport.findOne({ expertId, year, month }).lean().exec();

    return res.json({
      ok: true,
      year,
      month,
      report: report
        ? {
            id: String(report._id),
            pmVerified: !!report.pmVerified,
            verifiedAt: report.verifiedAt,
            rows: report.rows || [],
            description: report.description || "",
          }
        : null,
    });
  } catch (e) {
    next(e);
  }
}

// PUT /me/reports/:year/:month
// body: { rows: [{ activity, results }], description: "..." }
// Only allowed if pmVerified == true
async function updateExpertPart(req, res, next) {
  try {
    const expertId = req.user.expertId;
    const year = parseIntStrict(req.params.year);
    const month = parseIntStrict(req.params.month);

    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ ok: false, error: "Invalid year/month" });
    }

    const report = await MonthlyReport.findOne({ expertId, year, month }).exec();
    if (!report) return res.status(404).json({ ok: false, error: "Report not found" });

    if (!report.pmVerified) {
      return res.status(403).json({ ok: false, error: "Report not available yet (not verified)" });
    }

    const incomingRows = req.body?.rows;
    if (incomingRows !== undefined && !Array.isArray(incomingRows)) {
      return res.status(400).json({ ok: false, error: "rows must be an array (if provided)" });
    }

    const description = typeof req.body?.description === "string" ? req.body.description : "";

    // Overwrite semantics for expert fields:
    // We update row-by-row by index, but we never allow changing title/hours.
    if (Array.isArray(incomingRows)) {
      report.rows = (report.rows || []).map((row, i) => {
        const ir = incomingRows[i] || {};
        const activity = typeof ir.activity === "string" ? ir.activity.trim() : "";
        const results = typeof ir.results === "string" ? ir.results.trim() : "";
        return {
          title: row.title,
          hours: row.hours,
          activity,
          results,
        };
      });
    }

    report.description = description; // can be empty to clear
    await report.save();

    return res.json({
      ok: true,
      report: {
        id: String(report._id),
        year: report.year,
        month: report.month,
        pmVerified: report.pmVerified,
        verifiedAt: report.verifiedAt,
        rows: report.rows,
        description: report.description,
        updatedAt: report.updatedAt,
      },
    });
  } catch (e) {
    next(e);
  }
}

module.exports = { getMe, getCurrentReport, getReportByMonth, updateExpertPart,listMyReports };

