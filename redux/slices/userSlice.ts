import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

export interface UserProfile {
  id: string
  name: string | null
  email: string | null
  image?: string | null
}

export type UserStatus = "idle" | "loading" | "authenticated"

interface UserState {
  status: UserStatus
  profile: UserProfile | null
}

const initialState: UserState = {
  status: "idle",
  profile: null,
}

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<UserProfile | null>) {
      state.profile = action.payload
      state.status = action.payload ? "authenticated" : "idle"
    },
    setStatus(state, action: PayloadAction<UserStatus>) {
      state.status = action.payload
    },
    clearUser(state) {
      state.profile = null
      state.status = "idle"
    },
  },
})

export const { setUser, setStatus, clearUser } = userSlice.actions

export default userSlice.reducer
