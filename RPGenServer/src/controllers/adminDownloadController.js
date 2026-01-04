const Expert = require("../models/Expert");
const MonthlyReport = require("../models/MonthlyReport");
const { isValidObjectId } = require("../services/idService");
const { getDefaultTemplatePath, renderDocx } = require("../services/docxService");
const { formatRoMonthYearUpper, lastDayOfMonth, formatDateDDMMYYYY } = require("../services/dateService");

function parseIntStrict(v) {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function safeFilename(s) {
  return String(s || "")
    .replace(/[^\w\d\-_. ]+/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

// GET /admin/reports/:expertId/:year/:month/download
async function downloadAdminReport(req, res, next) {
  try {
    const { expertId, year: yearStr, month: monthStr } = req.params;

    if (!isValidObjectId(expertId)) {
      return res.status(400).json({ ok: false, error: "Invalid expertId" });
    }

    const year = parseIntStrict(yearStr);
    const month = parseIntStrict(monthStr);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ ok: false, error: "Invalid year/month" });
    }

    const expert = await Expert.findById(expertId).lean().exec();
    if (!expert) return res.status(404).json({ ok: false, error: "Expert not found" });

    const report = await MonthlyReport.findOne({ expertId, year, month }).lean().exec();
    if (!report) return res.status(404).json({ ok: false, error: "Report not found" });

    const monthLabel = formatRoMonthYearUpper(year, month);
    const dateLabel = formatDateDDMMYYYY(lastDayOfMonth(year, month));

    // IMPORTANT: template uses {{responsability}} (typo), and you want it only on first row
    const rows = (report.rows || []).map((r, i) => ({
      title: r.title || "",
      hours: r.hours ?? 0,
      activity: r.activity || "",
      results: r.results || "",
      responsability: i === 0 ? (expert.responsibility || "") : "Conform descrierii de mai sus!",
    }));

    const data = {
      month: monthLabel,
      date: dateLabel,
      name: expert.name,
      position: expert.position,
      contract: expert.contract,
      rows,
      description: report.description || "",
    };

    const buf = renderDocx(getDefaultTemplatePath(), data);

    const filename = `${safeFilename(expert.name.split(" ")[0] || expert.uid || "expert")}_${safeFilename(expert.position||"")}_${safeFilename(monthLabel)}.docx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(buf);
  } catch (e) {
    next(e);
  }
}

module.exports = { downloadAdminReport };
