<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useExpertAuthStore } from "@/stores/expertAuth";

const uid = ref("");
const err = ref("");
const loading = ref(false);

const auth = useExpertAuthStore();
const router = useRouter();

async function onLogin() {
  err.value = "";
  loading.value = true;
  try {
    await auth.login(uid.value.trim());
    await router.push("/dashboard");
  } catch (e) {
    err.value = e?.response?.data?.error || "Login failed";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-6 bg-gray-200">
    <div class="w-full max-w-sm rounded-2xl border p-6 shadow-2xl shadow-gray-600 bg-white">
      <h1 class="text-xl font-semibold">Expert Login</h1>
      <p class="text-sm text-gray-500 mt-1">Enter your username (uid).</p>

      <div class="mt-4 space-y-3">
        <input
          v-model="uid"
          class="w-full rounded-xl border px-3 py-2"
          placeholder="e.g. nume.prenume"
          autocomplete="off"
        />

        <button
          @click="onLogin"
          :disabled="loading || !uid.trim()"
          class="w-full rounded-xl bg-black text-white py-2 disabled:opacity-50 cursor-pointer"
        >
          {{ loading ? "Signing in..." : "Login" }}
        </button>

        <p v-if="err" class="text-sm text-red-600">{{ err }}</p>

        <div class="pt-2 text-sm">
          <a class="text-blue-600 underline" href="/admin/login">Admin login</a>
        </div>
      </div>
    </div>
  </div>
</template>
