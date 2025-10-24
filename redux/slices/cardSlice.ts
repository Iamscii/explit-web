import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

import type { SafeCard } from "@/types/data"
import type { SyncSnapshot } from "@/lib/sync/manager"
import { syncData } from "@/redux/thunks/syncThunks"

type CardStatus = "idle" | "loading" | "ready" | "failed"

interface CardState {
  byId: Record<string, SafeCard>
  allIds: string[]
  status: CardStatus
  error?: string
  selectedId?: string
}

const initialState: CardState = {
  byId: {},
  allIds: [],
  status: "idle",
}

const cardSlice = createSlice({
  name: "card",
  initialState,
  reducers: {
    setCards(state, action: PayloadAction<SafeCard[]>) {
      const cards = action.payload
      state.byId = cards.reduce<Record<string, SafeCard>>((acc, card) => {
        acc[card.id] = card
        return acc
      }, {})
      state.allIds = cards.map((card) => card.id)
      state.status = "ready"
      state.error = undefined
    },
    upsertCard(state, action: PayloadAction<SafeCard>) {
      const card = action.payload
      if (!state.byId[card.id]) {
        state.allIds.push(card.id)
      }
      state.byId[card.id] = card
    },
    removeCard(state, action: PayloadAction<string>) {
      const cardId = action.payload
      if (state.byId[cardId]) {
        delete state.byId[cardId]
        state.allIds = state.allIds.filter((id) => id !== cardId)
        if (state.selectedId === cardId) {
          state.selectedId = undefined
        }
      }
    },
    selectCard(state, action: PayloadAction<string | undefined>) {
      state.selectedId = action.payload
    },
    setCardStatus(state, action: PayloadAction<CardStatus>) {
      state.status = action.payload
    },
    setCardError(state, action: PayloadAction<string | undefined>) {
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
        state.status = "ready"
        state.error = undefined
        if (!snapshot.changedCollections.includes("cards")) {
          return
        }
        state.byId = snapshot.cards.reduce<Record<string, SafeCard>>((acc, card) => {
          acc[card.id] = card
          return acc
        }, {})
        state.allIds = snapshot.cards.map((card) => card.id)
      })
      .addCase(syncData.rejected, (state, action) => {
        state.status = "failed"
        state.error = action.payload ?? action.error.message ?? "Unable to sync cards"
      })
  },
})

export const {
  setCards,
  upsertCard,
  removeCard,
  selectCard,
  setCardStatus,
  setCardError,
} = cardSlice.actions

export default cardSlice.reducer
