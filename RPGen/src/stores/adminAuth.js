// src/stores/adminAuth.js
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

export const useAdminAuthStore = defineStore("adminAuth", {
  state: () => ({
    token: localStorage.getItem("adminToken") || "",
  }),

  getters: {
    // IMPORTANT: expired token => not authed
    isAuthed: (s) => !!s.token && !isJwtExpired(s.token),
  },

  actions: {
    async login(pin) {
      const res = await api.post("/auth/admin", { pin });
      this.token = res.data.token;
      localStorage.setItem("adminToken", this.token);
      this.applyToken(); // ensure axios header is set
    },

    logout() {
      this.token = "";
      localStorage.removeItem("adminToken");
      setAuthToken(null); // clear axios header
    },

    applyToken() {
      // If expired, instantly clean it up so router won't get stuck
      if (this.token && isJwtExpired(this.token)) {
        this.logout();
        return;
      }
      setAuthToken(this.token || null);
    },
  },
});
