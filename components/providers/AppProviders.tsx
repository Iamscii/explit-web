'use client'

import { useCallback, useEffect, useMemo, useState } from "react"
import { Provider } from "react-redux"

import { NextIntlClientProvider } from "next-intl"
import { SessionProvider, useSession } from "next-auth/react"

import LoginDialog from "@/components/dialog/LoginDialog"
import RegisterDialog from "@/components/dialog/RegisterDialog"
import useAutoSync from "@/hooks/use-auto-sync"
import useSyncQueue from "@/hooks/use-sync-queue"
import { readDexieCollections, getQueueSize } from "@/lib/sync/manager"
import { useAppDispatch, useAppSelector } from "@/redux/hooks"
import { setQueueSize } from "@/redux/slices/syncSlice"
import { setDecks } from "@/redux/slices/deckSlice"
import { setCards } from "@/redux/slices/cardSlice"
import { setTemplates } from "@/redux/slices/templateSlice"
import { setFields, clearFields } from "@/redux/slices/fieldSlice"
import {
  setFieldPreferences,
  clearFieldPreferences,
} from "@/redux/slices/fieldPreferenceSlice"
import { clearUserCardProgress, setUserCardProgresses } from "@/redux/slices/userCardProgressSlice"
import { setUserPreferences } from "@/redux/slices/userPreferencesSlice"
import { clearUser, setUser } from "@/redux/slices/userSlice"
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
          <SessionStateBridge />
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
  const dispatch = useAppDispatch()
  const userId = useAppSelector((state) => state.user.profile?.id ?? null)
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null)

  const isAuthenticated = status === "authenticated"

  useAutoSync({ enabled: isAuthenticated })

  const clearStudyState = useCallback(() => {
    dispatch(setDecks([]))
    dispatch(setCards([]))
    dispatch(setTemplates({ templates: [], styles: [] }))
    dispatch(clearFields())
    dispatch(clearFieldPreferences())
    dispatch(clearUserCardProgress())
    dispatch(setUserPreferences(null))
    dispatch(setQueueSize(0))
  }, [dispatch])

  useEffect(() => {
    if (!userId) {
      if (hydratedUserId !== null) {
        clearStudyState()
        setHydratedUserId(null)
      }
      return
    }

    if (hydratedUserId && hydratedUserId !== userId) {
      clearStudyState()
      setHydratedUserId(null)
    }

    if (hydratedUserId === userId) {
      return
    }

    let cancelled = false

    const hydrateFromDexie = async () => {
      try {
        const [collections, pendingCount] = await Promise.all([
          readDexieCollections(userId),
          getQueueSize(userId),
        ])

        if (cancelled) {
          return
        }

        dispatch(setDecks(collections.decks))
        dispatch(setCards(collections.cards))
        dispatch(setTemplates({ templates: collections.templates, styles: collections.styles }))
        dispatch(setFields(collections.fields))
        dispatch(setFieldPreferences(collections.fieldPreferences))
        dispatch(setUserCardProgresses(collections.progresses))
        dispatch(setUserPreferences(collections.userPreferences[0] ?? null))
        dispatch(setQueueSize(pendingCount))
        setHydratedUserId(userId)
      } catch (error) {
        console.error("Dexie hydration failed", error)
      }
    }

    void hydrateFromDexie()

    return () => {
      cancelled = true
    }
  }, [
    clearStudyState,
    dispatch,
    hydratedUserId,
    userId,
  ])

  useEffect(() => {
    if (!isAuthenticated || !userId) return
    void syncNow({ categories: ["hot", "warm", "cold"], reason: "bootstrap" })
  }, [isAuthenticated, syncNow, userId])

  return null
}

const SessionStateBridge = () => {
  const { data: session, status } = useSession()
  const dispatch = useAppDispatch()

  useEffect(() => {
    if (status === "loading") {
      return
    }

    const user = session?.user

    if (user?.id) {
      dispatch(
        setUser({
          id: user.id,
          name: user.name ?? null,
          email: user.email ?? null,
          image: user.image ?? undefined,
        }),
      )
    } else {
      dispatch(clearUser())
      dispatch(setQueueSize(0))
    }
  }, [dispatch, session, status])

  return null
}
