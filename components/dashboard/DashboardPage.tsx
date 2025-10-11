'use client'

import { useEffect, useMemo, useState } from "react"

import { useTranslations } from "next-intl"
import { useSession } from "next-auth/react"

import { AddCardDialog } from "@/components/dialog/AddCardDialog"
import { AddDeckDialog } from "@/components/dialog/AddDeckDialog"
import { AddTemplateDialog } from "@/components/dialog/AddTemplateDialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import useAddCardDialog from "@/hooks/dialog/use-add-card-dialog"
import useAddDeckDialog from "@/hooks/dialog/use-add-deck-dialog"
import useAddTemplateDialog from "@/hooks/dialog/use-add-template-dialog"
import { useAppSelector } from "@/redux/hooks"
import type { SafeTemplate } from "@/types/data"

type DashboardFeedback = {
  type: "success" | "error"
  message: string
}

export const DashboardPage = () => {
  const { data: session } = useSession()
  const dashboardT = useTranslations("dashboard")
  const formT = useTranslations("dashboard.form")
  const feedbackT = useTranslations("dashboard.feedback")
  const decks = useAppSelector((state) => state.deck.items)
  const templateState = useAppSelector((state) => state.template)
  const templates = useMemo(
    () =>
      templateState.allIds
        .map((id) => templateState.byId[id])
        .filter(Boolean) as SafeTemplate[],
    [templateState],
  )

  const [feedback, setFeedback] = useState<DashboardFeedback | null>(null)
  const userId = session?.user?.id ?? null
  const isAuthenticated = Boolean(userId)
  const addDeckDialog = useAddDeckDialog()
  const addTemplateDialog = useAddTemplateDialog()
  const addCardDialog = useAddCardDialog()

  useEffect(() => {
    if (!feedback) {
      return
    }

    const timer = window.setTimeout(() => setFeedback(null), 6000)
    return () => window.clearTimeout(timer)
  }, [feedback])

  const handleFeedback = (result: DashboardFeedback) => {
    setFeedback(result)
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{dashboardT("title")}</h1>
        <p className="text-muted-foreground text-base">{dashboardT("description")}</p>
      </header>

      {!isAuthenticated && (
        <Alert variant="destructive">
          <AlertTitle>{dashboardT("alerts.unauthenticated.title")}</AlertTitle>
          <AlertDescription>{dashboardT("alerts.unauthenticated.body")}</AlertDescription>
        </Alert>
      )}

      {feedback && (
        <Alert variant={feedback.type === "error" ? "destructive" : "default"}>
          <AlertTitle>{feedbackT(`title.${feedback.type}` as const)}</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{feedback.message}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => setFeedback(null)}
            >
              {feedbackT("dismiss")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{dashboardT("actions.decks.title")}</CardTitle>
            <CardDescription>{dashboardT("actions.decks.description")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button
              type="button"
              disabled={!isAuthenticated}
              onClick={addDeckDialog.onOpen}
            >
              {dashboardT("actions.decks.button")}
            </Button>
            <AddDeckDialog
              userId={userId}
              existingDecks={decks}
              disabled={!isAuthenticated}
              onCompleted={handleFeedback}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{dashboardT("actions.templates.title")}</CardTitle>
            <CardDescription>{dashboardT("actions.templates.description")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button
              type="button"
              disabled={!isAuthenticated}
              onClick={addTemplateDialog.onOpen}
            >
              {dashboardT("actions.templates.button")}
            </Button>
            <AddTemplateDialog
              userId={userId}
              disabled={!isAuthenticated}
              onCompleted={handleFeedback}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{dashboardT("actions.cards.title")}</CardTitle>
            <CardDescription>{dashboardT("actions.cards.description")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!decks.length && (
              <p className="text-sm text-muted-foreground">
                {dashboardT("actions.cards.noDecks")}
              </p>
            )}
            {!templates.length && (
              <p className="text-sm text-muted-foreground">
                {dashboardT("actions.cards.noTemplates")}
              </p>
            )}
            <Button
              type="button"
              disabled={!isAuthenticated}
              onClick={addCardDialog.onOpen}
            >
              {dashboardT("actions.cards.button")}
            </Button>
            <AddCardDialog
              userId={userId}
              templates={templates}
              decks={decks}
              disabled={!isAuthenticated}
              onCompleted={handleFeedback}
            />
          </CardContent>
        </Card>
      </section>

      <footer className="text-muted-foreground text-sm">
        {formT("hint")}
      </footer>
    </div>
  )
}

export default DashboardPage
