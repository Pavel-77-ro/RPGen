<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  adminGetMonthReports,
  adminUpsertPmRows,
  adminVerifyReport,
  adminDownloadDocx,
} from '@/services/adminReportsApi'
import { RouterLink } from 'vue-router'

const now = new Date()

const saved = JSON.parse(localStorage.getItem('adminReportsSelection') || 'null')
const year = ref(saved?.year ?? now.getFullYear())
const month = ref(saved?.month ?? now.getMonth() + 1)

const loading = ref(false)
const err = ref('')
const items = ref([]) // [{ expert, report }]

const openEditorFor = ref('') // expertId whose editor is open
const editorRows = ref([]) // [{ code, hours }]
const editorBusy = ref(false)
const editorErr = ref('')

const monthName = computed(() => {
  const d = new Date(year.value, month.value - 1, 1)
  return new Intl.DateTimeFormat('en-US', { month: 'long' }).format(d)
})

const DONUT_STROKES = {
  completed: '#86efac', // tailwind green-300
  waiting_expert: '#93c5fd', // tailwind blue-300
  draft: '#facc15', // tailwind yellow-400
  not_created: '#d1d5db', // tailwind gray-300
}

function donutKey(label) {
  // your donut labels are: "Completed", "Waiting expert", "Draft", "Not created"
  if (label === 'Completed') return 'completed'
  if (label === 'Waiting expert') return 'waiting_expert'
  if (label === 'Draft') return 'draft'
  return 'not_created'
}
const ACTIVITY_OPTIONS = [
  {
    code: 'A1.1',
    full: 'A1.1 Definirea metodologiei de selectie si de lucru cu grupul tinta si a metodologiei de acordare a subventiilor',
  },
  { code: 'A1.2', full: 'A1.2 Organizarea si efectuarea selectiei, mentinerea grupului tinta' },
  { code: 'A1.3', full: 'A1.3 Acordarea subventiilor grupului tinta' },
  {
    code: 'A2.1',
    full: 'A2.1 Crearea si intretinerea de medii de practica in cadrul unitatii de invatamant in parteneriat cu agentii economici',
  },
  { code: 'A2.2', full: 'A2.2 Organizarea si derularea programelor de invatare la locul de munca' },
  { code: 'A2.3', full: 'A2.3 Organizarea examenelor de certificare a calificărilor profesionale' },
  {
    code: 'A3.1',
    full: 'A3.1 Încheierea parteneriatelor/ convenţiilor intre Solicitant şi partenerii de practică',
  },
  {
    code: 'A3.2',
    full: 'A3.2 Desfasurarea de campanii de informare coordonata, in ambele sensuri: de la companii/sectorul privat catre Solicitant privind nevoile lor de instruire, precum si de la Solicitant catre agentii economici/partenerii de practica, pentru a raspunde nevoilor actuale si viitoare ale pietei muncii la nivel national/regional/local',
  },
  { code: 'A4.1', full: 'A4.1 MANAGEMENT PROIECT' },
]

const FULL_BY_CODE = Object.fromEntries(ACTIVITY_OPTIONS.map((o) => [o.code, o.full]))

// ----- Dashboard stats (computed from items) -----
function statusOf(report) {
  if (!report) return 'not_created'
  if (report.pmVerified) {
    if (report.expertStarted) return 'completed'
    return 'waiting_expert'
  }
  return 'draft'
}

const stats = computed(() => {
  const total = items.value.length

  let notCreated = 0
  let draft = 0
  let waitingExpert = 0
  let completed = 0

  for (const it of items.value) {
    const s = statusOf(it.report)
    if (s === 'not_created') notCreated++
    else if (s === 'draft') draft++
    else if (s === 'waiting_expert') waitingExpert++
    else if (s === 'completed') completed++
  }

  const pct = (n) => (total === 0 ? 0 : Math.round((n / total) * 100))

  return {
    total,
    notCreated,
    draft,
    waitingExpert,
    completed,
    completedPct: pct(completed),
  }
})

const donut = computed(() => {
  const total = stats.value.total || 1

  const segs = [
    { label: 'Completed', value: stats.value.completed / total },
    { label: 'Waiting expert', value: stats.value.waitingExpert / total },
    { label: 'Draft', value: stats.value.draft / total },
    { label: 'Not created', value: stats.value.notCreated / total },
  ]

  let offset = 0
  return segs.map((s) => {
    const size = Math.round(s.value * 100)
    const item = { ...s, size, offset }
    offset += size
    return item
  })
})

const todoList = computed(() => {
  return [
    { label: 'Creaza raport', count: stats.value.notCreated },
    { label: 'Valideaza raport', count: stats.value.draft },
    { label: 'Asteptare Expert', count: stats.value.waitingExpert },
  ].filter((x) => x.count > 0)
})

const recentUpdates = computed(() => {
  return [...items.value]
    .filter((x) => x.report?.updatedAt)
    .sort((a, b) => new Date(b.report.updatedAt) - new Date(a.report.updatedAt))
    .slice(0, 5)
})

// ----- Existing UI logic -----
function badge(report) {
  if (!report) return { text: 'Not created', cls: 'border bg-gray-50 text-gray-700' }
  if (report.pmVerified) {
    if (report.expertStarted) return { text: 'Final', cls: 'border bg-green-50 text-green-800' }
    return { text: 'Completat Mihai', cls: 'border bg-blue-50 text-blue-800' }
  }
  return { text: 'Draft', cls: 'border bg-yellow-50 text-yellow-800' }
}

async function load() {
  localStorage.setItem(
    'adminReportsSelection',
    JSON.stringify({ year: year.value, month: month.value }),
  )

  err.value = ''
  loading.value = true
  openEditorFor.value = ''
  try {
    const data = await adminGetMonthReports(year.value, month.value)
    items.value = data.items || []
  } catch (e) {
    err.value = e?.response?.data?.error || 'Failed to load month reports'
  } finally {
    loading.value = false
  }
}

function getExistingRowsFromItem(it) {
  return it?.report?.rows || []
}

function openEditor(it) {
  editorErr.value = ''
  const id = it.expert.id

  if (openEditorFor.value === id) {
    openEditorFor.value = ''
    return
  }

  openEditorFor.value = id

  const existing = getExistingRowsFromItem(it)
  if (existing.length > 0) {
    editorRows.value = existing.map((r) => {
      const full = (r.title || '').trim()
      const match = ACTIVITY_OPTIONS.find((o) => o.full === full || full.startsWith(o.code + ' '))
      return { code: match?.code || '', hours: r.hours ?? 0 }
    })
  } else {
    editorRows.value = [{ code: '', hours: 0 }]
  }
}

function addRow() {
  editorRows.value.push({ code: '', hours: 0 })
}

function removeRow(i) {
  editorRows.value.splice(i, 1)
  if (editorRows.value.length === 0) editorRows.value.push({ code: '', hours: 0 })
}

function normalizeRows(rows) {
  return rows.map((r) => {
    const code = String(r.code || '').trim()
    const fullTitle = FULL_BY_CODE[code] || ''
    return {
      code, // UI/validation
      title: fullTitle, // DB
      hours: Number(r.hours),
    }
  })
}

function validateRows(rows) {
  const cleaned = normalizeRows(rows)

  for (const r of cleaned) {
    if (!r.code) return 'Selectează o activitate (A1.1 / A2.2 etc.)'
    if (!r.title) return 'Activitatea selectată nu este validă'
    if (!Number.isFinite(r.hours) || r.hours < 0) return 'Hours must be a number >= 0'
  }

  const codes = cleaned.map((r) => r.code)
  if (new Set(codes).size !== codes.length) return 'Duplicate activities are not allowed'

  return null
}

function findItemByExpertId(expertId) {
  return items.value.find((x) => x.expert.id === expertId)
}

async function saveRows(expertId) {
  editorErr.value = ''
  const vErr = validateRows(editorRows.value)
  if (vErr) {
    editorErr.value = vErr
    return
  }

  editorBusy.value = true
  try {
    const cleaned = normalizeRows(editorRows.value)
    const payloadRows = cleaned.map((r) => ({ title: r.title, hours: r.hours }))
    const report = await adminUpsertPmRows(expertId, year.value, month.value, payloadRows)

    const it = findItemByExpertId(expertId)
    if (it) {
      it.report = it.report || {}
      it.report.id = report.id
      it.report.year = report.year
      it.report.month = report.month
      it.report.pmVerified = report.pmVerified
      it.report.verifiedAt = report.verifiedAt
      it.report.updatedAt = report.updatedAt
      it.report.rows = report.rows
      it.report.rowsCount = report.rows?.length || 0
    }

    await load()
    openEditorFor.value = expertId
  } catch (e) {
    editorErr.value = e?.response?.data?.error || 'Failed to save rows'
  } finally {
    editorBusy.value = false
  }
}

async function verify(expertId) {
  editorErr.value = ''
  editorBusy.value = true
  try {
    await adminVerifyReport(expertId, year.value, month.value)
    await load()
  } catch (e) {
    editorErr.value = e?.response?.data?.error || 'Failed to verify'
  } finally {
    editorBusy.value = false
  }
}

async function download(expertId) {
  err.value = ''
  try {
    const { blob, filename } = await adminDownloadDocx(expertId, year.value, month.value)
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  } catch (e) {
    err.value = e?.response?.data?.error || 'Download failed'
  }
}

onMounted(load)
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto">
    <div class="flex items-center justify-between gap-3">
      <h1 class="text-xl font-semibold">Manager — Rapoarte</h1>

      <div class="flex gap-2">
        <RouterLink
          class="rounded-xl font-semibold border px-3 py-2 text-black hover:text-white hover:bg-black flex items-center transition"
          to="/admin/experts"
        >
          Experts <i class="pl-2 pi pi-users"></i>
        </RouterLink>
      </div>
    </div>

    <div class="mt-6 rounded-2xl border p-5 flex flex-col md:flex-row md:items-end gap-3">
      <div>
        <label class="text-sm text-gray-600 pr-1">Year</label>
        <input
          v-model.number="year"
          type="number"
          class="w-full md:w-40 rounded-xl border px-3 py-2"
        />
      </div>

      <div>
        <label class="text-sm text-gray-600 pl-2 pr-1">Month</label>
        <select v-model.number="month" class="w-full md:w-56 rounded-xl border px-3 py-2">
          <option v-for="m in 12" :key="m" :value="m">
            {{
              new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(2026, m - 1, 1))
            }}
          </option>
        </select>
      </div>

      <button
        class="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-50 cursor-pointer hover:scale-105 transition"
        :disabled="loading"
        @click="load"
      >
        {{ loading ? 'Loading...' : 'Load' }}
      </button>

      <div class="text-sm text-gray-800 md:ml-auto">
        Showing: <span class="font-semibold">{{ monthName }} {{ year }}</span>
      </div>
    </div>

    <div
      v-if="err"
      class="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
    >
      {{ err }}
    </div>

    <!-- Dashboard layout -->
    <div class="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- LEFT: Experts list -->
      <div class="lg:col-span-2 rounded-2xl border overflow-hidden">
        <div class="px-5 py-4 border-b flex items-center justify-between">
          <h2 class="font-medium">Experts for this month</h2>
          <div class="text-base text-black font-medium">
            {{ items.length }}<span class="text-sm text-gray-500"> experts</span>
          </div>
        </div>

        <div v-if="loading" class="p-5 text-sm text-gray-600">Loading...</div>
        <div v-else-if="items.length === 0" class="p-5 text-sm text-gray-600">
          No experts found.
        </div>

        <div v-else class="divide-y">
          <div v-for="it in items" :key="it.expert.id" class="p-5">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="font-medium">
                  {{ it.expert.name }}
                  <span class="text-sm text-gray-500">({{ it.expert.uid }})</span>
                </div>
                <div
                  class="mt-2 inline-flex items-center rounded-full px-2 py-1 text-xs"
                  :class="badge(it.report).cls"
                >
                  {{ badge(it.report).text }}
                </div>
              </div>

              <div class="flex gap-2 flex-wrap justify-end">
                <button
                  class="rounded-xl border px-3 py-2 text-sm cursor-pointer hover:scale-105 transition"
                  @click="openEditor(it)"
                >
                  {{ openEditorFor === it.expert.id ? 'Close' : 'Edit' }}
                </button>

                <button
                  class="rounded-xl border px-3 py-2 text-sm disabled:opacity-50 bg-green-200 cursor-pointer hover:scale-105 transition"
                  :disabled="editorBusy"
                  @click="verify(it.expert.id)"
                >
                  Permite Acces
                </button>

                <button
                  class="rounded-xl border px-3 py-2 text-sm bg-blue-200 cursor-pointer hover:scale-105 transition"
                  @click="download(it.expert.id)"
                >
                  Download <i class="pl-2 pi pi-download"></i>
                </button>
              </div>
            </div>

            <!-- Inline editor -->
            <div
              v-if="openEditorFor === it.expert.id"
              class="mt-4 rounded-2xl border p-4 bg-gray-50"
            >
              <div class="flex items-center justify-between">
                <div class="font-semibold">PM rows (title + hours)</div>
                <div class="text-xs text-gray-500">These define the table rows in the report.</div>
              </div>

              <div
                v-if="editorErr"
                class="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {{ editorErr }}
              </div>

              <div class="mt-4 space-y-2">
                <div
                  v-for="(r, idx) in editorRows"
                  :key="idx"
                  class="grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-2 items-end"
                >
                  <div>
                    <label class="text-xs text-gray-600">Title</label>
                    <select v-model="r.code" class="w-full rounded-xl border px-3 py-2">
                      <option value="" disabled>Select activity</option>
                      <option v-for="opt in ACTIVITY_OPTIONS" :key="opt.code" :value="opt.code">
                        {{ opt.code }}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label class="text-xs text-gray-600">Hours</label>
                    <input
                      v-model.number="r.hours"
                      type="number"
                      min="0"
                      class="w-full rounded-xl border px-3 py-2"
                    />
                  </div>

                  <button
                    class="rounded-xl border px-3 py-2 text-sm"
                    @click="removeRow(idx)"
                    :disabled="editorBusy"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div class="mt-4 flex gap-2 flex-wrap">
                <button
                  class="rounded-xl border px-3 py-2 text-sm"
                  @click="addRow"
                  :disabled="editorBusy"
                >
                  + Add row
                </button>

                <button
                  class="rounded-xl bg-black text-white px-4 py-2 text-sm disabled:opacity-50"
                  :disabled="editorBusy"
                  @click="saveRows(it.expert.id)"
                >
                  {{ editorBusy ? 'Saving...' : 'Save' }}
                </button>

                <button
                  class="rounded-xl border px-4 py-2 text-sm"
                  :disabled="editorBusy"
                  @click="openEditor(it)"
                >
                  Close
                </button>
              </div>
            </div>

            <div class="mt-3 text-sm text-gray-600">
              <div><span class="text-gray-500">Position:</span> {{ it.expert.position }}</div>
              <div><span class="text-gray-500">Contract:</span> {{ it.expert.contract }}</div>
            </div>

            <div v-if="it.report" class="mt-3 text-xs text-gray-500">
              Rows: {{ it.report.rowsCount }} • Updated:
              {{ new Date(it.report.updatedAt).toLocaleString() }}
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT: Stats panel -->
      <div class="rounded-2xl border overflow-hidden">
        <div class="px-5 py-4 border-b">
          <h2 class="font-medium">Statistics</h2>
          <div class="text-sm text-gray-500">Overview for selected month</div>
        </div>

        <div class="p-5 space-y-5">
          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-2xl border p-4 bg-gray-50">
              <div class="text-xs text-gray-500">Total</div>
              <div class="text-xl font-semibold">{{ stats.total }}</div>
            </div>
            <div class="rounded-2xl bg-green-100 border p-4">
              <div class="text-xs text-gray-500">Finalizat</div>
              <div class="text-xl font-semibold">{{ stats.completed }}</div>
            </div>
            <div class="rounded-2xl border p-4 bg-blue-100">
              <div class="text-xs text-gray-500">Completat Mihai</div>
              <div class="text-xl font-semibold">{{ stats.waitingExpert }}</div>
            </div>
            <div class="rounded-2xl border p-4 bg-yellow-100">
              <div class="text-xs text-gray-500">Draft</div>
              <div class="text-xl font-semibold">{{ stats.draft }}</div>
            </div>
          </div>

          <div class="rounded-2xl border p-4">
            <div class="flex items-center justify-between">
              <div class="text-sm font-medium">Month progress</div>
              <div class="text-sm text-gray-600">{{ stats.completedPct }}%</div>
            </div>
            <div class="mt-3 h-2 rounded-full bg-gray-200 overflow-hidden">
              <div class="h-2 bg-black" :style="{ width: stats.completedPct + '%' }"></div>
            </div>
            <div class="mt-2 text-xs text-gray-500">
              Remaining: {{ stats.total - stats.completed }} experts
            </div>
          </div>

          <div class="rounded-2xl border p-4">
            <div class="text-sm font-medium mb-3">Distribution</div>

            <div class="flex items-center gap-4">
              <svg viewBox="0 0 36 36" class="w-20 h-20">
                <path
                  d="M18 2.0845
                     a 15.9155 15.9155 0 0 1 0 31.831
                     a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  stroke-opacity="0.15"
                  stroke-width="3"
                />
                <template v-for="(seg, idx) in donut" :key="idx">
                  <path
                    d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                     a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    :stroke="DONUT_STROKES[donutKey(seg.label)]"
                    stroke-width="3"
                    :stroke-dasharray="seg.size + ' ' + (100 - seg.size)"
                    :stroke-dashoffset="-seg.offset"
                  />
                </template>
              </svg>

              <div class="text-sm text-gray-700 space-y-1">
                <div>
                  Finalizate:
                  <span class="font-medium text-base text-green-800">{{ stats.completed }}</span>
                </div>
                <div>
                  Completat Mihai:
                  <span class="font-medium text-base text-blue-800">{{ stats.waitingExpert }}</span>
                </div>
                <div>
                  Draft:
                  <span class="font-medium text-base text-yellow-800">{{ stats.draft }}</span>
                </div>
                <div>
                  Not created:
                  <span class="font-medium text-base text-black">{{ stats.notCreated }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-2xl border p-4">
            <div class="text-sm font-medium">To-do</div>
            <div v-if="todoList.length === 0" class="mt-2 text-sm text-gray-600">
              Nothing pending 🎉
            </div>
            <ul v-else class="mt-2 space-y-2 text-sm">
              <li v-for="(t, i) in todoList" :key="i" class="flex items-center justify-between">
                <span class="text-gray-700">{{ t.label }}</span>
                <span class="rounded-full border px-2 py-0.5 text-sm text-black bg-gray-50">{{
                  t.count
                }}</span>
              </li>
            </ul>
          </div>

          <div class="rounded-2xl border p-4">
            <div class="text-sm font-medium mb-4">Recent updates</div>
            <div v-if="recentUpdates.length === 0" class="mt-2 text-sm text-gray-600">
              No updates yet.
            </div>
            <div v-else class="mt-2 space-y-2 text-sm">
              <div
                v-for="it in recentUpdates"
                :key="it.expert.id"
                class="flex items-center justify-between"
              >
                <div class="truncate">
                  <span class="font-medium">{{ it.expert.name }}</span>
                </div>
                <div class="text-xs text-gray-500">
                  {{ new Date(it.report.updatedAt).toLocaleString() }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
