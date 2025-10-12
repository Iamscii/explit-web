'use client'

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { CardFace, FieldType } from "@prisma/client"

import { Button } from "@/components/ui/button"
import {
  Card as UiCard,
  CardContent as UiCardContent,
  CardHeader as UiCardHeader,
  CardTitle as UiCardTitle,
} from "@/components/ui/card"
import { buildTemplateGroups } from "@/lib/templates/groups"
import { mapFieldValuesById } from "@/lib/templates/card-values"
import { jsonToCssProperties } from "@/lib/templates/styles"
import { useAppSelector } from "@/redux/hooks"

interface DeckStudyClientProps {
  userId: string | null
}

export const DeckStudyClient = ({ userId }: DeckStudyClientProps) => {
  const t = useTranslations("study.deckViewer")
  const explorerT = useTranslations("study.deckExplorer")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamsString = searchParams.toString()
  const deckId = searchParams.get("deckId")

  const deckItems = useAppSelector((state) => state.deck.items)
  const deckStatus = useAppSelector((state) => state.deck.status)
  const cardIds = useAppSelector((state) => state.card.allIds)
  const cardsById = useAppSelector((state) => state.card.byId)
  const cardStatus = useAppSelector((state) => state.card.status)
  const templatesById = useAppSelector((state) => state.template.byId)
  const fieldById = useAppSelector((state) => state.field.byId)
  const fieldIdsByTemplate = useAppSelector((state) => state.field.idsByTemplate)
  const fieldPreferencesById = useAppSelector((state) => state.fieldPreference.byId)
  const fieldPreferenceIdsByTemplate = useAppSelector(
    (state) => state.fieldPreference.idsByTemplate,
  )

  const isAuthenticated = Boolean(userId)
  const deck = useMemo(
    () => deckItems.find((item) => item.id === deckId) ?? null,
    [deckId, deckItems],
  )

  const cards = useMemo(() => {
    if (!deckId) {
      return []
    }

    return cardIds
      .map((id) => cardsById[id])
      .filter(
        (card): card is NonNullable<(typeof cardsById)[string]> =>
          Boolean(card) && card.primaryDeckId === deckId,
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [cardIds, cardsById, deckId])

  const indexFromParams = searchParams.get("cardIndex")
  const parsedIndex =
    typeof indexFromParams === "string" ? Number.parseInt(indexFromParams, 10) : 0
  const safeIndex = Number.isFinite(parsedIndex) ? parsedIndex : 0
  const clampedIndex =
    cards.length > 0 ? Math.min(Math.max(safeIndex, 0), cards.length - 1) : 0

  useEffect(() => {
    if (!deckId || !cards.length) {
      return
    }

    if (clampedIndex !== safeIndex) {
      const next = new URLSearchParams(searchParamsString)
      next.set("deckId", deckId)
      next.set("cardIndex", String(clampedIndex))
      const queryString = next.toString()
      const target = queryString ? `${pathname}?${queryString}` : pathname
      router.replace(target, { scroll: false })
    }
  }, [cards.length, clampedIndex, deckId, pathname, router, safeIndex, searchParamsString])

  const currentCard = cards[clampedIndex] ?? null
  const template = currentCard ? templatesById[currentCard.templateId] ?? null : null

  const templateGroups = useMemo(() => {
    if (!currentCard) {
      return null
    }

    return buildTemplateGroups(
      currentCard.templateId,
      fieldById,
      fieldIdsByTemplate,
      fieldPreferencesById,
      fieldPreferenceIdsByTemplate,
    )
  }, [
    currentCard,
    fieldById,
    fieldIdsByTemplate,
    fieldPreferenceIdsByTemplate,
    fieldPreferencesById,
  ])

  const valueMap = useMemo(() => {
    if (!currentCard || !templateGroups) {
      return {}
    }
    return mapFieldValuesById(currentCard, templateGroups.orderedIds)
  }, [currentCard, templateGroups])

  const questionFields = templateGroups?.groups[CardFace.FRONT] ?? []
  const answerFields = templateGroups?.groups[CardFace.BACK] ?? []
  const sharedFields = templateGroups?.groups[CardFace.UNCATEGORIZED] ?? []
  const hasAnswer = answerFields.length > 0

  const [showAnswer, setShowAnswer] = useState(false)

  useEffect(() => {
    setShowAnswer(false)
  }, [currentCard?.id])

  const cardStyle = template?.style ? jsonToCssProperties(template.style.stylesJson) : {}

  const isLoading =
    deckStatus === "idle" ||
    deckStatus === "loading" ||
    cardStatus === "idle" ||
    cardStatus === "loading"

  const updateCardIndex = useCallback(
    (nextIndex: number) => {
      if (!deckId || !cards.length) {
        return
      }
      const clamped = Math.min(Math.max(nextIndex, 0), cards.length - 1)
      const next = new URLSearchParams(searchParamsString)
      next.set("deckId", deckId)
      next.set("cardIndex", String(clamped))
      const queryString = next.toString()
      const target = queryString ? `${pathname}?${queryString}` : pathname
      router.push(target, { scroll: false })
    },
    [cards.length, deckId, pathname, router, searchParamsString],
  )

  const handlePrevious = useCallback(() => updateCardIndex(clampedIndex - 1), [
    clampedIndex,
    updateCardIndex,
  ])
  const handleNext = useCallback(() => updateCardIndex(clampedIndex + 1), [
    clampedIndex,
    updateCardIndex,
  ])

  const handleReturn = useCallback(() => {
    if (!deckId) {
      router.push("/", { scroll: false })
      return
    }
    const next = new URLSearchParams({ category: deckId })
    router.push(`/?${next.toString()}`, { scroll: false })
  }, [deckId, router])

  const renderField = useCallback(
    (fieldMeta: (typeof questionFields)[number]) => {
      const style = jsonToCssProperties(fieldMeta.preference?.styleJson ?? null)
      const value = valueMap[fieldMeta.field.id]
      const isRich = fieldMeta.field.type === FieldType.RICH_TEXT

      return (
        <div key={fieldMeta.field.id} className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {fieldMeta.field.name}
          </span>
          <div
            className="rounded-lg border border-border/60 bg-card/40 p-3 text-sm leading-relaxed shadow-sm"
            style={style}
          >
            {value ? (
              isRich ? (
                <div dangerouslySetInnerHTML={{ __html: value }} />
              ) : (
                <p className="whitespace-pre-wrap break-words">{value}</p>
              )
            ) : (
              <p className="text-muted-foreground italic">{t("noValue")}</p>
            )}
          </div>
        </div>
      )
    },
    [t, valueMap],
  )

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {t("signInRequired")}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {t("loading")}
        </div>
      </div>
    )
  }

  if (!deckId) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive p-10 text-center text-sm font-medium">
          {t("missingDeck")}
        </div>
      </div>
    )
  }

  if (!deck) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-xl border border-destructive p-10 text-center text-sm font-medium">
          {t("missingDeck")}
        </div>
      </div>
    )
  }

  if (!cards.length) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10 space-y-4">
        <Button variant="ghost" className="pl-0" onClick={handleReturn}>
          ← {t("backToDecks")}
        </Button>
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      </div>
    )
  }

  if (!currentCard || !template || !templateGroups) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10 space-y-4">
        <Button variant="ghost" className="pl-0" onClick={handleReturn}>
          ← {t("backToDecks")}
        </Button>
        <div className="rounded-xl border border-destructive p-10 text-center text-sm font-medium">
          {t("missingTemplate")}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" className="pl-0" onClick={handleReturn}>
            ← {t("backToDecks")}
          </Button>
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("heading", {
              deck: deck.name,
              index: clampedIndex + 1,
              total: cards.length,
            })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {deck.description ?? explorerT("deckDescriptionFallback")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevious}
            disabled={clampedIndex === 0}
          >
            {t("previous")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={clampedIndex >= cards.length - 1}
          >
            {t("next")}
          </Button>
          {hasAnswer && (
            <Button variant="default" size="sm" onClick={() => setShowAnswer((prev) => !prev)}>
              {showAnswer ? t("showQuestion") : t("showAnswer")}
            </Button>
          )}
        </div>
      </div>

      <UiCard style={cardStyle}>
        <UiCardHeader className="space-y-3">
          <UiCardTitle className="text-lg font-semibold tracking-tight">
            {showAnswer && hasAnswer ? t("answerHeading") : t("questionHeading")}
          </UiCardTitle>
          <div className="space-y-4">
            {(showAnswer && hasAnswer ? answerFields : questionFields).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {showAnswer && hasAnswer ? t("noAnswer") : t("noValue")}
              </p>
            ) : (
              (showAnswer && hasAnswer ? answerFields : questionFields).map(renderField)
            )}
          </div>
        </UiCardHeader>
        {sharedFields.length > 0 && (
          <UiCardContent className="space-y-3 border-t border-border/60 pt-6">
            <h2 className="text-base font-semibold tracking-tight">{t("sharedHeading")}</h2>
            <div className="space-y-4">
              {sharedFields.map(renderField)}
            </div>
          </UiCardContent>
        )}
      </UiCard>
    </div>
  )
}

export default DeckStudyClient
