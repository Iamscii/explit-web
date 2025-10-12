import { createAsyncThunk } from "@reduxjs/toolkit"

import { performSync } from "@/lib/sync/manager"
import type { SyncExecutionOptions } from "@/lib/sync/types"
import type { SyncSnapshot } from "@/lib/sync/manager"

export interface SyncThunkArgs {
  userId: string
  options?: SyncExecutionOptions
}

export const syncData = createAsyncThunk<
  SyncSnapshot,
  SyncThunkArgs,
  { rejectValue: string }
>("sync/perform", async ({ userId, options }, { rejectWithValue }) => {
  try {
    return await performSync(userId, options ?? {})
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed"
    return rejectWithValue(message)
  }
})
