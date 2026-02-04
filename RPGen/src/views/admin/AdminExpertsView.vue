<script setup>
import { onMounted, reactive, ref, computed } from 'vue'
import {
  adminListExperts,
  adminCreateExpert,
  adminDeleteExpert,
  adminUpdateExpertMonths,
} from '@/services/adminApi'
import { RouterLink } from 'vue-router'

const loading = ref(false)
const err = ref('')
const experts = ref([])
const deleteModalOpen = ref(false)
const deleteModalBusy = ref(false)
const deleteTarget = ref(null)

const form = reactive({
  uid: '',
  name: '',
  position: '',
  contract: '',
  responsibility: '',
})

function resetForm() {
  form.uid = ''
  form.name = ''
  form.position = ''
  form.contract = ''
  form.responsibility = ''
}

async function loadExperts() {
  err.value = ''
  loading.value = true
  try {
    experts.value = await adminListExperts()
  } catch (e) {
    err.value = e?.response?.data?.error || 'Failed to load experts'
  } finally {
    loading.value = false
  }
}

async function createExpert() {
  err.value = ''
  loading.value = true
  try {
    const payload = {
      uid: form.uid.trim(),
      name: form.name.trim(),
      position: form.position.trim(),
      contract: form.contract.trim(),
      responsibility: form.responsibility.trim(),
    }
    await adminCreateExpert(payload)
    resetForm()
    await loadExperts()
  } catch (e) {
    err.value = e?.response?.data?.error || 'Failed to create expert'
  } finally {
    loading.value = false
  }
}

function openDeleteModal(expert) {
  deleteTarget.value = expert
  deleteModalOpen.value = true
}

function closeDeleteModal() {
  deleteModalOpen.value = false
  deleteTarget.value = null
  deleteModalBusy.value = false
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  err.value = ''
  deleteModalBusy.value = true
  try {
    await adminDeleteExpert(deleteTarget.value.id)
    await loadExperts()
    closeDeleteModal()
  } catch (e) {
    err.value = e?.response?.data?.error || 'Failed to delete expert'
  } finally {
    deleteModalBusy.value = false
  }
}

/**
 * ===== Edit Months Modal State =====
 */
const monthsModalOpen = ref(false)
const monthsModalBusy = ref(false)
const monthsModalErr = ref('')
const monthsModalExpert = ref(null) // expert object currently edited
const selectedMonths = ref([]) // ["2026-01", "2026-03"]

const now = new Date()
const pickYear = ref(now.getFullYear())
const pickMonth = ref(now.getMonth() + 1)

const monthKeyPreview = computed(() => {
  return `${pickYear.value}-${String(pickMonth.value).padStart(2, '0')}`
})

function openMonthsModal(expert) {
  monthsModalErr.value = ''
  monthsModalExpert.value = expert
  selectedMonths.value = Array.isArray(expert.activeMonths) ? [...expert.activeMonths] : []
  selectedMonths.value.sort()
  pickYear.value = now.getFullYear()
  pickMonth.value = now.getMonth() + 1
  monthsModalOpen.value = true
}

function closeMonthsModal() {
  monthsModalOpen.value = false
  monthsModalBusy.value = false
  monthsModalErr.value = ''
  monthsModalExpert.value = null
  selectedMonths.value = []
}

function addSelectedMonth() {
  const key = monthKeyPreview.value
  if (!selectedMonths.value.includes(key)) {
    selectedMonths.value.push(key)
    selectedMonths.value.sort()
  }
}

function removeMonth(key) {
  selectedMonths.value = selectedMonths.value.filter((m) => m !== key)
}

async function saveMonths() {
  monthsModalErr.value = ''
  if (!monthsModalExpert.value) return

  monthsModalBusy.value = true
  try {
    const updated = await adminUpdateExpertMonths(monthsModalExpert.value.id, selectedMonths.value)

    // Update local list without full reload (snappy UX)
    const idx = experts.value.findIndex((x) => x.id === monthsModalExpert.value.id)
    if (idx !== -1) {
      experts.value[idx] = { ...experts.value[idx], activeMonths: updated.activeMonths || [] }
    }

    closeMonthsModal()
  } catch (e) {
    monthsModalErr.value = e?.response?.data?.error || 'Failed to save months'
  } finally {
    monthsModalBusy.value = false
  }
}

onMounted(loadExperts)
</script>

<template>
  <div class="p-6 max-w-6xl mx-auto">
    <div class="flex items-center justify-between gap-3">
      <h1 class="text-xl font-semibold">Manager — Experts</h1>

      <div class="flex gap-2 pt-2">
        <RouterLink
          class="rounded-xl border px-3 py-2 font-medium flex items-center hover:transition-discrete hover:bg-black hover:text-white"
          to="/admin/reports"
        >
          Rapoarte <i class="pl-2 pi pi-file-edit"></i>
        </RouterLink>
      </div>
    </div>

    <p class="mt-2 text-sm text-gray-600">
      Create experts (static fields). These fields are not editable later.
    </p>

    <div
      v-if="err"
      class="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
    >
      {{ err }}
    </div>

    <!-- Create form -->
    <div class="mt-6 rounded-2xl border p-5">
      <h2 class="font-semibold">Add expert</h2>

      <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="text-sm text-gray-600">uid (username)</label>
          <input
            v-model="form.uid"
            class="w-full rounded-xl border px-3 py-2"
            placeholder="e.g. fianu.danut"
          />
        </div>

        <div>
          <label class="text-sm text-gray-600">name</label>
          <input
            v-model="form.name"
            class="w-full rounded-xl border px-3 py-2"
            placeholder="FIANU DĂNUȚ"
          />
        </div>

        <div>
          <label class="text-sm text-gray-600">position</label>
          <input
            v-model="form.position"
            class="w-full rounded-xl border px-3 py-2"
            placeholder="Expert ..."
          />
        </div>

        <div>
          <label class="text-sm text-gray-600">contract</label>
          <input
            v-model="form.contract"
            class="w-full rounded-xl border px-3 py-2"
            placeholder="Contract ..."
          />
        </div>

        <div class="md:col-span-2">
          <label class="text-sm text-gray-600">responsibility (static)</label>
          <textarea
            v-model="form.responsibility"
            class="w-full rounded-xl border px-3 py-2 min-h-22.5"
            placeholder="Responsabilități generale..."
          />
        </div>
      </div>

      <div class="mt-4 flex gap-2">
        <button
          class="rounded-xl bg-black text-white px-4 py-2 disabled:opacity-50 cursor-pointer"
          :disabled="
            loading ||
            !form.uid.trim() ||
            !form.name.trim() ||
            !form.position.trim() ||
            !form.contract.trim() ||
            !form.responsibility.trim()
          "
          @click="createExpert"
        >
          {{ loading ? 'Saving...' : 'Create' }}
        </button>

        <button
          class="rounded-xl border px-4 py-2 cursor-pointer"
          :disabled="loading"
          @click="resetForm"
        >
          Clear
        </button>
      </div>
    </div>

    <!-- List -->
    <div class="mt-6 rounded-2xl border overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4 border-b">
        <h2 class="font-semibold">Experts</h2>
        <button
          class="rounded-xl border px-2 py-1 text-sm bg-gray-800 cursor-pointer"
          :disabled="loading"
          @click="loadExperts"
        >
          <i class="pi pi-refresh font-medium text-white bg-gray-800"></i>
        </button>
      </div>

      <div v-if="loading" class="p-5 text-sm text-gray-600">Loading...</div>

      <div v-else-if="experts.length === 0" class="p-5 text-sm text-gray-600">No experts yet.</div>

      <div v-else class="divide-y">
        <div v-for="e in experts" :key="e.id" class="p-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="font-medium">
                {{ e.name }}
                <span class="text-sm text-gray-500">({{ e.uid }})</span>
              </div>
              <div class="text-sm text-gray-600 mt-1">
                <div><span class="text-gray-500">Position:</span> {{ e.position }}</div>
                <div><span class="text-gray-500">Contract:</span> {{ e.contract }}</div>
                <div class="mt-1">
                  <span class="text-gray-500">Active months:</span>
                  <span v-if="(e.activeMonths || []).length === 0" class="text-gray-500">—</span>
                  <span v-else class="text-gray-700">{{ (e.activeMonths || []).join(', ') }}</span>
                </div>
              </div>
            </div>

            <div class="flex gap-2 flex-wrap justify-end">
              <button
                class="rounded-xl border px-3 py-2 text-sm bg-gray-100 cursor-pointer hover:scale-105"
                @click="openMonthsModal(e)"
                :disabled="loading"
              >
                Edit Months <i class="pi pi-calendar pl-2"></i>
              </button>

              <button
                class="rounded-xl border px-3 py-2 text-sm bg-red-500 text-white flex items-center cursor-pointer hover:scale-105"
                @click="openDeleteModal(e)"
                :disabled="loading"
              >
                Delete <i class="pi pi-trash pl-2"></i>
              </button>
            </div>
          </div>

          <details class="mt-3">
            <summary class="cursor-pointer text-sm text-gray-600">Show responsibility</summary>
            <div class="mt-2 whitespace-pre-wrap text-sm rounded-xl border bg-gray-50 p-3">
              {{ e.responsibility }}
            </div>
          </details>
        </div>
      </div>
    </div>

    <!-- Months Modal -->
    <div v-if="monthsModalOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" @click="closeMonthsModal"></div>

      <div class="absolute inset-0 flex items-center justify-center p-4">
        <div class="w-full max-w-2xl rounded-2xl bg-white shadow-xl border p-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-lg font-semibold">Edit active months</div>
              <div class="text-sm text-gray-600 mt-1">
                Expert:
                <span class="font-semibold text-gray-800">{{ monthsModalExpert?.name }}</span>
              </div>
            </div>

            <button
              class="rounded-xl border px-3 py-2 text-sm bg-red-500 text-white cursor-pointer"
              @click="closeMonthsModal"
              :disabled="monthsModalBusy"
            >
              Close
            </button>
          </div>

          <div
            v-if="monthsModalErr"
            class="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            {{ monthsModalErr }}
          </div>

          <div class="mt-4 rounded-2xl border p-4 bg-gray-50">
            <div class="text-sm font-medium">Add month</div>

            <div class="mt-3 flex flex-col md:flex-row gap-3 items-center">
              <div>
                <label class="text-xs text-gray-600 mr-1">Year</label>
                <input
                  v-model.number="pickYear"
                  type="number"
                  class="w-full md:w-40 rounded-xl border px-3 py-2"
                />
              </div>

              <div>
                <label class="text-xs text-gray-600 mr-1">Month</label>
                <select
                  v-model.number="pickMonth"
                  class="w-full md:w-56 rounded-xl border px-3 py-2"
                >
                  <option v-for="m in 12" :key="m" :value="m">
                    {{
                      new Intl.DateTimeFormat('en-US', { month: 'long' }).format(
                        new Date(2026, m - 1, 1),
                      )
                    }}
                  </option>
                </select>
              </div>

              <button
                class="rounded-xl bg-black text-white px-4 py-2 ml-4 text-sm disabled:opacity-50 cursor-pointer"
                :disabled="monthsModalBusy"
                @click="addSelectedMonth"
              >
                + Add
              </button>
            </div>

            <div class="mt-4">
              <div class="text-sm font-medium">Selected months</div>

              <div v-if="selectedMonths.length === 0" class="mt-2 text-sm text-gray-500">
                No months selected. (Strict mode: expert will not appear in Reports until you add
                months.)
              </div>

              <div v-else class="mt-3 flex flex-wrap gap-2">
                <span
                  v-for="mk in selectedMonths"
                  :key="mk"
                  class="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-sm"
                >
                  {{ mk }}
                  <button
                    class="text-gray-500 hover:text-red-500 font-semibold cursor-pointer"
                    @click="removeMonth(mk)"
                    :disabled="monthsModalBusy"
                  >
                    ✕
                  </button>
                </span>
              </div>
            </div>
          </div>

          <div class="mt-4 flex gap-2 justify-end">
            <button
              class="rounded-xl border px-4 py-2 text-sm cursor-pointer transition hover:scale-105"
              @click="closeMonthsModal"
              :disabled="monthsModalBusy"
            >
              Cancel
            </button>

            <button
              class="rounded-xl bg-black text-white px-4 py-2 text-sm disabled:opacity-50 cursor-pointer transition hover:scale-105"
              :disabled="monthsModalBusy"
              @click="saveMonths"
            >
              {{ monthsModalBusy ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirm Modal -->
    <div v-if="deleteModalOpen" class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/40" @click="closeDeleteModal"></div>

      <div class="absolute inset-0 flex items-center justify-center p-4">
        <div class="w-full max-w-md rounded-2xl bg-white shadow-xl border p-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-lg font-semibold text-red-600">Delete expert?</div>
              <div class="text-sm text-gray-600 mt-1">
                This will remove the expert and any related report data.
              </div>
            </div>

            <button
              class="rounded-xl border px-3 py-2 text-sm cursor-pointer"
              @click="closeDeleteModal"
              :disabled="deleteModalBusy"
            >
              Close
            </button>
          </div>

          <div class="mt-4 rounded-xl border bg-gray-50 p-3 text-sm">
            <div class="font-medium text-gray-800">{{ deleteTarget?.name }}</div>
            <div class="text-gray-600">{{ deleteTarget?.position }}</div>
            <div class="text-gray-500 text-xs mt-1">{{ deleteTarget?.uid }}</div>
          </div>

          <div class="mt-4 flex gap-2 justify-end">
            <button
              class="rounded-xl border px-4 py-2 text-sm cursor-pointer transition hover:scale-105"
              @click="closeDeleteModal"
              :disabled="deleteModalBusy"
            >
              Cancel
            </button>

            <button
              class="rounded-xl bg-red-600 text-white px-4 py-2 text-sm disabled:opacity-50 cursor-pointer transition hover:scale-105"
              :disabled="deleteModalBusy"
              @click="confirmDelete"
            >
              {{ deleteModalBusy ? 'Deleting...' : 'Delete' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
