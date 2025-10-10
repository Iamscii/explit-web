'use client'

import { useCallback, useEffect, useRef } from "react"

import type { SyncExecutionOptions } from "@/lib/sync/types"
import useSyncQueue from "@/hooks/use-sync-queue"

const DEFAULT_HOT_INTERVAL = 60_000
const DEFAULT_WARM_INTERVAL = 5 * 60_000

export interface AutoSyncOptions {
  hotInterval?: number
  warmInterval?: number
}

export const useAutoSync = (options: AutoSyncOptions = {}) => {
  const { syncNow } = useSyncQueue()
  const hotInterval = options.hotInterval ?? DEFAULT_HOT_INTERVAL
  const warmInterval = options.warmInterval ?? DEFAULT_WARM_INTERVAL
  const visibilityRef = useRef(false)

  const runSync = useCallback(
    (syncOptions: SyncExecutionOptions) => {
      void syncNow(syncOptions)
    },
    [syncNow],
  )

  useEffect(() => {
    const syncHot = () => runSync({ categories: ["hot"], reason: "hot-interval" })
    const syncWarm = () => runSync({ categories: ["hot", "warm"], reason: "warm-interval" })

    const hotTimer = setInterval(syncHot, hotInterval)
    const warmTimer = setInterval(syncWarm, warmInterval)

    return () => {
      clearInterval(hotTimer)
      clearInterval(warmTimer)
    }
  }, [hotInterval, warmInterval, runSync])

  useEffect(() => {
    const handleOnline = () => runSync({ categories: ["hot", "warm"], reason: "network-online" })
    const handleVisibility = () => {
      const isVisible = document.visibilityState === "visible"
      if (isVisible && !visibilityRef.current) {
        runSync({ categories: ["hot", "warm", "cold"], reason: "app-visible" })
      }
      visibilityRef.current = isVisible
    }

    window.addEventListener("online", handleOnline)
    document.addEventListener("visibilitychange", handleVisibility)

    handleVisibility()

    return () => {
      window.removeEventListener("online", handleOnline)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [runSync])
}

export default useAutoSync
