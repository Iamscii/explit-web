import { configureStore } from "@reduxjs/toolkit"

import cardReducer from "./slices/cardSlice"
import deckReducer from "./slices/deckSlice"
import fieldPreferenceReducer from "./slices/fieldPreferenceSlice"
import fieldReducer from "./slices/fieldSlice"
import studyReducer from "./slices/studySlice"
import studySessionReducer from "./slices/studySessionSlice"
import syncReducer from "./slices/syncSlice"
import templateReducer from "./slices/templateSlice"
import userCardProgressReducer from "./slices/userCardProgressSlice"
import userPreferencesReducer from "./slices/userPreferencesSlice"
import userReducer from "./slices/userSlice"

export const makeStore = () =>
  configureStore({
    reducer: {
      user: userReducer,
      deck: deckReducer,
      card: cardReducer,
      template: templateReducer,
      field: fieldReducer,
      fieldPreference: fieldPreferenceReducer,
      userCardProgress: userCardProgressReducer,
      userPreferences: userPreferencesReducer,
      study: studyReducer,
      studySession: studySessionReducer,
      sync: syncReducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
      }),
  })

export type AppStore = ReturnType<typeof makeStore>
export type AppDispatch = AppStore["dispatch"]
export type RootState = ReturnType<AppStore["getState"]>
