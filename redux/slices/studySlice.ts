import {
  createSlice,
  type AnyAction,
  type CaseReducer,
  type PayloadAction,
} from "@reduxjs/toolkit"
import type { SyncSnapshot } from "@/lib/sync/manager"
import { syncData } from "@/redux/thunks/syncThunks"
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

type StudySyncPayload = Pick<SyncSnapshot, "cards" | "progresses" | "changedCollections">

const handleSyncPending: CaseReducer<StudyState, AnyAction> = (state) => {
  state.status = "syncing"
  state.error = undefined
}

const handleSyncFulfilled: CaseReducer<
  StudyState,
  PayloadAction<StudySyncPayload>
> = (state, action) => {
  const snapshot = action.payload
  state.status = "idle"
  if (snapshot.changedCollections.includes("cards")) {
    state.cards = snapshot.cards
  }
  if (snapshot.changedCollections.includes("progresses")) {
    state.progresses = snapshot.progresses
  }
}

const handleSyncRejected: CaseReducer<
  StudyState,
  PayloadAction<string | undefined>
> = (state, action) => {
  state.status = "failed"
  state.error = action.payload ?? "Unable to sync data"
}

const isSyncFulfilled = (
  action: AnyAction,
): action is PayloadAction<StudySyncPayload> => action.type === syncData.fulfilled.type

const isSyncRejected = (action: AnyAction): action is PayloadAction<string | undefined> =>
  action.type === syncData.rejected.type

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
      .addCase(syncData.pending, handleSyncPending)
      .addMatcher(isSyncFulfilled, handleSyncFulfilled)
      .addMatcher(isSyncRejected, handleSyncRejected)
  },
})

export const { setCards, setProgresses } = studySlice.actions

export default studySlice.reducer
