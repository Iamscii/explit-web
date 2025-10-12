import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

import type { SafeField } from "@/types/data"
import type { SyncSnapshot } from "@/lib/sync/manager"
import { syncData } from "@/redux/thunks/syncThunks"

type FieldStatus = "idle" | "loading" | "ready" | "failed"

interface FieldState {
  byId: Record<string, SafeField>
  idsByTemplate: Record<string, string[]>
  status: FieldStatus
  error?: string
}

const initialState: FieldState = {
  byId: {},
  idsByTemplate: {},
  status: "idle",
}

const attachFieldToTemplate = (state: FieldState, field: SafeField) => {
  const templateId = field.templateId
  const current = state.idsByTemplate[templateId] ?? []
  if (!current.includes(field.id)) {
    state.idsByTemplate[templateId] = [...current, field.id]
  }
}

const detachFieldFromTemplate = (state: FieldState, field: SafeField | string) => {
  const fieldId = typeof field === "string" ? field : field.id
  const templateId =
    typeof field === "string" ? undefined : (field as SafeField | undefined)?.templateId

  if (templateId) {
    const ids = state.idsByTemplate[templateId]
    if (ids) {
      state.idsByTemplate[templateId] = ids.filter((id) => id !== fieldId)
      if (!state.idsByTemplate[templateId].length) {
        delete state.idsByTemplate[templateId]
      }
    }
  } else {
    Object.keys(state.idsByTemplate).forEach((key) => {
      state.idsByTemplate[key] = state.idsByTemplate[key].filter((id) => id !== fieldId)
      if (!state.idsByTemplate[key].length) {
        delete state.idsByTemplate[key]
      }
    })
  }
}

const fieldSlice = createSlice({
  name: "field",
  initialState,
  reducers: {
    setFields(state, action: PayloadAction<SafeField[]>) {
      const fields = action.payload
      state.byId = fields.reduce<Record<string, SafeField>>((acc, field) => {
        acc[field.id] = field
        return acc
      }, {})

      state.idsByTemplate = fields.reduce<Record<string, string[]>>((acc, field) => {
        if (!acc[field.templateId]) {
          acc[field.templateId] = []
        }
        acc[field.templateId]!.push(field.id)
        return acc
      }, {})
      state.status = "ready"
      state.error = undefined
    },
    setFieldsForTemplate(
      state,
      action: PayloadAction<{ templateId: string; fields: SafeField[] }>,
    ) {
      const { templateId, fields } = action.payload
      if (!fields.length) {
        state.idsByTemplate[templateId] = []
      }

      fields.forEach((field) => {
        state.byId[field.id] = field
      })
      state.idsByTemplate[templateId] = fields.map((field) => field.id)
    },
    upsertField(state, action: PayloadAction<SafeField>) {
      const field = action.payload
      state.byId[field.id] = field
      attachFieldToTemplate(state, field)
    },
    removeField(state, action: PayloadAction<string>) {
      const fieldId = action.payload
      const existing = state.byId[fieldId]
      if (existing) {
        delete state.byId[fieldId]
        detachFieldFromTemplate(state, existing)
      }
    },
    clearFields(state) {
      state.byId = {}
      state.idsByTemplate = {}
      state.status = "idle"
    },
    setFieldStatus(state, action: PayloadAction<FieldStatus>) {
      state.status = action.payload
    },
    setFieldError(state, action: PayloadAction<string | undefined>) {
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
        const fields = snapshot.fields ?? []

        state.byId = fields.reduce<Record<string, SafeField>>((acc, field) => {
          acc[field.id] = field
          return acc
        }, {})

        state.idsByTemplate = fields.reduce<Record<string, string[]>>((acc, field) => {
          if (!acc[field.templateId]) {
            acc[field.templateId] = []
          }
          acc[field.templateId]!.push(field.id)
          return acc
        }, {})
        state.status = "ready"
        state.error = undefined
      })
      .addCase(syncData.rejected, (state, action) => {
        state.status = "failed"
        state.error = action.payload ?? action.error.message ?? "Unable to sync fields"
      })
  },
})

export const {
  setFields,
  setFieldsForTemplate,
  upsertField,
  removeField,
  clearFields,
  setFieldStatus,
  setFieldError,
} = fieldSlice.actions

export default fieldSlice.reducer
