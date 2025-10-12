'use client'

import { useEffect, useMemo, useState } from "react"

import { useTranslations } from "next-intl"

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
import type { SafeCard, SafeTemplate } from "@/types/data"

type DashboardFeedback = {
  type: "success" | "error"
  message: string
}

interface DashboardPageProps {
  userId: string | null
}

export const DashboardPage = ({ userId }: DashboardPageProps) => {
  const dashboardT = useTranslations("dashboard")
  const formT = useTranslations("dashboard.form")
  const feedbackT = useTranslations("dashboard.feedback")
  const decks = useAppSelector((state) => state.deck.items)
  const templateState = useAppSelector((state) => state.template)
  const cardState = useAppSelector((state) => state.card)
  const templates = useMemo(
    () =>
      templateState.allIds
        .map((id) => templateState.byId[id])
        .filter(Boolean) as SafeTemplate[],
    [templateState],
  )
  const cards = useMemo(
    () =>
      cardState.allIds
        .map((id) => cardState.byId[id])
        .filter(Boolean) as SafeCard[],
    [cardState],
  )
  const templateUsage = useMemo(() => {
    return cards.reduce<Record<string, number>>((acc, card) => {
      acc[card.templateId] = (acc[card.templateId] ?? 0) + 1
      return acc
    }, {})
  }, [cards])

  const [feedback, setFeedback] = useState<DashboardFeedback | null>(null)
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

      {isAuthenticated && (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>{dashboardT("data.decks.title")}</CardTitle>
              <CardDescription>
                {dashboardT("data.decks.description", { count: decks.length })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {decks.length === 0 ? (
                <p className="text-sm text-muted-foreground">{dashboardT("data.decks.empty")}</p>
              ) : (
                <ul className="space-y-2">
                  {decks.slice(0, 5).map((deck) => (
                    <li key={deck.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{deck.name}</span>
                      <span className="text-muted-foreground">
                        {dashboardT("data.decks.cardCount", {
                          count: deck.cardCount ?? 0,
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{dashboardT("data.cards.title")}</CardTitle>
              <CardDescription>
                {dashboardT("data.cards.description", { count: cards.length })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {cards.length === 0 ? (
                <p className="text-sm text-muted-foreground">{dashboardT("data.cards.empty")}</p>
              ) : (
                <ul className="space-y-2">
                  {cards.slice(0, 5).map((card) => {
                    const templateName = templateState.byId[card.templateId]?.name
                    const deckLabel = card.deckNames?.[0] ?? dashboardT("data.cards.uncategorized")
                    return (
                      <li key={card.id} className="flex flex-col text-sm">
                        <span className="font-medium">
                          {templateName ?? dashboardT("data.cards.unknownTemplate")}
                        </span>
                        <span className="text-muted-foreground">
                          {dashboardT("data.cards.primaryDeck", { deck: deckLabel })}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{dashboardT("data.templates.title")}</CardTitle>
              <CardDescription>
                {dashboardT("data.templates.description", { count: templates.length })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {dashboardT("data.templates.empty")}
                </p>
              ) : (
                <ul className="space-y-2">
                  {templates.slice(0, 5).map((template) => (
                    <li key={template.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{template.name}</span>
                      <span className="text-muted-foreground">
                        {dashboardT("data.templates.usage", {
                          count: templateUsage[template.id] ?? 0,
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      <footer className="text-muted-foreground text-sm">
        {formT("hint")}
      </footer>
    </div>
  )
}

export default DashboardPage
