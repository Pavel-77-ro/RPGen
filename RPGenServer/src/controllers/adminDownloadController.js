const Expert = require("../models/Expert");
const MonthlyReport = require("../models/MonthlyReport");
const { isValidObjectId } = require("../services/idService");
const { getDefaultTemplatePath, getNarrativesTemplatePath, renderDocx } = require("../services/docxService");
const { renderAnexa13Workbook } = require("../services/xlsxService");
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
  "Cadru didactic supervizor",
  "Tutor practica",
];

const NO_ACTIVITY_TEXT = "Nu exista activitate in aceasta luna.";

const POSITION_ORDER = [
  "Expert comunicare GT si angajatori",
  "Expert selectie si mentinere GT",
  "Expert probleme mediu",
  "Expert parteneriate",
  "Cadru didactic supervizor",
  "Tutor practica",
];

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

function buildActivityCode(title) {
  const t = String(title || "").trim();
  if (!t) return "";
  return t.split(" ")[0];
}

// GET /admin/reports/:year/:month/anexa13/download
async function downloadAdminAnexa13(req, res, next) {
  try {
    const { year: yearStr, month: monthStr } = req.params;

    const year = parseIntStrict(yearStr);
    const month = parseIntStrict(monthStr);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ ok: false, error: "Invalid year/month" });
    }

    const monthKey = `${year}-${String(month).padStart(2, "0")}`;

    const experts = await Expert.aggregate([
      { $match: { activeMonths: monthKey } },
      {
        $addFields: {
          positionRank: {
            $let: {
              vars: { idx: { $indexOfArray: [POSITION_ORDER, "$position"] } },
              in: { $cond: [{ $eq: ["$$idx", -1] }, 999, "$$idx"] },
            },
          },
        },
      },
      { $sort: { positionRank: 1, name: 1, createdAt: 1 } },
      { $project: { positionRank: 0 } },
    ]).collation({ locale: "ro", strength: 1 });

    const expertIds = experts.map((e) => e._id);

    const reports = await MonthlyReport.find({
      expertId: { $in: expertIds },
      year,
      month,
    })
      .lean()
      .exec();

    const byExpertId = new Map(reports.map((r) => [String(r.expertId), r]));

    const rows = experts.map((e) => {
      const report = byExpertId.get(String(e._id));
      const reportRows = report?.rows || [];

      const activityCodes = reportRows
        .map((r) => buildActivityCode(r.title))
        .filter((x) => x);

      const activities =
        activityCodes.length > 0
          ? Array.from(new Set(activityCodes)).join(", ")
          : "MISS";

      const activitiesWithHours = reportRows
        .map((r) => {
          const code = buildActivityCode(r.title);
          const hours = Number(r.hours);
          if (!code || !Number.isFinite(hours)) return "";
          return `${code}-${hours}`;
        })
        .filter((x) => x)
        .join("\n");

      return {
        name: String(e.name || "").toUpperCase(),
        position: e.position,
        activities,
        activitiesWithHours: activitiesWithHours || "MISS",
      };
    });

    const buf = await renderAnexa13Workbook({ year, month, rows });

    const monthLabel = formatRoMonthYearUpper(year, month);
    const filename = `Anexa_13_${safeFilename(monthLabel)}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(Buffer.from(buf));
  } catch (e) {
    next(e);
  }
}

function monthKeyFromParts(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function listMonthsInRange(fromYear, fromMonth, toYear, toMonth) {
  const months = [];
  let y = fromYear;
  let m = fromMonth;
  while (y < toYear || (y === toYear && m <= toMonth)) {
    months.push({ year: y, month: m, key: monthKeyFromParts(y, m) });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

// GET /admin/reports/anexa13/range/download?fromYear=2025&fromMonth=9&toYear=2025&toMonth=11
async function downloadAdminAnexa13Range(req, res, next) {
  try {
    const fromYear = parseIntStrict(req.query.fromYear);
    const fromMonth = parseIntStrict(req.query.fromMonth);
    const toYear = parseIntStrict(req.query.toYear);
    const toMonth = parseIntStrict(req.query.toMonth);

    if (
      !fromYear ||
      !fromMonth ||
      !toYear ||
      !toMonth ||
      fromMonth < 1 ||
      fromMonth > 12 ||
      toMonth < 1 ||
      toMonth > 12
    ) {
      return res.status(400).json({ ok: false, error: "Invalid range" });
    }

    const fromIndex = fromYear * 12 + (fromMonth - 1);
    const toIndex = toYear * 12 + (toMonth - 1);
    if (fromIndex > toIndex) {
      return res.status(400).json({ ok: false, error: "Invalid range order" });
    }

    const rangeMonths = listMonthsInRange(fromYear, fromMonth, toYear, toMonth);
    const rangeKeys = rangeMonths.map((m) => m.key);

    const experts = await Expert.find({
      activeMonths: { $in: rangeKeys },
    })
      .lean()
      .exec();

    const expertIds = experts.map((e) => e._id);

    const reports = await MonthlyReport.find({
      expertId: { $in: expertIds },
      year: { $gte: fromYear, $lte: toYear },
    })
      .lean()
      .exec();

    const reportMap = new Map(
      reports.map((r) => [
        `${String(r.expertId)}|${monthKeyFromParts(r.year, r.month)}`,
        r,
      ])
    );

    const rows = [];
    const sortedExperts = [...experts].sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "ro", {
        sensitivity: "base",
      })
    );

    for (const e of sortedExperts) {
      const activeSet = new Set(e.activeMonths || []);
      for (const m of rangeMonths) {
        if (!activeSet.has(m.key)) continue;
        const report = reportMap.get(`${String(e._id)}|${m.key}`);
        const reportRows = report?.rows || [];

        const activityCodes = reportRows
          .map((r) => buildActivityCode(r.title))
          .filter((x) => x);

        const activities =
          activityCodes.length > 0
            ? Array.from(new Set(activityCodes)).join(", ")
            : "MISS";

        const activitiesWithHours = reportRows
          .map((r) => {
            const code = buildActivityCode(r.title);
            const hours = Number(r.hours);
            if (!code || !Number.isFinite(hours)) return "";
            return `${code}-${hours}`;
          })
          .filter((x) => x)
          .join("\n");

        rows.push({
          name: String(e.name || "").toUpperCase(),
          position: e.position,
          activities,
          activitiesWithHours: activitiesWithHours || "MISS",
          monthDate: new Date(m.year, m.month - 1, 1),
        });
      }
    }

    const buf = await renderAnexa13Workbook({ rows });

    const filename = `Anexa_13_${safeFilename(
      `${fromYear}-${String(fromMonth).padStart(2, "0")}_to_${toYear}-${String(
        toMonth
      ).padStart(2, "0")}`
    )}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(Buffer.from(buf));
  } catch (e) {
    next(e);
  }
}

module.exports = {
  downloadAdminReport,
  downloadAdminNarratives,
  downloadAdminAnexa13,
  downloadAdminAnexa13Range,
};
