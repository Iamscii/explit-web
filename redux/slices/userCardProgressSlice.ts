import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

import type { SafeUserCardProgress } from "@/types/data"
import { syncData } from "@/redux/thunks/syncThunks"
import type { SyncSnapshot } from "@/lib/sync/manager"

type ProgressStatus = "idle" | "loading" | "ready" | "failed"

interface UserCardProgressState {
  byId: Record<string, SafeUserCardProgress>
  idsByCard: Record<string, string>
  idsByDeck: Record<string, string[]>
  status: ProgressStatus
  error?: string
}

const initialState: UserCardProgressState = {
  byId: {},
  idsByCard: {},
  idsByDeck: {},
  status: "idle",
}

const attachToDeck = (state: UserCardProgressState, progress: SafeUserCardProgress) => {
  const deckId = progress.deckId
  const current = state.idsByDeck[deckId] ?? []
  if (!current.includes(progress.id)) {
    state.idsByDeck[deckId] = [...current, progress.id]
  }
}

const detachFromDeck = (
  state: UserCardProgressState,
  deckId: string,
  progressId: string,
) => {
  const deckList = state.idsByDeck[deckId]
  if (deckList) {
    state.idsByDeck[deckId] = deckList.filter((value) => value !== progressId)
    if (!state.idsByDeck[deckId].length) {
      delete state.idsByDeck[deckId]
    }
  }
}

const userCardProgressSlice = createSlice({
  name: "userCardProgress",
  initialState,
  reducers: {
    setUserCardProgresses(state, action: PayloadAction<SafeUserCardProgress[]>) {
      const progresses = action.payload
      state.byId = progresses.reduce<Record<string, SafeUserCardProgress>>(
        (acc, progress) => {
          acc[progress.id] = progress
          return acc
        },
        {},
      )

      state.idsByCard = progresses.reduce<Record<string, string>>((acc, progress) => {
        acc[progress.cardId] = progress.id
        return acc
      }, {})

      state.idsByDeck = {}
      progresses.forEach((progress) => attachToDeck(state, progress))
      state.status = "ready"
      state.error = undefined
    },
    upsertUserCardProgress(state, action: PayloadAction<SafeUserCardProgress>) {
      const progress = action.payload
      const previous = state.byId[progress.id]

      state.byId[progress.id] = progress
      state.idsByCard[progress.cardId] = progress.id

      if (previous && previous.deckId !== progress.deckId) {
        detachFromDeck(state, previous.deckId, previous.id)
      }

      attachToDeck(state, progress)
    },
    removeUserCardProgress(state, action: PayloadAction<string>) {
      const id = action.payload
      const existing = state.byId[id]
      if (existing) {
        delete state.byId[id]
        if (state.idsByCard[existing.cardId] === id) {
          delete state.idsByCard[existing.cardId]
        }
        detachFromDeck(state, existing.deckId, id)
      }
    },
    clearUserCardProgress(state) {
      state.byId = {}
      state.idsByCard = {}
      state.idsByDeck = {}
      state.status = "idle"
    },
    setUserCardProgressStatus(state, action: PayloadAction<ProgressStatus>) {
      state.status = action.payload
    },
    setUserCardProgressError(state, action: PayloadAction<string | undefined>) {
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
        const progresses = snapshot.progresses
        state.byId = progresses.reduce<Record<string, SafeUserCardProgress>>(
          (acc, progress) => {
            acc[progress.id] = progress
            return acc
          },
          {},
        )

        state.idsByCard = progresses.reduce<Record<string, string>>((acc, progress) => {
          acc[progress.cardId] = progress.id
          return acc
        }, {})

        state.idsByDeck = {}
        progresses.forEach((progress) => attachToDeck(state, progress))
        state.status = "ready"
        state.error = undefined
      })
      .addCase(syncData.rejected, (state, action) => {
        state.status = "failed"
        state.error =
          action.payload ?? action.error.message ?? "Unable to sync card progress"
      })
  },
})

export const {
  setUserCardProgresses,
  upsertUserCardProgress,
  removeUserCardProgress,
  clearUserCardProgress,
  setUserCardProgressStatus,
  setUserCardProgressError,
} = userCardProgressSlice.actions

export default userCardProgressSlice.reducer
