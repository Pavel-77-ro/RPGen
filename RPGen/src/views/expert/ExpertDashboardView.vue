<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useExpertAuthStore } from "@/stores/expertAuth";
import {
  expertListMyReports,
  expertGetReport,
  expertUpdateReport,
  expertDownloadDocx,
  expertGenerateDescription,
} from "@/services/expertApi";
import { useRouter } from "vue-router";

const auth = useExpertAuthStore();
const router = useRouter();

const generating = ref(false);
const loading = ref(false);
const saving = ref(false);
const err = ref("");
const msg = ref("");

const available = ref([]); // [{year, month, pmVerified, updatedAt}]
const selectedKey = ref(""); // "YYYY-M"

// Track whether the user has saved the currently selected month (for step 5)
const lastSavedKey = ref("");

const state = reactive({
  year: null,
  month: null,
  pmVerified: false,
  rows: [], // [{ title, hours, activity, results }]
  description: "",
});

const monthLabel = computed(() => {
  if (!state.year || !state.month) return "";
  const d = new Date(state.year, state.month - 1, 1);
  const name = new Intl.DateTimeFormat("en-US", { month: "long" }).format(d);
  return `${name} ${state.year}`;
});

function toKey(y, m) {
  return `${y}-${m}`;
}

function fromKey(k) {
  const [y, m] = String(k).split("-");
  return { year: Number(y), month: Number(m) };
}

function formatOptionLabel(it) {
  const d = new Date(it.year, it.month - 1, 1);
  const label = d.toLocaleString("en-US", { month: "long", year: "numeric" });
  return it.pmVerified ? label : `${label} — (not verified)`;
}

async function generateWithAI() {
  err.value = "";
  msg.value = "";
  if (!state.year || !state.month) return;

  if (!state.pmVerified) {
    err.value = "Not available until PM verifies.";
    return;
  }

  generating.value = true;
  try {
    const data = await expertGenerateDescription(state.year, state.month);
    state.description = data.suggestion || state.description;
    msg.value = "AI draft generated. Review and edit if needed.";
  } catch (e) {
    err.value = e?.response?.data?.error || "AI generation failed";
  } finally {
    generating.value = false;
  }
}

async function loadAvailable() {
  const items = await expertListMyReports();
  available.value = items || [];

  if (!available.value.length) {
    selectedKey.value = "";
    return;
  }

  // Prefer current month if exists; otherwise newest (API is sorted desc)
  const now = new Date();
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;

  const cur = available.value.find((x) => x.year === cy && x.month === cm);
  const pick = cur || available.value[0];

  selectedKey.value = toKey(pick.year, pick.month);
}

async function loadSelectedReport() {
  err.value = "";
  msg.value = "";

  if (!selectedKey.value) {
    state.year = null;
    state.month = null;
    state.pmVerified = false;
    state.rows = [];
    state.description = "";
    return;
  }

  // If user changes month, step 5 should reset unless they save again
  // (we keep lastSavedKey as-is; step 5 checks equality)
  loading.value = true;

  try {
    const { year, month } = fromKey(selectedKey.value);

    const data = await expertGetReport(year, month);
    state.year = data.year;
    state.month = data.month;

    if (!data.report) {
      state.pmVerified = false;
      state.rows = [];
      state.description = "";
      return;
    }

    state.pmVerified = !!data.report.pmVerified;
    state.rows = (data.report.rows || []).map((r) => ({
      title: r.title || "",
      hours: r.hours ?? 0,
      activity: r.activity || "",
      results: r.results || "",
    }));
    state.description = data.report.description || "";
  } catch (e) {
    err.value = e?.response?.data?.error || "Failed to load report";
  } finally {
    loading.value = false;
  }
}

async function loadAll() {
  err.value = "";
  msg.value = "";
  loading.value = true;

  try {
    await loadAvailable();
  } catch (e) {
    err.value = e?.response?.data?.error || "Failed to load months";
  } finally {
    loading.value = false;
  }

  await loadSelectedReport();
}

const MIN_CHARS = 20;

const canGenerateAI = computed(() => {
  if (!state.pmVerified) return false;
  if (generating.value) return false;
  if (!state.rows?.length) return false;

  return state.rows.every((r) => {
    const a = (r.activity || "").trim();
    const rs = (r.results || "").trim();
    return a.length >= MIN_CHARS && rs.length >= MIN_CHARS;
  });
});

const aiDisableReason = computed(() => {
  if (!state.pmVerified) return "Not available until PM verifies.";
  if (generating.value) return "Generating...";
  if (!state.rows?.length) return "No rows to summarize.";
  const bad = state.rows.find(
    (r) =>
      (r.activity || "").trim().length < MIN_CHARS ||
      (r.results || "").trim().length < MIN_CHARS
  );
  if (bad) return `Fill Activity + Results with at least ${MIN_CHARS} characters for each row.`;
  return "";
});

/* -----------------------------
   Stepper progress (sequential)
   Requested order:
   1) Select month
   2) Wait for PM verify (only blue when verified)
   3) Complete activities+results
   4) Write story / AI
   5) Save + download
------------------------------ */
const hasSelectedMonth = computed(() => {
  return !!selectedKey.value && !!state.year && !!state.month;
});

const step1Selected = computed(() => hasSelectedMonth.value);

const step2Verified = computed(() => {
  return step1Selected.value && !!state.pmVerified;
});

const step3ActivitiesFilled = computed(() => {
  if (!step2Verified.value) return false;
  if (!state.rows?.length) return false;
  return state.rows.every((r) => {
    const a = (r.activity || "").trim();
    const rs = (r.results || "").trim();
    return a.length > 0 && rs.length > 0;
  });
});

const step4StoryReady = computed(() => {
  if (!step3ActivitiesFilled.value) return false;
  return (state.description || "").trim().length > 0;
});

const step5Saved = computed(() => {
  if (!step4StoryReady.value) return false;
  return lastSavedKey.value === selectedKey.value && !!selectedKey.value;
});

// Buttons: user asked to avoid Save being active before earlier steps
const canSaveButton = computed(() => step4StoryReady.value && !saving.value && !loading.value);
const canDownloadButton = computed(() => step4StoryReady.value && !saving.value && !loading.value);

async function save() {
  err.value = "";
  msg.value = "";
  if (!state.year || !state.month) return;

  if (!step4StoryReady.value) {
    err.value = "Please complete all steps (rows + description) before saving.";
    return;
  }

  saving.value = true;
  try {
    const payload = {
      rows: state.rows.map((r) => ({
        activity: String(r.activity || ""),
        results: String(r.results || ""),
      })),
      description: String(state.description || ""),
    };

    await expertUpdateReport(state.year, state.month, payload);

    // Mark saved for this selected month (step 5 becomes blue)
    lastSavedKey.value = selectedKey.value;

    // refresh month list metadata (updatedAt may change)
    await loadAvailable();

    msg.value = "Saved.";
  } catch (e) {
    err.value = e?.response?.data?.error || "Save failed";
  } finally {
    saving.value = false;
  }
}

async function download() {
  err.value = "";
  msg.value = "";
  if (!state.year || !state.month) return;

  if (!canDownloadButton.value) {
    err.value = "Complete the report (rows + description) before downloading.";
    return;
  }

  try {
    const { blob, filename } = await expertDownloadDocx(state.year, state.month);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (e) {
    err.value = e?.response?.data?.error || "Download failed";
  }
}

function logOut() {
  auth.logout();
  router.push({ name: "expert-login" });
}

onMounted(loadAll);
</script>

<template>
  <div class="p-6 mx-auto max-w-330">
    <!-- TOP (centered, same as before): header + month selector + feedback messages -->
    <div class="max-w-5xl mx-auto">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">Expert Dashboard</h1>
          <div class="text-sm text-gray-600 mt-1">
            <span class="text-gray-500">User: </span>
            <span class="font-medium">{{ auth.expert?.name || auth.expert?.uid }}</span>
          </div>
        </div>

        <div class="flex gap-3">
          <button
            class="rounded-xl border px-3 py-2 flex items-center cursor-pointer"
            @click="loadAll"
            :disabled="loading || saving"
          >
            Refresh <i class="pi pi-refresh font-medium pl-2"></i>
          </button>

          <button
            class="rounded-xl border px-3 py-2 flex items-center cursor-pointer bg-red-500 text-white hover:bg-red-300 hover:text-black"
            @click="logOut"
          >
            Logout <i class="pi pi-sign-out pl-2"></i>
          </button>
        </div>
      </div>

      <!-- Month selector -->
      <div class="mt-4 rounded-2xl border p-5 flex flex-col md:flex-row md:items-end gap-3">
        <div class="md:mr-auto">
          <div class="text-sm text-gray-500">Select month</div>

          <select
            class="mt-1 w-full md:w-80 rounded-xl border px-3 py-2 cursor-pointer"
            v-model="selectedKey"
            @change="loadSelectedReport"
            :disabled="loading || saving"
          >
            <option value="" disabled>Select a month</option>
            <option v-for="it in available" :key="it.year + '-' + it.month" :value="it.year + '-' + it.month">
              {{ formatOptionLabel(it) }}
            </option>
          </select>

          <div v-if="available.length === 0" class="mt-2 text-xs text-gray-500">
            Nu ai acces la niciun raport momentan!
          </div>
        </div>

        <div class="text-sm">
          <span
            class="inline-flex items-center rounded-full px-2 py-1 text-xs border"
            :class="state.pmVerified ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-700'"
          >
            {{ state.pmVerified ? "Valabil" : "Asteptati accesul" }}
          </span>
        </div>

        <div class="text-sm">
          <div class="text-gray-500">Selected report</div>
          <div class="font-semibold">{{ monthLabel || "—" }}</div>
        </div>

        
      </div>

      <div v-if="err" class="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {{ err }}
      </div>
      <div v-if="msg" class="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
        {{ msg }}
      </div>

      <div v-if="loading" class="mt-6 text-sm text-gray-600">Loading...</div>
    </div>

    <!-- BOTTOM: split into main content + stepper (only from rows downward) -->
    <div v-if="!loading" class="mt-6">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- LEFT (centered column): everything from "Monthly rows" down -->
        <div class="lg:col-span-8 xl:col-span-8">
          <div class="max-w-5xl mx-auto space-y-6">
            <div v-if="!selectedKey" class="rounded-2xl border px-5  bg-gray-50 text-sm text-gray-700">
              Selectati o luna pentru a completa raportul.
            </div>

            <div v-else-if="!state.pmVerified" class="rounded-2xl border p-5 bg-gray-50 text-sm text-gray-700">
              Managerul nu a completat aceasta luna momentan. Asteptati pana vi se permite editarea!
            </div>

            <div v-else-if="state.rows.length === 0" class="rounded-2xl border p-5 bg-gray-50 text-sm text-gray-700">
              Managerul a permis accesul dar nu aveti nici o activitate delegata. Raportati greseala!
            </div>

            <div v-else class="rounded-2xl border overflow-hidden">
              <div class="px-5 py-4 border-b flex items-center justify-between">
                <h2 class="font-semibold">Monthly activities</h2>
                <div class="text-xs text-gray-500">Introduceti activitatile+rezultatele</div>
              </div>

              <div class="divide-y">
                <div v-for="(r, idx) in state.rows" :key="idx" class="p-5">
                  <div class="flex items-center justify-between gap-3">
                    <div class="font-medium">
                      {{ r.title }}
                      <span class="text-sm text-gray-500">— {{ r.hours }}h</span>
                    </div>
                  </div>

                  <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label class="text-sm text-gray-600">Activity</label>
                      <textarea
                        v-model="r.activity"
                        class="w-full rounded-xl border px-3 py-2 min-h-40"
                        :disabled="!state.pmVerified"
                      />
                    </div>

                    <div>
                      <label class="text-sm text-gray-600">Results</label>
                      <textarea
                        v-model="r.results"
                        class="w-full rounded-xl border px-3 py-2 min-h-40"
                        :disabled="!state.pmVerified"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="selectedKey" class="rounded-2xl border p-5">
              <div class="flex justify-between">
                <h2 class="font-semibold">Monthly description</h2>
                <button
                  class="rounded-xl border px-3 py-2 text-sm disabled:opacity-50 bg-black text-white hover:scale-105 cursor-pointer transition-transform duration-200"
                  :disabled="!canGenerateAI"
                  :title="aiDisableReason"
                  @click="generateWithAI"
                >
                  {{ generating ? "Generating..." : "Generate with AI" }} <i class="pi pi-sparkles"></i>
                </button>
              </div>

              <p class="text-sm text-gray-500 mt-1">
                Acesta reprezinta descrierea narativa a activitatilor
              </p>

              <textarea
                v-model="state.description"
                class="mt-3 w-full rounded-xl border px-3 py-2 min-h-35"
                :disabled="!state.pmVerified"
              />

              <div class="mt-4 flex gap-2 flex-wrap">
                <button
                  class="cursor-pointer rounded-xl bg-green-200 hover:bg-green-300 text-black border px-4 py-2 disabled:opacity-50 transition-colors duration-200"
                  :disabled="!canSaveButton"
                  @click="save"
                  :title="!canSaveButton ? 'Complete rows + description before saving.' : ''"
                >
                  {{ saving ? "Saving..." : "Save" }}
                </button>

                <button
                  class="rounded-xl border px-4 py-2 cursor-pointer hover:bg-blue-200 disabled:opacity-50 transition-colors duration-200"
                  :disabled="!canDownloadButton"
                  @click="download"
                  :title="!canDownloadButton ? 'Complete rows + description before downloading.' : ''"
                >
                  Download <i class="pl-2 pi pi-download"></i>
                </button>
              </div>

              <div v-if="!state.pmVerified" class="mt-3 text-xs text-gray-500">
                Edit/Save/Download are disabled until the PM verifies this month.
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT: stepper only aligned with the "Monthly rows" section -->
        <aside class="lg:col-span-4 xl:col-span-4 lg:pl-4">
          <div class="mt-10 lg:mt-0 sticky top-24 lg:ml-3">
            <div class="rounded-2xl bg-white py-10">
              <div class="font-semibold">Cum se completeaza raportul</div>
              <div class="text-sm text-gray-500 mt-1">Pasii de mai jos sunt aici pentru a va ajuta!</div>

              <ol class="mt-5 space-y-4">
                <!-- Step 1: Select month -->
                <li class="flex gap-3">
                  <div class="flex flex-col items-center">
                    <div
                      class="h-5 w-5 rounded-full border flex items-center justify-center transform transition-all duration-300 ease-out"
                      :class="step1Selected ? 'bg-blue-600 border-blue-600 scale-105 shadow-sm' : 'bg-gray-200 border-gray-300 scale-100'"
                    >
                      <i v-if="step1Selected" class="pi pi-check text-white text-[10px] leading-none"></i>
                    </div>
                    <div class="w-px flex-1 mt-1 transition-colors duration-300" :class="step1Selected ? 'bg-blue-600' : 'bg-gray-300'"></div>
                  </div>

                  <div>
                    <div class="text-sm font-medium transition-colors duration-300" :class="step1Selected ? 'text-blue-700' : 'text-gray-700'">
                      Selectati luna dorita
                    </div>
                    <div class="text-xs text-gray-500 mt-1">
                      Lunile valabile devin accesibilie dupa ce managerul de proiect le completeaza
                    </div>
                  </div>
                </li>

                <!-- Step 2: PM verifies -->
                <li class="flex gap-3">
                  <div class="flex flex-col items-center">
                    <div
                      class="h-5 w-5 rounded-full border flex items-center justify-center transform transition-all duration-300 ease-out"
                      :class="step2Verified ? 'bg-blue-600 border-blue-600 scale-105 shadow-sm' : 'bg-gray-200 border-gray-300 scale-100'"
                    >
                      <i v-if="step2Verified" class="pi pi-check text-white text-[10px] leading-none"></i>
                    </div>
                    <div class="w-px flex-1 mt-1 transition-colors duration-300" :class="step2Verified ? 'bg-blue-600' : 'bg-gray-300'"></div>
                  </div>

                  <div>
                    <div class="text-sm font-medium transition-colors duration-300" :class="step2Verified ? 'text-blue-700' : 'text-gray-700'">
                      Acces permis de catre manager
                    </div>
                    <div class="text-xs text-gray-500 mt-1">
                      Puteti completa doar dupa ce au fost adaugate titlurile de activitate
                    </div>
                  </div>
                </li>

                <!-- Step 3 -->
                <li class="flex gap-3">
                  <div class="flex flex-col items-center">
                    <div
                      class="h-5 w-5 rounded-full border flex items-center justify-center transform transition-all duration-300 ease-out"
                      :class="step3ActivitiesFilled ? 'bg-blue-600 border-blue-600 scale-105 shadow-sm' : 'bg-gray-200 border-gray-300 scale-100'"
                    >
                      <i v-if="step3ActivitiesFilled" class="pi pi-check text-white text-[10px] leading-none"></i>
                    </div>
                    <div class="w-px flex-1 mt-1 transition-colors duration-300" :class="step3ActivitiesFilled ? 'bg-blue-600' : 'bg-gray-300'"></div>
                  </div>

                  <div>
                    <div class="text-sm font-medium transition-colors duration-300" :class="step3ActivitiesFilled ? 'text-blue-700' : 'text-gray-700'">
                      Completati activitatile si rezultatele(livrabilele)
                    </div>
                    <div class="text-xs text-gray-500 mt-1">Adaugati in paralel activitatea si livrabilul aferent</div>
                  </div>
                </li>

                <!-- Step 4 -->
                <li class="flex gap-3">
                  <div class="flex flex-col items-center">
                    <div
                      class="h-5 w-5 rounded-full border flex items-center justify-center transform transition-all duration-300 ease-out"
                      :class="step4StoryReady ? 'bg-blue-600 border-blue-600 scale-105 shadow-sm' : 'bg-gray-200 border-gray-300 scale-100'"
                    >
                      <i v-if="step4StoryReady" class="pi pi-check text-white text-[10px] leading-none"></i>
                    </div>
                    <div class="w-px flex-1 mt-1 transition-colors duration-300" :class="step4StoryReady ? 'bg-blue-600' : 'bg-gray-300'"></div>
                  </div>

                  <div>
                    <div class="text-sm font-medium transition-colors duration-300" :class="step4StoryReady ? 'text-blue-700' : 'text-gray-700'">
                      Scrieti narativul pentru luna respectiva sau folositi AI
                    </div>
                    <div class="text-xs text-gray-500 mt-1">
                      Puteti genera de maxim 3 ori (daca este cazul)
                    </div>
                  </div>
                </li>

                <!-- Step 5 -->
                <li class="flex gap-3">
                  <div class="flex flex-col items-center">
                    <div
                      class="h-5 w-5 rounded-full border flex items-center justify-center transform transition-all duration-300 ease-out"
                      :class="step5Saved ? 'bg-blue-600 border-blue-600 scale-105 shadow-sm' : 'bg-gray-200 border-gray-300 scale-100'"
                    >
                      <i v-if="step5Saved" class="pi pi-check text-white text-[10px] leading-none"></i>
                    </div>
                  </div>

                  <div>
                    <div class="text-sm font-medium transition-colors duration-300" :class="step5Saved ? 'text-blue-700' : 'text-gray-700'">
                      Salvati documentul
                    </div>
                    <div class="text-xs text-gray-500 mt-1">
                      Salvati dupa fiecare modificare realizata.
                    </div>
                  </div>
                </li>
              </ol>

              <div class="mt-5 text-xs text-gray-500">
                Culoarea albastra inseamna ca etapa a fost completata.
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>