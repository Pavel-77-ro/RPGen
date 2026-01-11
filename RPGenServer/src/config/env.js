const dotenv = require("dotenv");
dotenv.config();

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const env = {
  port: Number(process.env.PORT) || 5000,
  mongodbUri: requireEnv("MONGODB_URI"),
  jwtSecret: requireEnv("JWT_SECRET"),
  adminPin: requireEnv("ADMIN_PIN"),
  corsOrigins: (process.env.CORS_ORIGINS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean),
};

module.exports = { env };
