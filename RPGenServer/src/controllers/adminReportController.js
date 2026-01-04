const Expert = require("../models/Expert");
const MonthlyReport = require("../models/MonthlyReport");
const { isValidObjectId } = require("../services/idService");
const { getOrCreateReport } = require("../services/reportService");

function parseIntStrict(v) {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

// GET /admin/reports?year=2026&month=1
async function listMonthReports(req, res, next) {
  try {
    const year = parseIntStrict(req.query.year);
    const month = parseIntStrict(req.query.month);

    if (!year || !month || month < 1 || month > 12) {
      return res
        .status(400)
        .json({ ok: false, error: "year and month are required (month 1-12)" });
    }

    // NEW: month key format "YYYY-MM"
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;

    // NEW: only experts active in this month
    const experts = await Expert.find({ activeMonths: monthKey })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const expertIds = experts.map((e) => e._id);

    const reports = await MonthlyReport.find({
      expertId: { $in: expertIds },
      year,
      month,
    })
      .lean()
      .exec();

    const byExpertId = new Map(reports.map((r) => [String(r.expertId), r]));

    const items = experts.map((e) => {
      const r = byExpertId.get(String(e._id));
      const exists = !!r;
      const pmVerified = !!r?.pmVerified;

      // a lightweight “expert started” indicator for UI (optional)
      const expertStarted =
        !!r &&
        (r.description?.trim()?.length > 0 ||
          (Array.isArray(r.rows) &&
            r.rows.some(
              (x) => (x.activity || "").trim() || (x.results || "").trim()
            )));

      return {
        expert: {
          id: String(e._id),
          uid: e.uid,
          name: e.name,
          position: e.position,
          contract: e.contract,
          responsibility: e.responsibility,
          activeMonths: e.activeMonths || [], // optional but useful
        },
        report: exists
          ? {
              id: String(r._id),
              year: r.year,
              month: r.month,
              pmVerified,
              verifiedAt: r.verifiedAt,
              rowsCount: r.rows?.length || 0,
              expertStarted,
              updatedAt: r.updatedAt,
            }
          : null,
      };
    });

    return res.json({ ok: true, year, month, items });
  } catch (e) {
    next(e);
  }
}


// PUT /admin/reports/:expertId/:year/:month/pm
// body: { rows: [{ title, hours }] }
async function upsertPmPart(req, res, next) {
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

    const expert = await Expert.findById(expertId).exec();
    if (!expert)
      return res.status(404).json({ ok: false, error: "Expert not found" });

    const rows = req.body?.rows;
    if (!Array.isArray(rows)) {
      return res
        .status(400)
        .json({ ok: false, error: "rows must be an array" });
    }

    // validate rows
    const cleaned = rows.map((r) => {
      const title = typeof r?.title === "string" ? r.title.trim() : "";
      const hours = Number(r?.hours);
      return { title, hours };
    });

    for (const r of cleaned) {
      if (!r.title) {
        return res
          .status(400)
          .json({ ok: false, error: "Each row needs a non-empty title" });
      }
      if (!Number.isFinite(r.hours) || r.hours < 0) {
        return res
          .status(400)
          .json({ ok: false, error: "Each row needs hours >= 0" });
      }
    }

    const report = await getOrCreateReport(expertId, year, month);

    const oldRows = report.rows || [];
    const oldByTitle = new Map(
      oldRows.map((or) => [String(or.title || "").trim(), or])
    );

    const mergedRows = cleaned.map((r) => {
      const prev = oldByTitle.get(r.title) || null;
      return {
        title: r.title,
        hours: r.hours,
        activity: prev?.activity || "",
        results: prev?.results || "",
      };
    });

    report.rows = mergedRows;

    // Important detail:
    // If PM edits after verified, we automatically un-verify (forces re-verify)
    if (report.pmVerified) {
      report.pmVerified = false;
      report.verifiedAt = null;
    }

    await report.save();

    return res.json({
      ok: true,
      report: {
        id: String(report._id),
        expertId: String(report.expertId),
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
    // duplicate index safety
    if (e?.code === 11000) {
      return res
        .status(409)
        .json({
          ok: false,
          error: "Report already exists (unique constraint)",
        });
    }
    next(e);
  }
}

// POST /admin/reports/:expertId/:year/:month/verify
async function verifyReport(req, res, next) {
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

    const report = await getOrCreateReport(expertId, year, month);

    if (!Array.isArray(report.rows) || report.rows.length === 0) {
      return res
        .status(400)
        .json({ ok: false, error: "Cannot verify: add at least 1 row first" });
    }
    if (report.rows.some((r) => !String(r.title || "").trim())) {
      return res
        .status(400)
        .json({ ok: false, error: "Cannot verify: all rows need titles" });
    }

    report.pmVerified = true;
    report.verifiedAt = new Date();
    await report.save();

    return res.json({
      ok: true,
      pmVerified: true,
      verifiedAt: report.verifiedAt,
    });
  } catch (e) {
    next(e);
  }
}

module.exports = { listMonthReports, upsertPmPart, verifyReport };
