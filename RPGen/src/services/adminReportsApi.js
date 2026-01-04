import api, { setAuthToken } from "@/services/api";
import { useAdminAuthStore } from "@/stores/adminAuth";

function withAdminAuth() {
  const admin = useAdminAuthStore();
  setAuthToken(admin.token || null);
}

export async function adminGetMonthReports(year, month) {
  withAdminAuth();
  const res = await api.get("/admin/reports", { params: { year, month } });
  return res.data; // { ok, year, month, items }
}

export function adminDownloadReportUrl(expertId, year, month) {
  // We'll use fetch/axios later; for browser download we can use a direct URL.
  return `${import.meta.env.VITE_API_BASE_URL}/admin/reports/${expertId}/${year}/${month}/download`;
}

export async function adminUpsertPmRows(expertId, year, month, rows) {
  withAdminAuth();
  const res = await api.put(`/admin/reports/${expertId}/${year}/${month}/pm`, { rows });
  return res.data.report;
}

export async function adminVerifyReport(expertId, year, month) {
  withAdminAuth();
  const res = await api.post(`/admin/reports/${expertId}/${year}/${month}/verify`);
  return res.data; // { ok, pmVerified, verifiedAt }
}

export async function adminDownloadDocx(expertId, year, month) {
  withAdminAuth();
  const res = await api.get(`/admin/reports/${expertId}/${year}/${month}/download`, {
    responseType: "blob",
  });

  // Try to read filename from Content-Disposition
  const cd = res.headers?.["content-disposition"] || "";
  const match = /filename="([^"]+)"/.exec(cd);
  const filename = match?.[1] || "report.docx";

  return { blob: res.data, filename };
}
