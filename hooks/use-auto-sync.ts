'use client'

import { useCallback, useEffect, useRef } from "react"

import type { SyncExecutionOptions } from "@/lib/sync/types"
import useSyncQueue from "@/hooks/use-sync-queue"

const DEFAULT_HOT_INTERVAL = 60_000
const DEFAULT_WARM_INTERVAL = 5 * 60_000

export interface AutoSyncOptions {
  hotInterval?: number
  warmInterval?: number
  enabled?: boolean
}

export const useAutoSync = (options: AutoSyncOptions = {}) => {
  const { syncNow } = useSyncQueue()
  const hotInterval = options.hotInterval ?? DEFAULT_HOT_INTERVAL
  const warmInterval = options.warmInterval ?? DEFAULT_WARM_INTERVAL
  const enabled = options.enabled ?? true
  const visibilityRef = useRef(false)

  const runSync = useCallback(
    (syncOptions: SyncExecutionOptions) => {
      if (!enabled) return
      void syncNow(syncOptions)
    },
    [enabled, syncNow],
  )

  useEffect(() => {
    if (!enabled) {
      visibilityRef.current = false
      return
    }

    const syncHot = () => runSync({ categories: ["hot"], reason: "hot-interval" })
    const syncWarm = () => runSync({ categories: ["hot", "warm"], reason: "warm-interval" })

    const hotTimer = setInterval(syncHot, hotInterval)
    const warmTimer = setInterval(syncWarm, warmInterval)

    return () => {
      clearInterval(hotTimer)
      clearInterval(warmTimer)
    }
  }, [enabled, hotInterval, warmInterval, runSync])

  useEffect(() => {
    if (!enabled) {
      visibilityRef.current = false
      return
    }

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
  }, [enabled, runSync])
}

export default useAutoSync
