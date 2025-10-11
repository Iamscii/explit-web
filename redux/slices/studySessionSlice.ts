import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

type StudySessionStatus = "idle" | "in-progress" | "paused" | "completed"

interface StartSessionPayload {
  deckId?: string
  cardIds: string[]
  startedAt?: string
}

interface PreparedStartSessionPayload extends Omit<StartSessionPayload, "startedAt"> {
  startedAt: string
}

interface StudySessionState {
  status: StudySessionStatus
  deckId?: string
  currentCardId?: string
  queue: string[]
  completed: string[]
  startedAt?: string
  lastInteractionAt?: string
}

const initialState: StudySessionState = {
  status: "idle",
  queue: [],
  completed: [],
}

const studySessionSlice = createSlice({
  name: "studySession",
  initialState,
  reducers: {
    startSession: {
      reducer(state, action: PayloadAction<PreparedStartSessionPayload>) {
        const { deckId, cardIds, startedAt } = action.payload
        const [currentCardId, ...queue] = cardIds

        state.deckId = deckId
        state.currentCardId = currentCardId
        state.queue = queue
        state.completed = []
        state.startedAt = startedAt
        state.lastInteractionAt = startedAt
        state.status = currentCardId ? "in-progress" : "completed"
      },
      prepare(payload: StartSessionPayload) {
        return {
          payload: {
            ...payload,
            startedAt: payload.startedAt ?? new Date().toISOString(),
          },
        }
      },
    },
    advanceSession: {
      reducer(state, action: PayloadAction<{ timestamp: string }>) {
        if (!state.currentCardId) {
          return
        }

        state.completed = [...state.completed, state.currentCardId]
        const [next, ...rest] = state.queue
        state.currentCardId = next
        state.queue = rest
        state.status = state.currentCardId ? "in-progress" : "completed"
        state.lastInteractionAt = action.payload.timestamp
      },
      prepare(timestamp?: string) {
        return {
          payload: {
            timestamp: timestamp ?? new Date().toISOString(),
          },
        }
      },
    },
    skipCurrentCard: {
      reducer(state, action: PayloadAction<{ timestamp: string }>) {
        if (!state.currentCardId) {
          return
        }

        if (!state.queue.length) {
          state.completed = [...state.completed, state.currentCardId]
          state.currentCardId = undefined
          state.status = "completed"
          state.lastInteractionAt = action.payload.timestamp
          return
        }

        const [next, ...rest] = state.queue
        state.queue = [...rest, state.currentCardId]
        state.currentCardId = next
        state.status = state.currentCardId ? "in-progress" : "completed"
        state.lastInteractionAt = action.payload.timestamp
      },
      prepare(timestamp?: string) {
        return {
          payload: {
            timestamp: timestamp ?? new Date().toISOString(),
          },
        }
      },
    },
    enqueueCard(state, action: PayloadAction<string>) {
      const cardId = action.payload
      if (state.currentCardId === cardId || state.queue.includes(cardId)) {
        return
      }
      state.queue = [...state.queue, cardId]
    },
    resumeSession: {
      reducer(state, action: PayloadAction<{ timestamp: string }>) {
        if (state.status === "paused") {
          state.status = state.currentCardId ? "in-progress" : "completed"
          state.lastInteractionAt = action.payload.timestamp
        }
      },
      prepare(timestamp?: string) {
        return {
          payload: {
            timestamp: timestamp ?? new Date().toISOString(),
          },
        }
      },
    },
    pauseSession: {
      reducer(state, action: PayloadAction<{ timestamp: string }>) {
        if (state.status === "in-progress") {
          state.status = "paused"
          state.lastInteractionAt = action.payload.timestamp
        }
      },
      prepare(timestamp?: string) {
        return {
          payload: {
            timestamp: timestamp ?? new Date().toISOString(),
          },
        }
      },
    },
    recordInteraction: {
      reducer(state, action: PayloadAction<{ timestamp: string }>) {
        state.lastInteractionAt = action.payload.timestamp
      },
      prepare(timestamp?: string) {
        return {
          payload: {
            timestamp: timestamp ?? new Date().toISOString(),
          },
        }
      },
    },
    resetSession() {
      return { ...initialState }
    },
  },
})
export const {
  startSession,
  advanceSession,
  skipCurrentCard,
  enqueueCard,
  resumeSession,
  pauseSession,
  recordInteraction,
  resetSession,
} = studySessionSlice.actions

export default studySessionSlice.reducer
