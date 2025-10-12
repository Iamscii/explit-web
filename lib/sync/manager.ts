'use client'

import dexieDb, {
  type DexieMetadataRecord,
  type DexiePendingOperation,
} from "@/lib/db-dexie"
import {
  mapSafeCardToDexieRecord,
  mapSafeDeckToDexieRecord,
  mapSafeFieldPreferenceToDexieRecord,
  mapSafeFieldToDexieRecord,
  mapSafeProgressToDexieRecord,
  mapSafeStyleToDexieRecord,
  mapSafeTemplateToDexieRecord,
  mapSafeUserPreferencesToDexieRecord,
} from "@/lib/sync/mappers"
import type {
  SyncCursorMap,
  SyncExecutionOptions,
  SyncOperationPayload,
  SyncResponsePayload,
} from "@/lib/sync/types"
import type {
  SafeCard,
  SafeDeck,
  SafeField,
  SafeFieldPreference,
  SafeStyle,
  SafeTemplate,
  SafeUserCardProgress,
  SafeUserPreferences,
} from "@/types/data"

export interface DexieCollections {
  cards: SafeCard[]
  decks: SafeDeck[]
  templates: SafeTemplate[]
  fields: SafeField[]
  fieldPreferences: SafeFieldPreference[]
  styles: SafeStyle[]
  progresses: SafeUserCardProgress[]
  userPreferences: SafeUserPreferences[]
}

export interface SyncSnapshot {
  cards: SafeCard[]
  decks: SafeDeck[]
  templates: SafeTemplate[]
  fields: SafeField[]
  fieldPreferences: SafeFieldPreference[]
  styles: SafeStyle[]
  progresses: SafeUserCardProgress[]
  userPreferences: SafeUserPreferences[]
  queueSize: number
  deviceId: string
  cursors: SyncCursorMap
  appliedOperationIds: string[]
  timestamp: string
}

const DEVICE_METADATA_KEY = "device-id"
const CURSOR_METADATA_PREFIX = "cursor:"
const LAST_SYNC_PREFIX = "last-sync-at:"

const cursorKey = (userId: string, category: string) =>
  `${CURSOR_METADATA_PREFIX}${userId}:${category}`
const cursorPrefixForUser = (userId: string) => `${CURSOR_METADATA_PREFIX}${userId}:`
const lastSyncKey = (userId: string) => `${LAST_SYNC_PREFIX}${userId}`

const ensureDeviceId = async (): Promise<string> => {
  const existing = await dexieDb.metadata.get(DEVICE_METADATA_KEY)
  if (existing?.value) {
    return existing.value
  }

  const newId = crypto.randomUUID()
  await dexieDb.metadata.put({ key: DEVICE_METADATA_KEY, value: newId })
  return newId
}

const readCursors = async (userId: string): Promise<SyncCursorMap> => {
  const prefix = cursorPrefixForUser(userId)
  const records = await dexieDb.metadata.where("key").startsWith(prefix).toArray()

  return records.reduce<SyncCursorMap>((acc, record) => {
    const [, , category] = record.key.split(":")
    if (category) {
      acc[category as keyof SyncCursorMap] = record.value
    }
    return acc
  }, {})
}

const writeCursors = async (userId: string, cursors: SyncCursorMap) => {
  const entries: DexieMetadataRecord[] = Object.entries(cursors)
    .filter(([, value]) => Boolean(value))
    .map(([category, value]) => ({
      key: cursorKey(userId, category),
      value: value as string,
    }))

  if (!entries.length) return

  await dexieDb.metadata.bulkPut(entries)
}

export const enqueueOperation = async (
  userId: string,
  operation: Omit<DexiePendingOperation, "id" | "createdAt" | "userId">,
) => {
  const record: DexiePendingOperation = {
    ...operation,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    userId,
  }

  await dexieDb.pendingOperations.put(record)

  return record
}

export const readDexieCollections = async (userId: string): Promise<DexieCollections> => {
  const [
    cardRecords,
    deckRecords,
    templateRecords,
    fieldRecords,
    fieldPreferenceRecords,
    styleRecords,
    progressRecords,
    userPreferenceRecords,
  ] = await Promise.all([
    dexieDb.cards.where("userId").equals(userId).toArray(),
    dexieDb.decks.where("userId").equals(userId).toArray(),
    dexieDb.templates.where("userId").equals(userId).toArray(),
    dexieDb.fields.where("userId").equals(userId).toArray(),
    dexieDb.fieldPreferences.where("userId").equals(userId).toArray(),
    dexieDb.styles.where("userId").equals(userId).toArray(),
    dexieDb.progresses.where("userId").equals(userId).toArray(),
    dexieDb.userPreferences.where("userId").equals(userId).toArray(),
  ])

  return {
    cards: cardRecords.map((record) => record.payload),
    decks: deckRecords.map((record) => record.payload),
    templates: templateRecords.map((record) => record.payload),
    fields: fieldRecords.map((record) => record.payload),
    fieldPreferences: fieldPreferenceRecords.map((record) => record.payload),
    styles: styleRecords.map((record) => record.payload),
    progresses: progressRecords.map((record) => record.payload),
    userPreferences: userPreferenceRecords.map((record) => record.payload),
  }
}

const fetchSync = async (body: unknown) => {
  const response = await fetch("/api/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`Sync request failed with status ${response.status}`)
  }

  return (await response.json()) as SyncResponsePayload
}

export const performSync = async (
  userId: string,
  options: SyncExecutionOptions = {},
): Promise<SyncSnapshot> => {
  if (!userId) {
    throw new Error("performSync requires a userId")
  }

  const deviceId = await ensureDeviceId()
  const cursors = await readCursors(userId)

  const operations = await dexieDb.pendingOperations.where("userId").equals(userId).sortBy("createdAt")
  const filteredOperations = (
    options.categories && options.categories.length
      ? operations.filter((operation) => options.categories?.includes(operation.category))
      : operations
  ).map((operation) => {
    const { userId: _userId, ...rest } = operation
    void _userId
    return rest as SyncOperationPayload
  })

  const payload = {
    deviceId,
    operations: filteredOperations,
    cursors,
    options,
  }

  const response = await fetchSync(payload)

  const cards = (response.collections.cards ?? []) as SafeCard[]
  const decks = (response.collections.decks ?? []) as SafeDeck[]
  const templates = (response.collections.templates ?? []) as SafeTemplate[]
  const styles = (response.collections.styles ?? []) as SafeStyle[]
  const fields = (response.collections.fields ?? []) as SafeField[]
  const fieldPreferences = (response.collections.fieldPreferences ?? []) as SafeFieldPreference[]
  const progresses = (response.collections.progresses ?? []) as SafeUserCardProgress[]
  const userPreferences = (response.collections.userPreferences ?? []) as SafeUserPreferences[]

  const safeDecks = decks.filter((deck) => deck.ownedById === userId)
  const safeTemplates = templates.filter((template) => template.ownedById === userId)
  const templateOwnerById = safeTemplates.reduce<Record<string, string>>((acc, template) => {
    acc[template.id] = template.ownedById
    return acc
  }, {})

  const safeStyles = styles.filter((style) => templateOwnerById[style.templateId] === userId)
  const safeFields = fields.filter((field) => templateOwnerById[field.templateId] === userId)
  const safeFieldPreferences = fieldPreferences.filter(
    (preference) => templateOwnerById[preference.templateId] === userId,
  )
  const safeCards = cards.filter((card) => card.ownedById === userId)
  const safeProgresses = progresses.filter((progress) => progress.userId === userId)
  const safeUserPreferences = userPreferences.filter((preference) => preference.userId === userId)

  const styleMap = safeStyles.reduce<Record<string, SafeStyle>>((acc, style) => {
    acc[style.templateId] = style
    return acc
  }, {})

  const templatesWithStyles = safeTemplates.map((template) => {
    const style = styleMap[template.id]
    if (style && !template.style) {
      return { ...template, style }
    }
    return template
  })

  await dexieDb.transaction(
    "rw",
    [
      dexieDb.cards,
      dexieDb.decks,
      dexieDb.templates,
      dexieDb.fields,
      dexieDb.fieldPreferences,
      dexieDb.styles,
      dexieDb.progresses,
      dexieDb.userPreferences,
      dexieDb.pendingOperations,
      dexieDb.metadata,
    ],
    async () => {
      if (safeCards.length) {
        await dexieDb.cards.bulkPut(safeCards.map(mapSafeCardToDexieRecord))
      }

      if (safeDecks.length) {
        await dexieDb.decks.bulkPut(safeDecks.map(mapSafeDeckToDexieRecord))
      }

      if (templatesWithStyles.length) {
        await dexieDb.templates.bulkPut(templatesWithStyles.map(mapSafeTemplateToDexieRecord))
      }

      if (safeFields.length) {
        await dexieDb.fields.bulkPut(
          safeFields.map((field) =>
            mapSafeFieldToDexieRecord(field, templateOwnerById[field.templateId] ?? userId),
          ),
        )
      }

      if (safeFieldPreferences.length) {
        await dexieDb.fieldPreferences.bulkPut(
          safeFieldPreferences.map((preference) =>
            mapSafeFieldPreferenceToDexieRecord(
              preference,
              templateOwnerById[preference.templateId] ?? userId,
            ),
          ),
        )
      }

      if (safeStyles.length) {
        await dexieDb.styles.bulkPut(
          safeStyles.map((style) =>
            mapSafeStyleToDexieRecord(style, templateOwnerById[style.templateId] ?? userId),
          ),
        )
      }

      if (safeProgresses.length) {
        await dexieDb.progresses.bulkPut(safeProgresses.map(mapSafeProgressToDexieRecord))
      }

      if (safeUserPreferences.length) {
        await dexieDb.userPreferences.bulkPut(
          safeUserPreferences.map(mapSafeUserPreferencesToDexieRecord),
        )
      }

      if (response.appliedOperationIds.length) {
        await dexieDb.pendingOperations.bulkDelete(response.appliedOperationIds)
      }

      await writeCursors(userId, response.cursors)
      await dexieDb.metadata.put({
        key: lastSyncKey(userId),
        value: response.timestamp,
      })
    },
  )

  const snapshot = await readDexieCollections(userId)

  return {
    ...snapshot,
    queueSize: await getQueueSize(userId),
    deviceId: response.deviceId ?? deviceId,
    cursors: response.cursors,
    appliedOperationIds: response.appliedOperationIds,
    timestamp: response.timestamp,
  }
}

export const getQueueSize = async (userId: string) =>
  dexieDb.pendingOperations.where("userId").equals(userId).count()

export const getLastSyncAt = async (userId: string): Promise<string | null> => {
  const record = await dexieDb.metadata.get(lastSyncKey(userId))
  return record?.value ?? null
}
