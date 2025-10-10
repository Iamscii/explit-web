import { configureStore } from "@reduxjs/toolkit"

import deckReducer from "./slices/deckSlice"
import studyReducer from "./slices/studySlice"
import syncReducer from "./slices/syncSlice"
import userReducer from "./slices/userSlice"

export const makeStore = () =>
  configureStore({
    reducer: {
      user: userReducer,
      deck: deckReducer,
      study: studyReducer,
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
