'use client'

import { useCallback } from "react"

import { enqueueOperation, getQueueSize } from "@/lib/sync/manager"
import type { SyncExecutionOptions } from "@/lib/sync/types"
import type { DexiePendingOperation } from "@/lib/db-dexie"
import { syncData } from "@/redux/slices/studySlice"
import { setQueueSize } from "@/redux/slices/syncSlice"
import { useAppDispatch } from "@/redux/hooks"

export const useSyncQueue = () => {
  const dispatch = useAppDispatch()

  const queueOperation = useCallback(
    async (operation: Omit<DexiePendingOperation, "id" | "createdAt">) => {
      const record = await enqueueOperation(operation)
      const size = await getQueueSize()
      dispatch(setQueueSize(size))
      return record
    },
    [dispatch],
  )

  const syncNow = useCallback(
    async (options?: SyncExecutionOptions) => {
      await dispatch(syncData(options))
      const size = await getQueueSize()
      dispatch(setQueueSize(size))
    },
    [dispatch],
  )

  return { queueOperation, syncNow }
}

export default useSyncQueue
