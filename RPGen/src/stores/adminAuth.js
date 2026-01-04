import { defineStore } from "pinia";
import api, { setAuthToken } from "@/services/api";

export const useAdminAuthStore = defineStore("adminAuth", {
  state: () => ({
    token: localStorage.getItem("adminToken") || "",
  }),
  getters: {
    isAuthed: (s) => !!s.token,
  },
  actions: {
    async login(pin) {
      const res = await api.post("/auth/admin", { pin });
      this.token = res.data.token;
      localStorage.setItem("adminToken", this.token);
    },
    logout() {
      this.token = "";
      localStorage.removeItem("adminToken");
    },
    applyToken() {
      // only call this when you are about to do admin API calls
      setAuthToken(this.token || null);
    },
  },
});
