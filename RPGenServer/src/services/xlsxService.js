const path = require("path");
const ExcelJS = require("exceljs");

function getAnexa13TemplatePath() {
  return path.join(
    process.cwd(),
    "templates",
    "anex.xlsx"
  );
}

function copyCellStyle(target, source) {
  if (!target || !source) return;
  target.style = { ...source.style };
}

async function renderAnexa13Workbook({ year, month, rows }) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(getAnexa13TemplatePath());

  const ws = workbook.getWorksheet(1);
  if (!ws) throw new Error("Anexa 13 template missing sheet1");

  const startRow = 17;
  const templateRow = ws.getRow(startRow);
  const templateRowHeight = templateRow.height;
  const templateCellStyles = [];
  for (let c = 1; c <= 8; c++) {
    const cell = templateRow.getCell(c);
    templateCellStyles[c] = {
      style: { ...cell.style },
      font: cell.font ? { ...cell.font } : null,
      alignment: cell.alignment ? { ...cell.alignment } : null,
      border: cell.border ? { ...cell.border } : null,
      fill: cell.fill ? { ...cell.fill } : null,
      numFmt: cell.numFmt || null,
    };
  }

  const defaultCategory = "Expert national, sub 5 ani";
  const defaultPartner = "LICEUL TEHNOLOGIC BRATIANU";

  const headerSource = ws.getCell("F15");
  const headerTarget = ws.getCell("H15");
  headerTarget.value = "Activitate/Subactivitate + ore";
  copyCellStyle(headerTarget, headerSource);

  const headerSource2 = ws.getCell("F16");
  const headerTarget2 = ws.getCell("H16");
  copyCellStyle(headerTarget2, headerSource2);

  ws.getColumn("H").width = 24;
  // Remove any existing filters from the template; they can hide rows.
  ws.autoFilter = null;

  const fallbackMonthDate =
    year && month ? new Date(year, month - 1, 1) : null;

  // Replace the template data block with only the needed rows
  if (ws.rowCount >= startRow) {
    ws.spliceRows(startRow, ws.rowCount - startRow + 1);
  }

  const values = rows.map((r, i) => [
    i + 1,
    r.category || defaultCategory || "MISS",
    r.position || "MISS",
    r.name || "MISS",
    r.partnerName || defaultPartner || "MISS",
    r.activities || "MISS",
    r.monthDate || fallbackMonthDate || "",
    r.activitiesWithHours || "MISS",
  ]);

  if (values.length > 0) {
    ws.spliceRows(startRow, 0, ...values);
  }

  const lastDataRow = values.length > 0 ? startRow + values.length - 1 : startRow - 1;
  if (lastDataRow >= 0 && ws.rowCount > lastDataRow) {
    ws.spliceRows(lastDataRow + 1, ws.rowCount - lastDataRow);
  }

  for (let i = 0; i < values.length; i++) {
    const rowIndex = startRow + i;
    const row = ws.getRow(rowIndex);
    row.hidden = false;

    const hCell = row.getCell("H");
    const hText = String(hCell.value || "");
    const lineCount = hText.split(/\r?\n/).length || 1;
    const baseHeight = Math.max(templateRowHeight || 18, 24);
    row.height = Math.max(baseHeight, 18 * lineCount);

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const tpl = templateCellStyles[colNumber];
      if (tpl?.style) cell.style = { ...tpl.style };
      if (tpl?.font) cell.font = { ...tpl.font };
      if (tpl?.alignment) cell.alignment = { ...tpl.alignment };
      if (tpl?.border) cell.border = { ...tpl.border };
      if (tpl?.fill) cell.fill = { ...tpl.fill };
      if (tpl?.numFmt) cell.numFmt = tpl.numFmt;
    });

    // Force visible borders for data grid (A-H)
    for (let c = 1; c <= 8; c++) {
      const cell = row.getCell(c);
      cell.border = {
        top: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
      };
    }

    // Ensure column H is readable: black text, wrapped, a bit larger
    hCell.alignment = { ...(hCell.alignment || {}), wrapText: true, vertical: "top" };
    const baseFont = hCell.font || templateCellStyles[8]?.font || {};
    hCell.font = {
      ...baseFont,
      color: { argb: "FF000000" },
      size: baseFont.size ? baseFont.size + 1 : 11,
    };
  }

  return workbook.xlsx.writeBuffer();
}

module.exports = { getAnexa13TemplatePath, renderAnexa13Workbook };
