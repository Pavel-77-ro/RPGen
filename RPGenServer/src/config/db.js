const mongoose = require("mongoose");
const { env } = require("./env");

async function connectDb() {
  mongoose.set("strictQuery", true);
  mongoose.set("autoIndex", true);
  await mongoose.connect(env.mongodbUri);
  console.log("✅ MongoDB connected");

}

module.exports = { connectDb };
