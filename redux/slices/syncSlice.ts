import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

import type { SyncCursorMap, SyncExecutionOptions } from "@/lib/sync/types"
import type { SyncSnapshot } from "@/lib/sync/manager"
import { syncData } from "@/redux/slices/studySlice"

type SyncStatus = "idle" | "syncing" | "failed"

interface SyncState {
  status: SyncStatus
  error?: string
  queueSize: number
  lastSyncAt?: string
  cursors: SyncCursorMap
  deviceId?: string
  lastSyncReason?: string
}

const initialState: SyncState = {
  status: "idle",
  queueSize: 0,
  cursors: {},
}

const syncSlice = createSlice({
  name: "sync",
  initialState,
  reducers: {
    setQueueSize(state, action: PayloadAction<number>) {
      state.queueSize = action.payload
    },
    setCursors(state, action: PayloadAction<SyncCursorMap>) {
      state.cursors = { ...state.cursors, ...action.payload }
    },
    setDeviceId(state, action: PayloadAction<string>) {
      state.deviceId = action.payload
    },
    setLastSyncReason(state, action: PayloadAction<string | undefined>) {
      state.lastSyncReason = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(syncData.pending, (state, action) => {
        state.status = "syncing"
        state.error = undefined
        const options = action.meta.arg as SyncExecutionOptions | undefined
        state.lastSyncReason = options?.reason
      })
      .addCase(syncData.fulfilled, (state, action) => {
        const payload = action.payload as SyncSnapshot
        state.status = "idle"
        state.queueSize = payload.queueSize
        state.lastSyncAt = payload.timestamp
        state.cursors = { ...state.cursors, ...payload.cursors }
        state.deviceId = payload.deviceId
      })
      .addCase(syncData.rejected, (state, action) => {
        state.status = "failed"
        state.error = action.payload ?? action.error.message ?? "Sync failed"
      })
  },
})

export const { setQueueSize, setCursors, setDeviceId, setLastSyncReason } = syncSlice.actions

export default syncSlice.reducer
