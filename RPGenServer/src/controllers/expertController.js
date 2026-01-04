const Expert = require("../models/Expert");
const { isValidObjectId } = require("../services/idService");
const MonthlyReport = require("../models/MonthlyReport");

function cleanStr(v) {
  return typeof v === "string" ? v.trim() : "";
}

async function createExpert(req, res, next) {
  try {
    const uid = cleanStr(req.body?.uid);
    const name = cleanStr(req.body?.name);
    const position = cleanStr(req.body?.position);
    const contract = cleanStr(req.body?.contract);
    const responsibility = cleanStr(req.body?.responsibility);

    if (!uid || !name || !position || !contract || !responsibility) {
      return res.status(400).json({
        ok: false,
        error: "uid, name, position, contract, responsibility are required",
      });
    }

    // enforce uid format a bit (optional, but helpful)
    if (!/^[a-z0-9._-]{3,50}$/i.test(uid)) {
      return res.status(400).json({
        ok: false,
        error: "uid must be 3-50 chars: letters/numbers . _ -",
      });
    }

    const expert = await Expert.create({
      uid,
      name,
      position,
      contract,
      responsibility,
      // activeMonths defaults to [] in schema
    });

    return res.status(201).json({
      ok: true,
      expert: {
        id: String(expert._id),
        uid: expert.uid,
        name: expert.name,
        position: expert.position,
        contract: expert.contract,
        responsibility: expert.responsibility,
        activeMonths: expert.activeMonths || [],
      },
    });
  } catch (e) {
    // handle duplicate uid nicely
    if (e?.code === 11000) {
      return res.status(409).json({ ok: false, error: "uid already exists" });
    }
    next(e);
  }
}

async function listExperts(req, res, next) {
  try {
    const experts = await Expert.find({})
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return res.json({
      ok: true,
      experts: experts.map((x) => ({
        id: String(x._id),
        uid: x.uid,
        name: x.name,
        position: x.position,
        contract: x.contract,
        responsibility: x.responsibility,
        activeMonths: x.activeMonths || [], // ✅ NEW
        createdAt: x.createdAt,
      })),
    });
  } catch (e) {
    next(e);
  }
}

function isValidMonthKey(s) {
  // expects "YYYY-MM"
  if (typeof s !== "string") return false;
  const m = s.match(/^(\d{4})-(\d{2})$/);
  if (!m) return false;
  const mm = Number(m[2]);
  return mm >= 1 && mm <= 12;
}

// PUT /admin/experts/:id/months
// body: { months: ["2026-01","2026-03"] }
async function updateExpertMonths(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ ok: false, error: "Invalid expert id" });
    }

    const months = req.body?.months;
    if (!Array.isArray(months)) {
      return res.status(400).json({ ok: false, error: "months must be an array" });
    }

    const cleaned = months
      .map((x) => (typeof x === "string" ? x.trim() : ""))
      .filter(Boolean);

    for (const mk of cleaned) {
      if (!isValidMonthKey(mk)) {
        return res.status(400).json({ ok: false, error: `Invalid month key: ${mk}` });
      }
    }

    const uniqueSorted = Array.from(new Set(cleaned)).sort();

    const expert = await Expert.findByIdAndUpdate(
      id,
      { activeMonths: uniqueSorted },
      { new: true }
    )
      .lean()
      .exec();

    if (!expert) {
      return res.status(404).json({ ok: false, error: "Expert not found" });
    }

    return res.json({
      ok: true,
      expert: {
        id: String(expert._id),
        uid: expert.uid,
        name: expert.name,
        position: expert.position,
        contract: expert.contract,
        responsibility: expert.responsibility,
        activeMonths: expert.activeMonths || [],
        createdAt: expert.createdAt,
      },
    });
  } catch (e) {
    next(e);
  }
}


async function deleteExpert(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ ok: false, error: "Invalid expert id" });
    }

    const deleted = await Expert.findByIdAndDelete(id).exec();
    if (!deleted) {
      return res.status(404).json({ ok: false, error: "Expert not found" });
    }

    // Cascade delete
    await MonthlyReport.deleteMany({ expertId: id }).exec();

    return res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

module.exports = { createExpert, listExperts, deleteExpert, updateExpertMonths };
