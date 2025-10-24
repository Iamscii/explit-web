'use client'

import type { CSSProperties } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { CardFace, CardRating, FieldType } from "@prisma/client"

import { Button } from "@/components/ui/button"
import CardRenderer from "@/components/card-renderer/CardRenderer"
import QuizComponent from "@/components/study/QuizComponent"
import { buildTemplateGroups, type TemplateFieldMeta } from "@/lib/templates/groups"
import { mapFieldValuesById } from "@/lib/templates/card-values"
import { parseStyleJson } from "@/lib/templates/styles"
import { useAppSelector } from "@/redux/hooks"

const BASE_CARD_CSS = `
.card-renderer {
  width: 100%;
}
.card-surface {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  border-radius: 18px;
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08);
  padding: 24px;
}
.card-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.card-section-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: #0f172a;
}
.card-fields {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}
.card-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  border-radius: 14px;
  background: rgba(148, 163, 184, 0.12);
  border: 1px solid rgba(148, 163, 184, 0.2);
  padding: 18px;
}
.card-field.card-field-rich {
  background: transparent;
  border: none;
  padding: 0;
}
.card-field.card-field-rich .card-field-value {
  background: rgba(148, 163, 184, 0.12);
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  padding: 18px;
}
.card-field-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-weight: 600;
  color: rgba(71, 85, 105, 0.85);
}
.card-field-value {
  font-size: 1.05rem;
  line-height: 1.65;
  color: #0f172a;
  white-space: pre-wrap;
  word-break: break-word;
}
.card-field-value strong {
  font-weight: 650;
}
.card-field-value em {
  font-style: italic;
}
.card-empty {
  margin: 0;
  font-size: 0.95rem;
  color: rgba(100, 116, 139, 0.9);
  font-style: italic;
}
`

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const toKebabCase = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/_/g, "-")
    .toLowerCase()

const cssPropertiesToDeclarations = (style: CSSProperties): string =>
  Object.entries(style)
    .filter(([, raw]) => raw !== undefined && raw !== null && `${raw}`.length > 0)
    .map(([property, raw]) => `${toKebabCase(property)}:${raw}`)
    .join(";")

const createCssRule = (selector: string, style: CSSProperties): string => {
  const declarations = cssPropertiesToDeclarations(style)
  return declarations.length ? `${selector}{${declarations}}` : ""
}

const stripHtmlTags = (value: string): string => value.replace(/<[^>]*>/g, "").trim()

const TEMPLATE_STYLE_ALIASES: Record<string, string> = {
  card: ".card-surface",
  cardSurface: ".card-surface",
  container: ".card-surface",
  surface: ".card-surface",
  wrapper: ".card-surface",
  section: ".card-section",
  sectionEmpty: ".card-section.card-section-empty",
  "section-empty": ".card-section.card-section-empty",
  sectionTitle: ".card-section-title",
  heading: ".card-section-title",
  questionHeading: ".card-section-title",
  answerHeading: ".card-section-title",
  fields: ".card-fields",
  field: ".card-field",
  fieldContainer: ".card-field",
  richField: ".card-field.card-field-rich",
  fieldLabel: ".card-field-label",
  label: ".card-field-label",
  fieldValue: ".card-field-value",
  value: ".card-field-value",
  body: ".card-field-value",
  text: ".card-field-value",
  richValue: ".card-field.card-field-rich .card-field-value",
  empty: ".card-empty",
  emptyState: ".card-empty",
}

const buildFieldAliasMap = (fieldId: string): Record<string, string> => {
  const base = `.card-field[data-field-id="${fieldId}"]`
  const label = `${base} .card-field-label`
  const value = `${base} .card-field-value`

  return {
    container: base,
    field: base,
    wrapper: base,
    label,
    heading: label,
    value,
    text: value,
    content: value,
    richValue: `${base}.card-field-rich .card-field-value`,
    rich: `${base}.card-field-rich .card-field-value`,
    placeholder: `${value}::placeholder`,
  }
}

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
  const progressById = useAppSelector((state) => state.userCardProgress.byId)
  const progressIdByCard = useAppSelector((state) => state.userCardProgress.idsByCard)

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
  const currentProgressId = currentCard ? progressIdByCard[currentCard.id] : undefined
  const currentProgress = currentProgressId ? progressById[currentProgressId] ?? null : null

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

  const questionFields = useMemo(
    () => templateGroups?.groups[CardFace.FRONT] ?? [],
    [templateGroups],
  )
  const answerFields = useMemo(
    () => templateGroups?.groups[CardFace.BACK] ?? [],
    [templateGroups],
  )
  const sharedFields = useMemo(
    () => templateGroups?.groups[CardFace.UNCATEGORIZED] ?? [],
    [templateGroups],
  )
  const hasAnswer = answerFields.length > 0
  const answerPreview = useMemo(() => {
    if (!answerFields.length) {
      return undefined
    }
    const parts = answerFields
      .map((meta) => {
        const raw = valueMap[meta.field.id] ?? ""
        if (!raw) {
          return ""
        }
        return meta.field.type === FieldType.RICH_TEXT ? stripHtmlTags(raw) : raw
      })
      .filter((part) => part && part.trim().length > 0)
    if (!parts.length) {
      return undefined
    }
    return parts.join(" / ")
  }, [answerFields, valueMap])

  const [showAnswer, setShowAnswer] = useState(false)

  useEffect(() => {
    setShowAnswer(false)
  }, [currentCard?.id])

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

  const handleQuizComplete = useCallback(
    (rating: CardRating) => {
      if (rating === CardRating.Manual) {
        return
      }

      setShowAnswer(false)

      if (clampedIndex >= cards.length - 1) {
        return
      }

      handleNext()
    },
    [cards.length, clampedIndex, handleNext, setShowAnswer],
  )

  const indexByFieldId = useMemo(() => {
    if (!templateGroups) {
      return {}
    }
    return templateGroups.orderedIds.reduce<Record<string, number>>((acc, fieldId, index) => {
      acc[fieldId] = index
      return acc
    }, {})
  }, [templateGroups])

  const uniqueFieldMetas = useMemo(() => {
    const map = new Map<string, TemplateFieldMeta>()

    questionFields.forEach((meta) => {
      if (!map.has(meta.field.id)) {
        map.set(meta.field.id, meta)
      }
    })

    answerFields.forEach((meta) => {
      if (!map.has(meta.field.id)) {
        map.set(meta.field.id, meta)
      }
    })

    sharedFields.forEach((meta) => {
      if (!map.has(meta.field.id)) {
        map.set(meta.field.id, meta)
      }
    })

    return Array.from(map.values())
  }, [answerFields, questionFields, sharedFields])

  const fieldMetaById = useMemo(() => {
    const map = new Map<string, TemplateFieldMeta>()
    uniqueFieldMetas.forEach((meta) => {
      map.set(meta.field.id, meta)
    })
    return map
  }, [uniqueFieldMetas])

  const displayCard = useMemo(() => {
    if (!currentCard || !templateGroups) {
      return null
    }

    const sanitizedValues = templateGroups.orderedIds.map((fieldId) => {
      const rawValue = valueMap[fieldId] ?? ""
      const meta = fieldMetaById.get(fieldId)

      if (!meta) {
        return escapeHtml(rawValue)
      }

      if (meta.field.type === FieldType.RICH_TEXT) {
        return rawValue
      }

      return escapeHtml(rawValue)
    })

    return {
      ...currentCard,
      fieldValues: sanitizedValues,
    }
  }, [currentCard, fieldMetaById, templateGroups, valueMap])

  const dynamicCardStyles = useMemo(() => {
    const segments: string[] = [BASE_CARD_CSS]

    if (template?.style) {
      const { base, rules } = parseStyleJson(template.style.stylesJson, {
        defaultSelector: ".card-surface",
        aliasMap: TEMPLATE_STYLE_ALIASES,
      })

      segments.push(createCssRule(".card-surface", base))
      segments.push(
        ...rules.map(({ selector, properties }) => createCssRule(selector, properties)),
      )
    }

    const fieldStyleSegments = uniqueFieldMetas.flatMap((meta) => {
      const styleJson = meta.preference?.styleJson
      if (!styleJson) {
        return []
      }

      const valueSelector = `.card-field[data-field-id="${meta.field.id}"] .card-field-value`
      const { base, rules } = parseStyleJson(styleJson, {
        defaultSelector: valueSelector,
        aliasMap: buildFieldAliasMap(meta.field.id),
      })

      const baseRule = createCssRule(valueSelector, base)
      const nestedRules = rules.map(({ selector, properties }) =>
        createCssRule(selector, properties),
      )

      return [baseRule, ...nestedRules]
    })

    segments.push(...fieldStyleSegments)

    return segments.filter((segment) => segment && segment.trim().length > 0).join("\n")
  }, [template, uniqueFieldMetas])

  const buildSectionHtml = useCallback(
    (fields: TemplateFieldMeta[], heading: string, emptyMessage: string) => {
      const safeHeading = escapeHtml(heading)

      if (!fields.length) {
        return `<section class="card-section card-section-empty"><h2 class="card-section-title">${safeHeading}</h2><p class="card-empty">${escapeHtml(emptyMessage)}</p></section>`
      }

      const items = fields
        .map((meta) => {
          const index = indexByFieldId[meta.field.id]
          if (index === undefined) {
            return ""
          }

          const classes = ["card-field"]
          if (meta.field.type === FieldType.RICH_TEXT) {
            classes.push("card-field-rich")
          }

          return `<div class="${classes.join(
            " ",
          )}" data-field-id="${meta.field.id}"><span class="card-field-label">${escapeHtml(
            meta.field.name,
          )}</span><div class="card-field-value">{{${index}}}</div></div>`
        })
        .filter(Boolean)
        .join("")

      if (!items.length) {
        return `<section class="card-section card-section-empty"><h2 class="card-section-title">${safeHeading}</h2><p class="card-empty">${escapeHtml(emptyMessage)}</p></section>`
      }

      return `<section class="card-section"><h2 class="card-section-title">${safeHeading}</h2><div class="card-fields">${items}</div></section>`
    },
    [indexByFieldId],
  )

  const questionTemplateHtml = useMemo(() => {
    const sections = [
      buildSectionHtml(questionFields, t("questionHeading"), t("noValue")),
    ]

    if (sharedFields.length) {
      sections.push(buildSectionHtml(sharedFields, t("sharedHeading"), t("noValue")))
    }

    return `<div class="card-surface">${sections.join("")}</div>`
  }, [buildSectionHtml, questionFields, sharedFields, t])

  const answerTemplateHtml = useMemo(() => {
    const sections = [
      buildSectionHtml(answerFields, t("answerHeading"), t("noAnswer")),
    ]

    if (sharedFields.length) {
      sections.push(buildSectionHtml(sharedFields, t("sharedHeading"), t("noValue")))
    }

    return `<div class="card-surface">${sections.join("")}</div>`
  }, [answerFields, buildSectionHtml, sharedFields, t])

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

  if (!displayCard) {
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

      <div className="flex w-full flex-col items-center gap-6">
        <div className="w-full">
          <CardRenderer
            card={displayCard}
            templateHtml={showAnswer && hasAnswer ? answerTemplateHtml : questionTemplateHtml}
            styles={dynamicCardStyles}
          />
        </div>
        <QuizComponent
          type={template.type}
          onComplete={handleQuizComplete}
          cardData={{
            userCardProgress: currentProgress,
            answer: answerPreview,
          }}
        />
      </div>
    </div>
  )
}

export default DeckStudyClient
