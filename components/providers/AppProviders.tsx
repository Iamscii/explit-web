'use client'

import { useEffect, useMemo } from "react"
import { Provider } from "react-redux"

import { NextIntlClientProvider } from "next-intl"
import { SessionProvider, useSession } from "next-auth/react"

import LoginDialog from "@/components/dialog/LoginDialog"
import RegisterDialog from "@/components/dialog/RegisterDialog"
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
          <LoginDialog />
          <RegisterDialog />
          {children}
        </NextIntlClientProvider>
      </Provider>
    </SessionProvider>
  )
}

const SyncRuntime = () => {
  const { status } = useSession()
  const { syncNow } = useSyncQueue()

  const isAuthenticated = status === "authenticated"

  useAutoSync({ enabled: isAuthenticated })

  useEffect(() => {
    if (!isAuthenticated) return
    void syncNow({ categories: ["hot", "warm", "cold"], reason: "bootstrap" })
  }, [isAuthenticated, syncNow])

  return null
}
