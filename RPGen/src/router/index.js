import { createRouter, createWebHistory } from "vue-router";
import { useAdminAuthStore } from "@/stores/adminAuth";
import { useExpertAuthStore } from "@/stores/expertAuth";

import ExpertLoginView from "@/views/expert/ExpertLoginView.vue";
import ExpertDashboardView from "@/views/expert/ExpertDashboardView.vue";

import AdminLoginView from "@/views/admin/AdminLoginView.vue";
import AdminExpertsView from "@/views/admin/AdminExpertsView.vue";
import AdminReportsView from "@/views/admin/AdminReportsView.vue";

const routes = [
  { path: "/", redirect: "/login" },

  // Expert
  { path: "/login", name: "expert-login", component: ExpertLoginView, meta: { guestExpert: true } },
  { path: "/dashboard", name: "expert-dashboard", component: ExpertDashboardView, meta: { requiresExpert: true } },

  // Admin
  { path: "/admin/login", name: "admin-login", component: AdminLoginView, meta: { guestAdmin: true } },
  { path: "/admin/experts", name: "admin-experts", component: AdminExpertsView, meta: { requiresAdmin: true } },
  { path: "/admin/reports", name: "admin-reports", component: AdminReportsView, meta: { requiresAdmin: true } },

  { path: "/:pathMatch(.*)*", redirect: "/login" },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const admin = useAdminAuthStore();
  const expert = useExpertAuthStore();

  admin.applyToken();
expert.applyToken();


  // Expert guards
  if (to.meta.requiresExpert && !expert.isAuthed) return { name: "expert-login" };
  if (to.meta.guestExpert && expert.isAuthed) return { name: "expert-dashboard" };

  // Admin guards
  if (to.meta.requiresAdmin && !admin.isAuthed) return { name: "admin-login" };
  if (to.meta.guestAdmin && admin.isAuthed) return { name: "admin-experts" };

  return true;
});

export default router;
