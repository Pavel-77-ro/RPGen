import api, { setAuthToken } from "@/services/api";
import { useExpertAuthStore } from "@/stores/expertAuth";

function withExpertAuth() {
  const expert = useExpertAuthStore();
  setAuthToken(expert.token || null);
}

export async function expertGetCurrentReport() {
  withExpertAuth();
  const res = await api.get("/reports/current");
  return res.data; // { ok, year, month, report }
}

export async function expertUpdateReport(year, month, payload) {
  withExpertAuth();
  const res = await api.put(`/reports/${year}/${month}`, payload);
  return res.data.report;
}

export async function expertDownloadDocx(year, month) {
  withExpertAuth();
  const res = await api.get(`/reports/${year}/${month}/download`, { responseType: "blob" });

  const cd = res.headers?.["content-disposition"] || "";
  const match = /filename="([^"]+)"/.exec(cd);
  const filename = match?.[1] || "report.docx";

  return { blob: res.data, filename };
}

export async function expertListMyReports() {
  withExpertAuth();
  const res = await api.get("/reports/mine");
  return res.data.items; // [{year, month, pmVerified, updatedAt}]
}

export async function expertGetReport(year, month) {
  withExpertAuth();
  const res = await api.get(`/reports/${year}/${month}`);
  return res.data; // { ok, year, month, report }
}

export async function expertGenerateDescription(year, month) {
  withExpertAuth();
  const res = await api.post(`/reports/${year}/${month}/ai-description`);
  return res.data; // { ok, suggestion }
}
