import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

import type { SafeUserPreferences } from "@/types/data"
import type { SyncSnapshot } from "@/lib/sync/manager"
import { syncData } from "@/redux/thunks/syncThunks"

type PreferencesStatus = "idle" | "loading" | "ready" | "failed"

interface UserPreferencesState {
  value: SafeUserPreferences | null
  status: PreferencesStatus
  error?: string
}

const initialState: UserPreferencesState = {
  value: null,
  status: "idle",
}

const userPreferencesSlice = createSlice({
  name: "userPreferences",
  initialState,
  reducers: {
    setUserPreferences(state, action: PayloadAction<SafeUserPreferences | null>) {
      state.value = action.payload
      state.status = action.payload ? "ready" : "idle"
      state.error = undefined
    },
    updateUserPreferences(state, action: PayloadAction<SafeUserPreferences>) {
      state.value = action.payload
      state.status = "ready"
      state.error = undefined
    },
    setUserPreferencesStatus(state, action: PayloadAction<PreferencesStatus>) {
      state.status = action.payload
    },
    setUserPreferencesError(state, action: PayloadAction<string | undefined>) {
      state.error = action.payload
    },
    clearUserPreferences(state) {
      state.value = null
      state.status = "idle"
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(syncData.pending, (state) => {
        state.status = "loading"
      })
      .addCase(syncData.fulfilled, (state, action) => {
        const snapshot = action.payload as SyncSnapshot
        const preferences = snapshot.userPreferences?.[0] ?? null
        state.value = preferences
        state.status = preferences ? "ready" : "idle"
        state.error = undefined
      })
      .addCase(syncData.rejected, (state, action) => {
        state.status = "failed"
        state.error =
          action.payload ?? action.error.message ?? "Unable to sync user preferences"
      })
  },
})

export const {
  setUserPreferences,
  updateUserPreferences,
  setUserPreferencesStatus,
  setUserPreferencesError,
  clearUserPreferences,
} = userPreferencesSlice.actions

export default userPreferencesSlice.reducer
