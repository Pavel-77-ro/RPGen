function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatRoMonthYearUpper(year, month1to12) {
  const d = new Date(year, month1to12 - 1, 1);
  const monthName = new Intl.DateTimeFormat("ro-RO", { month: "long" }).format(d);
  return `${monthName.toUpperCase()} ${year}`; // e.g. "IUNIE 2026"
}

function lastDayOfMonth(year, month1to12) {
  let d = new Date(year, month1to12, 0);
  // JS: 0 = Sunday, 6 = Saturday
  while (d.getDay() === 0 || d.getDay() === 6) {
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  }
  return d;
}

function formatDateDDMMYYYY(date) {
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
}

module.exports = { formatRoMonthYearUpper, lastDayOfMonth, formatDateDDMMYYYY };
