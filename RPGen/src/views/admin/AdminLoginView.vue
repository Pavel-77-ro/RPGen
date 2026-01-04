<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAdminAuthStore } from "@/stores/adminAuth";

const pin = ref("");
const err = ref("");
const loading = ref(false);

const auth = useAdminAuthStore();
const router = useRouter();

async function onLogin() {
  err.value = "";
  loading.value = true;
  try {
    await auth.login(pin.value.trim());
    await router.push("/admin/reports");
  } catch (e) {
    err.value = e?.response?.data?.error || "Login failed";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-6">
    <div class="w-full max-w-sm rounded-2xl border p-6 shadow-sm">
      <h1 class="text-xl font-semibold">Admin Login</h1>
      <p class="text-sm text-gray-500 mt-1">4-digit PIN</p>

      <div class="mt-4 space-y-3">
        <input
          v-model="pin"
          class="w-full rounded-xl border px-3 py-2"
          inputmode="numeric"
        />

        <button
          @click="onLogin"
          :disabled="loading || pin.trim().length < 4"
          class="w-full rounded-xl bg-black text-white py-2 disabled:opacity-50"
        >
          {{ loading ? "Signing in..." : "Login" }}
        </button>

        <p v-if="err" class="text-sm text-red-600">{{ err }}</p>

        <div class="pt-2 text-sm">
          <a class="text-blue-600 underline" href="/login">Expert login</a>
        </div>
      </div>
    </div>
  </div>
</template>
