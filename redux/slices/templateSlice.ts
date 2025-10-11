import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

import type { SafeStyle, SafeTemplate } from "@/types/data"
import type { SyncSnapshot } from "@/lib/sync/manager"
import { syncData } from "@/redux/slices/studySlice"

type TemplateStatus = "idle" | "loading" | "ready" | "failed"

interface TemplateState {
  byId: Record<string, SafeTemplate>
  allIds: string[]
  stylesByTemplateId: Record<string, SafeStyle | undefined>
  status: TemplateStatus
  error?: string
  selectedId?: string
}

const initialState: TemplateState = {
  byId: {},
  allIds: [],
  stylesByTemplateId: {},
  status: "idle",
}

const templateSlice = createSlice({
  name: "template",
  initialState,
  reducers: {
    setTemplates(
      state,
      action: PayloadAction<{ templates: SafeTemplate[]; styles?: SafeStyle[] }>,
    ) {
      const { templates, styles = [] } = action.payload
      const styleMap = styles.reduce<Record<string, SafeStyle>>((acc, style) => {
        acc[style.templateId] = style
        return acc
      }, {})

      state.byId = templates.reduce<Record<string, SafeTemplate>>((acc, template) => {
        const style = styleMap[template.id] ?? template.style
        acc[template.id] = style ? { ...template, style } : template
        return acc
      }, {})

      state.stylesByTemplateId = styleMap
      state.allIds = templates.map((template) => template.id)
      state.status = "ready"
      state.error = undefined
    },
    upsertTemplate(state, action: PayloadAction<SafeTemplate>) {
      const template = action.payload
      if (!state.byId[template.id]) {
        state.allIds.push(template.id)
      }
      state.byId[template.id] = template
      if (template.style) {
        state.stylesByTemplateId[template.id] = template.style
      }
    },
    removeTemplate(state, action: PayloadAction<string>) {
      const templateId = action.payload
      if (state.byId[templateId]) {
        delete state.byId[templateId]
        delete state.stylesByTemplateId[templateId]
        state.allIds = state.allIds.filter((id) => id !== templateId)
        if (state.selectedId === templateId) {
          state.selectedId = undefined
        }
      }
    },
    selectTemplate(state, action: PayloadAction<string | undefined>) {
      state.selectedId = action.payload
    },
    setTemplateStatus(state, action: PayloadAction<TemplateStatus>) {
      state.status = action.payload
    },
    setTemplateError(state, action: PayloadAction<string | undefined>) {
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
        const styles = snapshot.styles ?? []

        const styleMap = styles.reduce<Record<string, SafeStyle>>((acc, style) => {
          acc[style.templateId] = style
          return acc
        }, {})

        state.byId = snapshot.templates.reduce<Record<string, SafeTemplate>>(
          (acc, template) => {
            const style = styleMap[template.id] ?? template.style
            acc[template.id] = style ? { ...template, style } : template
            return acc
          },
          {},
        )
        state.stylesByTemplateId = styleMap
        state.allIds = snapshot.templates.map((template) => template.id)
        state.status = "ready"
        state.error = undefined
      })
      .addCase(syncData.rejected, (state, action) => {
        state.status = "failed"
        state.error = action.payload ?? action.error.message ?? "Unable to sync templates"
      })
  },
})

export const {
  setTemplates,
  upsertTemplate,
  removeTemplate,
  selectTemplate,
  setTemplateStatus,
  setTemplateError,
} = templateSlice.actions

export default templateSlice.reducer
