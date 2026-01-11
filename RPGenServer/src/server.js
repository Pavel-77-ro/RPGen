const { createApp } = require("./app");
const { connectDb } = require("./config/db");
const { env } = require("./config/env");

async function start() {
  await connectDb();

  const app = createApp();
  app.listen(env.port, "0.0.0.0", () => {
  console.log(`🚀 API listening on port ${env.port}`);
});
}

start().catch((e) => {
  console.error("❌ Failed to start:", e);
  process.exit(1);
});
