const { verifyToken } = require("../services/tokenService");

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

function requireAdmin(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ ok: false, error: "Missing token" });

    const payload = verifyToken(token);
    if (payload.role !== "admin") {
      return res.status(403).json({ ok: false, error: "Admin only" });
    }

    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
}

function requireExpert(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ ok: false, error: "Missing token" });

    const payload = verifyToken(token);
    if (payload.role !== "expert" || !payload.expertId) {
      return res.status(403).json({ ok: false, error: "Expert only" });
    }

    req.user = payload; // { role, expertId }
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
}

module.exports = { requireAdmin, requireExpert };
