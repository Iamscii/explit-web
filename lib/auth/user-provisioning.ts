import { CardFace, DeckType, FieldType, Prisma, TemplateType } from "@prisma/client"

import prisma from "@/lib/prisma"

type Transaction = Prisma.TransactionClient

// 15秒超时，5秒等待
const PROVISION_TRANSACTION_OPTIONS = {
  timeout: 15_000,
  maxWait: 5_000,
} as const

// 30秒超时，5秒等待
const PROVISION_TRANSACTION_RETRY_OPTIONS = {
  timeout: 30_000,
  maxWait: 5_000,
} as const

const DEFAULT_TEMPLATE_STYLE: Prisma.JsonObject = {
  backgroundColor: "#FFFFFF",
  borderRadius: "12px",
  border: "1px solid #E5E7EB",
  boxShadow: "0px 8px 16px rgba(15, 23, 42, 0.08)",
  padding: "24px",
  gap: "16px",
  fontFamily: "Inter, system-ui, sans-serif",
}

const DEFAULT_FIELD_STYLE: Prisma.JsonObject = {
  color: "#111827",
  fontSize: "16px",
  textAlign: "left",
  fontWeight: 500,
}

const DEFAULT_USER_PREFERENCES = {
  preferredLanguage: "en",
  interfaceTheme: "system",
  defaultLLMModel: "openrouter:openai/gpt-4o-mini",
  notifications: true,
  spacedRepetition: "fsrs",
  cardDisplayOrder: "created-desc",
  reviewFrequency: "daily",
  cardLimitPerSession: 20,
} satisfies Omit<Prisma.UserPreferencesCreateInput, "user">

const createTemplateWithDefaults = async (tx: Transaction, userId: string) => {
  const template = await tx.template.create({
    data: {
      name: "Quick Card",
      description: "A two-sided template for short-form questions.",
      createdById: userId,
      ownedById: userId,
      type: TemplateType.BASIC,
    },
  })

  const [questionField, answerField] = await Promise.all([
    tx.field.create({
      data: {
        name: "Question",
        type: FieldType.TEXT,
        templateId: template.id,
      },
    }),
    tx.field.create({
      data: {
        name: "Answer",
        type: FieldType.TEXT,
        templateId: template.id,
      },
    }),
  ])

  await Promise.all([
    tx.fieldPreference.create({
      data: {
        fieldId: questionField.id,
        templateId: template.id,
        face: CardFace.FRONT,
        position: 0,
        styleJson: DEFAULT_FIELD_STYLE,
      },
    }),
    tx.fieldPreference.create({
      data: {
        fieldId: answerField.id,
        templateId: template.id,
        face: CardFace.BACK,
        position: 0,
        styleJson: DEFAULT_FIELD_STYLE,
      },
    }),
  ])

  const style = await tx.style.create({
    data: {
      templateId: template.id,
      stylesJson: DEFAULT_TEMPLATE_STYLE,
    },
  })

  await tx.template.update({
    where: { id: template.id },
    data: { styleId: style.id },
  })
}

const createChoiceTemplate = async (tx: Transaction, userId: string) => {
  const template = await tx.template.create({
    data: {
      name: "Multiple Choice",
      description: "Preset template with options and the correct answer.",
      createdById: userId,
      ownedById: userId,
      type: TemplateType.CHOICE,
    },
  })

  const [questionField, optionsField, answerField] = await Promise.all([
    tx.field.create({
      data: {
        name: "Question",
        type: FieldType.TEXT,
        templateId: template.id,
      },
    }),
    tx.field.create({
      data: {
        name: "Options",
        type: FieldType.CHOICE,
        templateId: template.id,
      },
    }),
    tx.field.create({
      data: {
        name: "Correct Answer",
        type: FieldType.TEXT,
        templateId: template.id,
      },
    }),
  ])

  await Promise.all([
    tx.fieldPreference.create({
      data: {
        fieldId: questionField.id,
        templateId: template.id,
        face: CardFace.FRONT,
        position: 0,
        styleJson: DEFAULT_FIELD_STYLE,
      },
    }),
    tx.fieldPreference.create({
      data: {
        fieldId: optionsField.id,
        templateId: template.id,
        face: CardFace.BACK,
        position: 0,
        styleJson: DEFAULT_FIELD_STYLE,
      },
    }),
    tx.fieldPreference.create({
      data: {
        fieldId: answerField.id,
        templateId: template.id,
        face: CardFace.BACK,
        position: 1,
        styleJson: DEFAULT_FIELD_STYLE,
      },
    }),
  ])

  const style = await tx.style.create({
    data: {
      templateId: template.id,
      stylesJson: DEFAULT_TEMPLATE_STYLE,
    },
  })

  await tx.template.update({
    where: { id: template.id },
    data: { styleId: style.id },
  })
}

const createDefaultDecks = async (tx: Transaction, userId: string) => {
  const rootDeck = await tx.deck.create({
    data: {
      name: "All Cards",
      type: DeckType.ALL,
      createdById: userId,
      ownedById: userId,
      favorited: false,
    },
  })

  const groups = [
    { name: "Uncategorized", type: DeckType.UNCATEGORIZED },
    { name: "Deleted", type: DeckType.DELETED },
  ]

  await Promise.all(
    groups.map((group) =>
      tx.deck.create({
        data: {
          name: group.name,
          type: group.type,
          createdById: userId,
          ownedById: userId,
          parentId: rootDeck.id,
          favorited: false,
        },
      }),
    ),
  )
}

const createUserPreferences = async (tx: Transaction, userId: string) => {
  await tx.userPreferences.create({
    data: {
      userId,
      ...DEFAULT_USER_PREFERENCES,
    },
  })
}

const createUpdateLog = async (tx: Transaction, userId: string) => {
  const currentIso = new Date().toISOString()
  const modelUpdates: Prisma.JsonObject = {
    card: currentIso,
    deck: currentIso,
    template: currentIso,
    field: currentIso,
    fieldPreference: currentIso,
    style: currentIso,
    userCardProgress: currentIso,
    userPreferences: currentIso,
  }

  await tx.updateLog.create({
    data: {
      userId,
      modelUpdates,
    },
  })
}

const ensureProvisionedForUser = async (tx: Transaction, userId: string) => {
  if (!userId) {
    return
  }

  const [existingPreferences, existingUpdateLog] = await Promise.all([
    tx.userPreferences.findUnique({ where: { userId } }),
    tx.updateLog.findUnique({ where: { userId } }),
  ])

  const existingDeck = await tx.deck.findFirst({
    where: { ownedById: userId, type: DeckType.ALL },
  })

  if (!existingDeck) {
    await createDefaultDecks(tx, userId)
  }

  if (!existingPreferences) {
    await createUserPreferences(tx, userId)
  }

  if (!existingUpdateLog) {
    await createUpdateLog(tx, userId)
  }

  const existingTemplates = await tx.template.count({ where: { ownedById: userId } })

  if (existingTemplates === 0) {
    await Promise.all([createTemplateWithDefaults(tx, userId), createChoiceTemplate(tx, userId)])
  }
}

export const provisionUserResources = async (userId: string) => {
  if (!userId) {
    return
  }

  const runProvisioning = (options: { timeout: number; maxWait: number }) =>
    prisma.$transaction(async (tx) => {
      await ensureProvisionedForUser(tx, userId)
    }, options)

  try {
    await runProvisioning(PROVISION_TRANSACTION_OPTIONS)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2028") {
      console.warn("Provisioning transaction timed out, retrying with extended timeout", {
        userId,
      })
      await runProvisioning(PROVISION_TRANSACTION_RETRY_OPTIONS)
      return
    }

    throw error
  }
}

export default provisionUserResources
