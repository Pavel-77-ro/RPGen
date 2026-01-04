const { createApp } = require("./app");
const { connectDb } = require("./config/db");
const { env } = require("./config/env");

async function start() {
  await connectDb();

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`🚀 API running on http://localhost:${env.port}`);
  });
}

start().catch((e) => {
  console.error("❌ Failed to start:", e);
  process.exit(1);
});
