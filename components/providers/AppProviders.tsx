'use client'

import { useEffect, useMemo } from "react"
import { Provider } from "react-redux"

import { NextIntlClientProvider } from "next-intl"
import { SessionProvider } from "next-auth/react"

import useAutoSync from "@/hooks/use-auto-sync"
import useSyncQueue from "@/hooks/use-sync-queue"
import { makeStore } from "@/redux/store"

const DEFAULT_TIME_ZONE = process.env.NEXT_PUBLIC_DEFAULT_TIME_ZONE ?? "UTC"

interface AppProvidersProps {
  locale: string
  messages: Record<string, unknown>
  children: React.ReactNode
}

export function AppProviders({ locale, messages, children }: AppProvidersProps) {
  const store = useMemo(() => makeStore(), [])

  return (
    <SessionProvider>
      <Provider store={store}>
        <NextIntlClientProvider locale={locale} messages={messages} timeZone={DEFAULT_TIME_ZONE}>
          <SyncRuntime />
          {children}
        </NextIntlClientProvider>
      </Provider>
    </SessionProvider>
  )
}

const SyncRuntime = () => {
  const { syncNow } = useSyncQueue()

  useAutoSync()

  useEffect(() => {
    void syncNow({ categories: ["hot", "warm", "cold"], reason: "bootstrap" })
  }, [syncNow])

  return null
}
