const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

function signAdminToken() {
  return jwt.sign(
    { role: "admin" },
    env.jwtSecret,
    { expiresIn: "1d" } // in-house convenience
  );
}

function signExpertToken(expertId) {
  return jwt.sign(
    { role: "expert", expertId: String(expertId) },
    env.jwtSecret,
    { expiresIn: "8h" }
  );
}

function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

module.exports = { signAdminToken, signExpertToken, verifyToken };
