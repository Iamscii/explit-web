import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

import type { SafeDeck } from "@/types/data"
import type { SyncSnapshot } from "@/lib/sync/manager"
import { syncData } from "@/redux/slices/studySlice"

interface DeckState {
  items: SafeDeck[]
  status: "idle" | "loading" | "succeeded" | "failed"
  error?: string
}

const initialState: DeckState = {
  items: [],
  status: "idle",
}

const deckSlice = createSlice({
  name: "deck",
  initialState,
  reducers: {
    setDecks(state, action: PayloadAction<SafeDeck[]>) {
      state.items = action.payload
      state.status = "succeeded"
    },
    upsertDeck(state, action: PayloadAction<SafeDeck>) {
      const deck = action.payload
      const existingIndex = state.items.findIndex((item) => item.id === deck.id)

      if (existingIndex >= 0) {
        state.items[existingIndex] = deck
      } else {
        state.items.push(deck)
      }
    },
    removeDeck(state, action: PayloadAction<string>) {
      state.items = state.items.filter((deck) => deck.id !== action.payload)
    },
    setDeckStatus(
      state,
      action: PayloadAction<DeckState["status"] | { status: DeckState["status"]; error?: string }>,
    ) {
      if (typeof action.payload === "string") {
        state.status = action.payload
        state.error = undefined
      } else {
        state.status = action.payload.status
        state.error = action.payload.error
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(syncData.pending, (state) => {
        state.status = "loading"
      })
      .addCase(syncData.fulfilled, (state, action) => {
        const snapshot = action.payload as SyncSnapshot
        state.items = snapshot.decks
        state.status = "succeeded"
        state.error = undefined
      })
      .addCase(syncData.rejected, (state, action) => {
        state.status = "failed"
        state.error = action.payload ?? action.error.message ?? "Unable to sync decks"
      })
  },
})

export const { setDecks, upsertDeck, removeDeck, setDeckStatus } = deckSlice.actions

export default deckSlice.reducer
