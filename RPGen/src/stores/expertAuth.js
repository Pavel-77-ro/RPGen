// src/stores/expertAuth.js
import { defineStore } from "pinia";
import api, { setAuthToken } from "@/services/api";

// --- helpers (add these at top of the file) ---
function decodeJwtPayload(token) {
  try {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isJwtExpired(token) {
  const p = decodeJwtPayload(token);
  if (!p?.exp) return false; // if token has no exp, can't check here
  const nowSec = Math.floor(Date.now() / 1000);
  return nowSec >= p.exp;
}

export const useExpertAuthStore = defineStore("expertAuth", {
  state: () => ({
    token: localStorage.getItem("expertToken") || "",
    expert: JSON.parse(localStorage.getItem("expertProfile") || "null"),
  }),

  getters: {
    // IMPORTANT: expired token => not authed
    isAuthed: (s) => !!s.token && !isJwtExpired(s.token),
  },

  actions: {
    async login(uid) {
      const res = await api.post("/auth/expert", { uid });
      this.token = res.data.token;
      this.expert = res.data.expert;

      localStorage.setItem("expertToken", this.token);
      localStorage.setItem("expertProfile", JSON.stringify(this.expert));

      this.applyToken(); // set axios header immediately
    },

    logout() {
      this.token = "";
      this.expert = null;
      localStorage.removeItem("expertToken");
      localStorage.removeItem("expertProfile");
      setAuthToken(null); // clear axios header
    },

    applyToken() {
      // If expired, clean up so router won't get stuck
      if (this.token && isJwtExpired(this.token)) {
        this.logout();
        return;
      }
      setAuthToken(this.token || null);
    },
  },
});
