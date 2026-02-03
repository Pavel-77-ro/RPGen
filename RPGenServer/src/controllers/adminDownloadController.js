const Expert = require("../models/Expert");
const MonthlyReport = require("../models/MonthlyReport");
const { isValidObjectId } = require("../services/idService");
const { getDefaultTemplatePath, getNarrativesTemplatePath, renderDocx } = require("../services/docxService");
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

function capitalizeFirst(s) {
  const str = String(s || "");
  return str ? str[0].toUpperCase() + str.slice(1) : str;
}

const TARGET_POSITIONS = [
  "Expert comunicare GT si angajatori",
  "Expert selectie si mentinere GT",
  "Expert probleme mediu",
  "Expert parteneriate",
];

const NO_ACTIVITY_TEXT = "Nu exista activitate in aceasta luna.";

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

    const uidFirst = expert.uid?.split(".")[0] || expert.uid || "expert";
    const uidFirstCap = capitalizeFirst(uidFirst);

    const filename =
      `${safeFilename(uidFirstCap)}_${safeFilename(expert.position || "")}_${safeFilename(monthLabel)}.docx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(buf);
  } catch (e) {
    next(e);
  }
}

// GET /admin/reports/:year/:month/narratives/download
async function downloadAdminNarratives(req, res, next) {
  try {
    const { year: yearStr, month: monthStr } = req.params;

    const year = parseIntStrict(yearStr);
    const month = parseIntStrict(monthStr);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ ok: false, error: "Invalid year/month" });
    }

    const reports = await MonthlyReport.find({ year, month })
      .select("expertId description")
      .lean()
      .exec();

    const expertIds = reports.map((r) => r.expertId);

    const experts = await Expert.find({
      _id: { $in: expertIds },
      position: { $in: TARGET_POSITIONS },
    })
      .select("_id position")
      .lean()
      .exec();

    const expertById = new Map(experts.map((e) => [String(e._id), e]));

    const groups = TARGET_POSITIONS.map((position) => {
      const narratives = [];
      for (const r of reports) {
        const expert = expertById.get(String(r.expertId));
        if (!expert || expert.position !== position) continue;
        const text = String(r.description || "").trim();
        if (text) narratives.push(text);
      }

      return {
        position,
        narratives,
        noActivityText: NO_ACTIVITY_TEXT,
      };
    });

    const data = { groups };
    const buf = renderDocx(getNarrativesTemplatePath(), data);

    const monthLabel = formatRoMonthYearUpper(year, month);
    const filename = `Narative_${safeFilename(monthLabel)}.docx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(buf);
  } catch (e) {
    next(e);
  }
}

module.exports = { downloadAdminReport, downloadAdminNarratives };
