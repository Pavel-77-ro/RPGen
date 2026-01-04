let OpenAI = require("openai");
// Works whether the package exports default or not
OpenAI = OpenAI.default || OpenAI;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

module.exports = client;
