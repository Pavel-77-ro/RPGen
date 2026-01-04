const { env } = require("../config/env");
const Expert = require("../models/Expert");
const { signAdminToken, signExpertToken } = require("../services/tokenService");

async function adminLogin(req, res, next) {
  try {
    const { pin } = req.body || {};
    if (!pin || typeof pin !== "string") {
      return res.status(400).json({ ok: false, error: "pin is required (string)" });
    }

    if (pin !== env.adminPin) {
      return res.status(401).json({ ok: false, error: "Invalid PIN" });
    }

    const token = signAdminToken();
    return res.json({ ok: true, token });
  } catch (e) {
    next(e);
  }
}

async function expertLogin(req, res, next) {
  try {
    const { uid } = req.body || {};
    if (!uid || typeof uid !== "string") {
      return res.status(400).json({ ok: false, error: "uid is required (string)" });
    }

    const expert = await Expert.findOne({ uid: uid.trim() }).exec();
    if (!expert) {
      return res.status(404).json({ ok: false, error: "Expert not found" });
    }

    const token = signExpertToken(expert._id);
    return res.json({
      ok: true,
      token,
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

module.exports = { adminLogin, expertLogin };
