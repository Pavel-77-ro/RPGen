import api, { setAuthToken } from "@/services/api";
import { useAdminAuthStore } from "@/stores/adminAuth";

function withAdminAuth() {
  const admin = useAdminAuthStore();
  setAuthToken(admin.token || null);
}

export async function adminListExperts() {
  withAdminAuth();
  const res = await api.get("/experts");
  return res.data.experts;
}

export async function adminCreateExpert(payload) {
  withAdminAuth();
  const res = await api.post("/experts", payload);
  return res.data.expert;
}

export async function adminDeleteExpert(id) {
  withAdminAuth();
  const res = await api.delete(`/experts/${id}`);
  return res.data;
}

export async function adminUpdateExpertMonths(id, months) {
  withAdminAuth();
  const res = await api.put(`/experts/${id}/months`, { months });
  return res.data.expert;
}

export async function adminDownloadAnexa13Range(fromYear, fromMonth, toYear, toMonth) {
  withAdminAuth();
  const res = await api.get(`/admin/reports/anexa13/range/download`, {
    params: { fromYear, fromMonth, toYear, toMonth },
    responseType: "blob",
  });

  const cd = res.headers?.["content-disposition"] || "";
  const match = /filename="([^"]+)"/.exec(cd);
  const filename = match?.[1] || "anexa_13_range.xlsx";

  return { blob: res.data, filename };
}

