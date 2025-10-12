import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

import type { SafeFieldPreference } from "@/types/data"
import type { SyncSnapshot } from "@/lib/sync/manager"
import { syncData } from "@/redux/thunks/syncThunks"

type FieldPreferenceStatus = "idle" | "loading" | "ready" | "failed"

interface FieldPreferenceState {
  byId: Record<string, SafeFieldPreference>
  idsByField: Record<string, string[]>
  idsByTemplate: Record<string, string[]>
  status: FieldPreferenceStatus
  error?: string
}

const initialState: FieldPreferenceState = {
  byId: {},
  idsByField: {},
  idsByTemplate: {},
  status: "idle",
}

const indexPreference = (state: FieldPreferenceState, preference: SafeFieldPreference) => {
  const fieldId = preference.fieldId
  const templateId = preference.templateId

  const fieldList = state.idsByField[fieldId] ?? []
  if (!fieldList.includes(preference.id)) {
    state.idsByField[fieldId] = [...fieldList, preference.id]
  }

  const templateList = state.idsByTemplate[templateId] ?? []
  if (!templateList.includes(preference.id)) {
    state.idsByTemplate[templateId] = [...templateList, preference.id]
  }
}

const removePreferenceFromIndex = (
  state: FieldPreferenceState,
  preference: SafeFieldPreference | string,
) => {
  const id = typeof preference === "string" ? preference : preference.id
  const fieldId = typeof preference === "string" ? undefined : preference.fieldId
  const templateId = typeof preference === "string" ? undefined : preference.templateId

  if (fieldId) {
    const fieldList = state.idsByField[fieldId]
    if (fieldList) {
      state.idsByField[fieldId] = fieldList.filter((value) => value !== id)
      if (!state.idsByField[fieldId].length) {
        delete state.idsByField[fieldId]
      }
    }
  } else {
    Object.keys(state.idsByField).forEach((fieldKey) => {
      state.idsByField[fieldKey] = state.idsByField[fieldKey].filter((value) => value !== id)
      if (!state.idsByField[fieldKey].length) {
        delete state.idsByField[fieldKey]
      }
    })
  }

  if (templateId) {
    const templateList = state.idsByTemplate[templateId]
    if (templateList) {
      state.idsByTemplate[templateId] = templateList.filter((value) => value !== id)
      if (!state.idsByTemplate[templateId].length) {
        delete state.idsByTemplate[templateId]
      }
    }
  } else {
    Object.keys(state.idsByTemplate).forEach((templateKey) => {
      state.idsByTemplate[templateKey] = state.idsByTemplate[templateKey].filter(
        (value) => value !== id,
      )
      if (!state.idsByTemplate[templateKey].length) {
        delete state.idsByTemplate[templateKey]
      }
    })
  }
}

const fieldPreferenceSlice = createSlice({
  name: "fieldPreference",
  initialState,
  reducers: {
    setFieldPreferences(state, action: PayloadAction<SafeFieldPreference[]>) {
      const prefs = action.payload
      const nextById: Record<string, SafeFieldPreference> = {}

      for (const pref of prefs) {
        nextById[pref.id] = pref
      }

      state.byId = nextById
      state.idsByField = {}
      state.idsByTemplate = {}

      for (const pref of prefs) {
        indexPreference(state, pref)
      }

      state.status = "ready"
      state.error = undefined
    },
    upsertFieldPreference(state, action: PayloadAction<SafeFieldPreference>) {
      const pref = action.payload
      state.byId[pref.id] = pref
      indexPreference(state, pref)
    },
    removeFieldPreference(state, action: PayloadAction<string>) {
      const id = action.payload
      const existing = state.byId[id]
      if (existing) {
        delete state.byId[id]
        removePreferenceFromIndex(state, existing)
      }
    },
    clearFieldPreferences(state) {
      state.byId = {}
      state.idsByField = {}
      state.idsByTemplate = {}
      state.status = "idle"
    },
    setFieldPreferenceStatus(state, action: PayloadAction<FieldPreferenceStatus>) {
      state.status = action.payload
    },
    setFieldPreferenceError(state, action: PayloadAction<string | undefined>) {
      state.error = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(syncData.pending, (state) => {
        state.status = "loading"
      })
      .addCase(syncData.fulfilled, (state, action) => {
        const snapshot = action.payload as SyncSnapshot
        const prefs = snapshot.fieldPreferences ?? []

        const nextById: Record<string, SafeFieldPreference> = {}
        for (const pref of prefs) {
          nextById[pref.id] = pref
        }

        state.byId = nextById
        state.idsByField = {}
        state.idsByTemplate = {}
        for (const pref of prefs) {
          indexPreference(state, pref)
        }
        state.status = "ready"
        state.error = undefined
      })
      .addCase(syncData.rejected, (state, action) => {
        state.status = "failed"
        state.error =
          action.payload ?? action.error.message ?? "Unable to sync field preferences"
      })
  },
})

export const {
  setFieldPreferences,
  upsertFieldPreference,
  removeFieldPreference,
  clearFieldPreferences,
  setFieldPreferenceStatus,
  setFieldPreferenceError,
} = fieldPreferenceSlice.actions

export default fieldPreferenceSlice.reducer
