const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

function getDefaultTemplatePath() {
  // Uses RPGenServer/templates/template.docx
  return path.join(process.cwd(), "templates", "template.docx");
}

function renderDocx(templatePath, data) {
  const content = fs.readFileSync(templatePath, "binary");
  const zip = new PizZip(content);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: "{{", end: "}}" },
  });

  try {
    // NEW API (avoids deprecated setData)
    doc.render(data);
  } catch (e) {
    console.error("DOCX render error:", e);
    throw new Error("DOCX render failed (check template placeholders/loop markers)");
  }

  return doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
}

module.exports = { getDefaultTemplatePath, renderDocx };
