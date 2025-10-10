import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit"

import { performSync } from "@/lib/sync/manager"
import type { SyncSnapshot } from "@/lib/sync/manager"
import type { SyncExecutionOptions } from "@/lib/sync/types"
import type { SafeCard, SafeUserCardProgress } from "@/types/data"

interface StudyState {
  cards: SafeCard[]
  progresses: SafeUserCardProgress[]
  status: "idle" | "syncing" | "failed"
  error?: string
}

const initialState: StudyState = {
  cards: [],
  progresses: [],
  status: "idle",
}

export const syncData = createAsyncThunk<
  SyncSnapshot,
  SyncExecutionOptions | undefined,
  { rejectValue: string }
>("study/syncData", async (options, { rejectWithValue }) => {
  try {
    return await performSync(options ?? {})
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed"
    return rejectWithValue(message)
  }
})

const studySlice = createSlice({
  name: "study",
  initialState,
  reducers: {
    setCards(state, action: PayloadAction<SafeCard[]>) {
      state.cards = action.payload
    },
    setProgresses(state, action: PayloadAction<SafeUserCardProgress[]>) {
      state.progresses = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(syncData.pending, (state) => {
        state.status = "syncing"
        state.error = undefined
      })
      .addCase(syncData.fulfilled, (state, action) => {
        state.status = "idle"
        state.cards = action.payload.cards
        state.progresses = action.payload.progresses
      })
      .addCase(syncData.rejected, (state, action) => {
        state.status = "failed"
        state.error = action.payload ?? "Unable to sync data"
      })
  },
})

export const { setCards, setProgresses } = studySlice.actions

export default studySlice.reducer
