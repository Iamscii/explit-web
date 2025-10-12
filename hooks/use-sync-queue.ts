'use client'

import { useCallback } from "react"

import { enqueueOperation, getQueueSize } from "@/lib/sync/manager"
import type { SyncExecutionOptions } from "@/lib/sync/types"
import type { DexiePendingOperation } from "@/lib/db-dexie"
import { syncData } from "@/redux/thunks/syncThunks"
import { setQueueSize } from "@/redux/slices/syncSlice"
import { useAppDispatch, useAppSelector } from "@/redux/hooks"

export const useSyncQueue = () => {
  const dispatch = useAppDispatch()
  const userId = useAppSelector((state) => state.user.profile?.id ?? null)

  const queueOperation = useCallback(
    async (operation: Omit<DexiePendingOperation, "id" | "createdAt" | "userId">) => {
      if (!userId) {
        throw new Error("Cannot queue sync operation without an authenticated user")
      }

      const record = await enqueueOperation(userId, operation)
      const size = await getQueueSize(userId)
      dispatch(setQueueSize(size))
      return record
    },
    [dispatch, userId],
  )

  const syncNow = useCallback(
    async (options?: SyncExecutionOptions) => {
      if (!userId) return
      await dispatch(syncData({ userId, options }))
      const size = await getQueueSize(userId)
      dispatch(setQueueSize(size))
    },
    [dispatch, userId],
  )

  return { queueOperation, syncNow }
}

export default useSyncQueue
