const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { env } = require("./config/env");
const authRoutes = require("./routes/authRoutes");
const expertRoutes = require("./routes/expertRoutes");
const adminReportRoutes = require("./routes/adminReportRoutes");
const expertReportRoutes = require("./routes/expertReportRoutes");


function createApp() {
  const app = express();

  // logs
  app.use(morgan("dev"));

  // json
  app.use(express.json({ limit: "1mb" }));

  // CORS
  app.use(
    cors({
      origin: (origin, cb) => {
        // allow non-browser clients (curl/postman) with no origin
        if (!origin) return cb(null, true);

        // allow known origins
        if (env.corsOrigins.includes(origin)) return cb(null, true);

        return cb(new Error(`CORS blocked for origin: ${origin}`));
      },
      credentials: true,
      exposedHeaders: ["Content-Disposition"]
    })
  );

  // health
  app.get("/health", (req, res) => {
    res.json({ ok: true, service: "RGenServer" });
  });

  // (routes will be mounted here later)
  app.use("/auth", authRoutes);
  app.use("/experts", expertRoutes);
  app.use("/admin/reports", adminReportRoutes);
  app.use("/", expertReportRoutes);


  // error handler (keep last)
  app.use((err, req, res, next) => {
    console.error("❌ Error:", err.message);
    const status = err.statusCode || 500;
    res.status(status).json({ ok: false, error: err.message });
  });

  return app;
}

module.exports = { createApp };
