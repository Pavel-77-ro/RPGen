import { defineStore } from "pinia";
import api, { setAuthToken } from "@/services/api";

export const useExpertAuthStore = defineStore("expertAuth", {
  state: () => ({
    token: localStorage.getItem("expertToken") || "",
    expert: JSON.parse(localStorage.getItem("expertProfile") || "null"),
  }),
  getters: {
    isAuthed: (s) => !!s.token,
  },
  actions: {
    async login(uid) {
      const res = await api.post("/auth/expert", { uid });
      this.token = res.data.token;
      this.expert = res.data.expert;

      localStorage.setItem("expertToken", this.token);
      localStorage.setItem("expertProfile", JSON.stringify(this.expert));
    },
    logout() {
      this.token = "";
      this.expert = null;
      localStorage.removeItem("expertToken");
      localStorage.removeItem("expertProfile");
    },
    applyToken() {
      // only call this when you are about to do expert API calls
      setAuthToken(this.token || null);
    },
  },
});
