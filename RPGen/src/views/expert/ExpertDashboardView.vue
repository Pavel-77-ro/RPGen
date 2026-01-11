<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useExpertAuthStore } from "@/stores/expertAuth";
import {
  expertListMyReports,
  expertGetReport,
  expertUpdateReport,
  expertDownloadDocx,
} from "@/services/expertApi";
import { expertGenerateDescription } from "@/services/expertApi";
import{useRouter} from 'vue-router';

const auth = useExpertAuthStore();
const generating = ref(false);

const loading = ref(false);
const saving = ref(false);
const err = ref("");
const msg = ref("");
const router=useRouter();

const available = ref([]); // [{year, month, pmVerified, updatedAt}]
const selectedKey = ref(""); // "YYYY-M"

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

async function save() {
  err.value = "";
  msg.value = "";
  if (!state.year || !state.month) return;

  if (!state.pmVerified) {
    err.value = "Report is not available yet (PM has not verified it).";
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
const MIN_CHARS = 20;

const canGenerateAI = computed(() => {
  if (!state.pmVerified) return false;
  if (generating.value) return false;
  if (!state.rows?.length) return false;

  return state.rows.every(r => {
    const a = (r.activity || "").trim();
    const rs = (r.results || "").trim();
    return a.length >= MIN_CHARS && rs.length >= MIN_CHARS;
  });
});

const aiDisableReason = computed(() => {
  if (!state.pmVerified) return "Not available until PM verifies.";
  if (generating.value) return "Generating...";
  if (!state.rows?.length) return "No rows to summarize.";
  const bad = state.rows.find(r => ((r.activity || "").trim().length < MIN_CHARS) || ((r.results || "").trim().length < MIN_CHARS));
  if (bad) return `Fill Activity + Results with at least ${MIN_CHARS} characters for each row.`;
  return "";
});

function logOut(){
  auth.logout();
  router.push({name: 'expert-login'})
}

onMounted(loadAll);
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">Expert Dashboard</h1>
        <div class="text-sm text-gray-600 mt-1">
          <span class="text-gray-500">User: </span>
          <span class="font-medium">{{ auth.expert?.name || auth.expert?.uid }}</span>
        </div>
      </div>

      <div class="flex gap-3">
        <button class="rounded-xl border px-3 py-2 flex items-center cursor-pointer" @click="loadAll" :disabled="loading || saving">
          Refresh <i class="pi pi-refresh font-medium pl-2"></i>
        </button>
        <button class="rounded-xl border px-3 py-2 flex items-center cursor-pointer bg-red-500 text-white hover:bg-red-300 hover:text-black" @click="logOut">
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
        <div class="text-gray-500">Selected report</div>
        <div class="font-semibold">{{ monthLabel || "—" }}</div>
      </div>

      <div class="text-sm">
        <span
          class="inline-flex items-center rounded-full px-2 py-1 text-xs border"
          :class="state.pmVerified ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-700'"
        >
          {{ state.pmVerified ? "Valabil (Completat de Manager)" : "Not verified" }}
        </span>
      </div>
    </div>

    <div v-if="err" class="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      {{ err }}
    </div>
    <div v-if="msg" class="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
      {{ msg }}
    </div>

    <div v-if="loading" class="mt-6 text-sm text-gray-600">Loading...</div>

    <div v-else class="mt-6 space-y-6">
      <div v-if="!selectedKey" class="rounded-2xl border p-5 bg-gray-50 text-sm text-gray-700">
        Select a month to view/edit the report.
      </div>

      <div v-else-if="!state.pmVerified" class="rounded-2xl border p-5 bg-gray-50 text-sm text-gray-700">
        This month is not verified by the PM yet. You can view it, but you cannot save or download until it is verified.
      </div>

      <div v-else-if="state.rows.length === 0" class="rounded-2xl border p-5 bg-gray-50 text-sm text-gray-700">
        PM verified the month, but there are no rows. Ask PM to add titles/hours.
      </div>

      <div v-else class="rounded-2xl border overflow-hidden">
        <div class="px-5 py-4 border-b flex items-center justify-between">
          <h2 class="font-semibold">Monthly rows</h2>
          <div class="text-xs text-gray-500">Fill activity + results (multiline is ok)</div>
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
                  class="w-full rounded-xl border px-3 py-2 min-h-30"
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
          <button class="rounded-xl border px-3 py-2 text-sm disabled:opacity-50 bg-black text-white hover:scale-105 cursor-pointer" :disabled="!canGenerateAI"
            :title="aiDisableReason"
            @click="generateWithAI">
            {{ generating ? "Generating..." : "Generate with AI" }} <i class="pi pi-sparkles"></i>
          </button>
        </div>
        
        <p class="text-sm text-gray-500 mt-1">This fills {{description}} in the template.</p>

        <textarea
          v-model="state.description"
          class="mt-3 w-full rounded-xl border px-3 py-2 min-h-35"
          :disabled="!state.pmVerified"
        />

        <div class="mt-4 flex gap-2 flex-wrap">
          <button
            class=" cursor-pointer rounded-xl bg-green-200 hover:bg-green-300 text-black border px-4 py-2 disabled:opacity-50"
            :disabled="saving || !state.pmVerified"
            @click="save"
          >
            {{ saving ? "Saving..." : "Save" }}
          </button>

          <button class="rounded-xl border px-4 py-2 cursor-pointer hover:bg-blue-200" :disabled="!state.pmVerified" @click="download">
            Download <i class="pl-2 pi pi-download"></i>
          </button>
        </div>

        <div v-if="!state.pmVerified" class="mt-3 text-xs text-gray-500">
          Save/Download are disabled until the PM verifies this month.
        </div>
      </div>
    </div>
  </div>
</template>
