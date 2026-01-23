const openai = require("../services/openaiClient");
const MonthlyReport = require("../models/MonthlyReport");
const Expert = require("../models/Expert");

function parseIntStrict(v) {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function buildPrompt({ monthLabel, expert, rows }) {
  // Keep it deterministic and short, no bullets, Romanian, 1–2 paragraphs.
  return `
Ești un asistent care redactează un paragraf narativ pentru un raport lunar de activitate (în limba română).
Generează o descriere ({{description}}) pentru luna: ${monthLabel}.

Reguli:
- 6–10 propoziții, 1–2 paragrafe.
- Foloseste persoana 1, raportul este scris de expertul in cauza (pentru el).
- Chiar daca nu pare destula informatie, incearca sa il faci cat mai bine.
- Stil formal, clar, formulare cursiva, fără liste cu bullet points.
- Nu inventa activități; folosește doar informațiile primite.
- Dacă unele câmpuri sunt goale, omite acea parte.
- Nu include ghilimele, titluri sau semnături. Doar textul descrierii.
- minim 120 de cuvinte
- Numarul de ore nu va fi mentionat si nici numele rezultatelor

Context expert:
Nume: ${expert.name}
Funcție: ${expert.position}

Intrare (activități + rezultate pe rânduri):
${rows
  .map(
    (r, i) =>
      `${i + 1}) Titlu: ${r.title} | Ore: ${r.hours}\nActivitate: ${
        r.activity
      }\nRezultate: ${r.results}\n`
  )
  .join("\n")}
`.trim();
}

function extractResponseText(resp) {
  if (!resp) return "";

  // 1) Best case: SDK helper exists
  if (typeof resp.output_text === "string" && resp.output_text.trim()) {
    return resp.output_text.trim();
  }

  // 2) Fallback: walk the output array safely
  const parts = [];
  const out = Array.isArray(resp.output) ? resp.output : [];

  for (const item of out) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const c of content) {
      // Common shape: { type: "output_text", text: "..." }
      if (typeof c?.text === "string" && c.text.trim()) parts.push(c.text.trim());
      // Sometimes content could be { type: "...", ... } with different fields; ignore safely
    }
  }

  return parts.join("\n").trim();
}


// POST /reports/:year/:month/ai-description
async function generateMonthlyDescription(req, res, next) {
  try {
    const expertId = req.user.expertId;

    const year = parseIntStrict(req.params.year);
    const month = parseIntStrict(req.params.month);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ ok: false, error: "Invalid year/month" });
    }

    const expert = await Expert.findById(expertId).lean().exec();
    if (!expert)
      return res.status(404).json({ ok: false, error: "Expert not found" });

    const report = await MonthlyReport.findOne({ expertId, year, month })
      .lean()
      .exec();
    if (!report)
      return res
        .status(404)
        .json({ ok: false, error: "Report not found for this month" });
    if (!report.pmVerified)
      return res
        .status(403)
        .json({ ok: false, error: "Report not verified by PM" });

    const rows = Array.isArray(report.rows) ? report.rows : [];
    if (rows.length === 0) {
      return res.status(400).json({ ok: false, error: "No rows found" });
    }

    // month label for prompt
    const d = new Date(year, month - 1, 1);
    const monthLabel = d.toLocaleString("ro-RO", {
      month: "long",
      year: "numeric",
    });

    const input = buildPrompt({ monthLabel, expert, rows });
    console.log(input);

    const model = process.env.OPENAI_MODEL || "gpt-5.2";
    console.log("Using model:", model);

    const response = await openai.responses.create({
      model,
      instructions:
        "Returnează doar textul final al descrierii, fără markdown.",
      input,
      max_output_tokens: 3400,
      // optional: stable id (hash if you want), but simple is fine for now
      // safety_identifier: expert.uid,
    });    const suggestion = extractResponseText(response);

    if (!suggestion) {
      return res.status(500).json({ ok: false, error: "Empty AI response" });
    }

    return res.json({ ok: true, suggestion });
  } catch (e) {

    // Full details only on server
  console.error("AI generateMonthlyDescription failed:", {
    status: e?.status,
    code: e?.code,
    message: e?.message,
    requestID: e?.requestID,
    error: e?.error,
  });

  // Never leak provider details to client
  return res.status(500).json({
    ok: false,
    error: "Generarea AI a eșuat! Vă rog încărcați manual descrierea!",
  });
  }
}

module.exports = { generateMonthlyDescription };
