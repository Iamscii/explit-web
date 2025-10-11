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

const ensureDeviceId = async (): Promise<string> => {
  const existing = await dexieDb.metadata.get(DEVICE_METADATA_KEY)
  if (existing?.value) {
    return existing.value
  }

  const newId = crypto.randomUUID()
  await dexieDb.metadata.put({ key: DEVICE_METADATA_KEY, value: newId })
  return newId
}

const readCursors = async (): Promise<SyncCursorMap> => {
  const records = await dexieDb.metadata
    .where("key")
    .startsWith(CURSOR_METADATA_PREFIX)
    .toArray()

  return records.reduce<SyncCursorMap>((acc, record) => {
    const [, category] = record.key.split(":")
    if (category) {
      acc[category as keyof SyncCursorMap] = record.value
    }
    return acc
  }, {})
}

const writeCursors = async (cursors: SyncCursorMap) => {
  const entries: DexieMetadataRecord[] = Object.entries(cursors)
    .filter(([, value]) => Boolean(value))
    .map(([category, value]) => ({
      key: `${CURSOR_METADATA_PREFIX}${category}`,
      value: value as string,
    }))

  if (!entries.length) return

  await dexieDb.metadata.bulkPut(entries)
}

export const enqueueOperation = async (
  operation: Omit<DexiePendingOperation, "id" | "createdAt">,
) => {
  const record: DexiePendingOperation = {
    ...operation,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }

  await dexieDb.pendingOperations.put(record)

  return record
}

const readDexieSnapshot = async (): Promise<
  Pick<
    SyncSnapshot,
    "cards" | "decks" | "templates" | "fields" | "fieldPreferences" | "styles" | "progresses" | "userPreferences"
  >
> => {
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
    dexieDb.cards.toArray(),
    dexieDb.decks.toArray(),
    dexieDb.templates.toArray(),
    dexieDb.fields.toArray(),
    dexieDb.fieldPreferences.toArray(),
    dexieDb.styles.toArray(),
    dexieDb.progresses.toArray(),
    dexieDb.userPreferences.toArray(),
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
  options: SyncExecutionOptions = {},
): Promise<SyncSnapshot> => {
  const deviceId = await ensureDeviceId()
  const cursors = await readCursors()

  const operations = await dexieDb.pendingOperations.orderBy("createdAt").toArray()
  const filteredOperations =
    options.categories && options.categories.length
      ? operations.filter((operation) => options.categories?.includes(operation.category))
      : operations

  const payload = {
    deviceId,
    operations: filteredOperations as SyncOperationPayload[],
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

  const styleMap = styles.reduce<Record<string, SafeStyle>>((acc, style) => {
    acc[style.templateId] = style
    return acc
  }, {})

  const templatesWithStyles = templates.map((template) => {
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
      if (cards.length) {
        await dexieDb.cards.bulkPut(cards.map(mapSafeCardToDexieRecord))
      }

      if (decks.length) {
        await dexieDb.decks.bulkPut(decks.map(mapSafeDeckToDexieRecord))
      }

      if (templatesWithStyles.length) {
        await dexieDb.templates.bulkPut(templatesWithStyles.map(mapSafeTemplateToDexieRecord))
      }

      if (fields.length) {
        await dexieDb.fields.bulkPut(fields.map(mapSafeFieldToDexieRecord))
      }

      if (fieldPreferences.length) {
        await dexieDb.fieldPreferences.bulkPut(
          fieldPreferences.map(mapSafeFieldPreferenceToDexieRecord),
        )
      }

      if (styles.length) {
        await dexieDb.styles.bulkPut(styles.map(mapSafeStyleToDexieRecord))
      }

      if (progresses.length) {
        await dexieDb.progresses.bulkPut(progresses.map(mapSafeProgressToDexieRecord))
      }

      if (userPreferences.length) {
        await dexieDb.userPreferences.bulkPut(
          userPreferences.map(mapSafeUserPreferencesToDexieRecord),
        )
      }

      if (response.appliedOperationIds.length) {
        await dexieDb.pendingOperations.bulkDelete(response.appliedOperationIds)
      }

      await writeCursors(response.cursors)
      await dexieDb.metadata.put({
        key: "last-sync-at",
        value: response.timestamp,
      })
    },
  )

  const snapshot = await readDexieSnapshot()

  return {
    ...snapshot,
    queueSize: await dexieDb.pendingOperations.count(),
    deviceId: response.deviceId ?? deviceId,
    cursors: response.cursors,
    appliedOperationIds: response.appliedOperationIds,
    timestamp: response.timestamp,
  }
}

export const getQueueSize = async () => dexieDb.pendingOperations.count()

export const getLastSyncAt = async (): Promise<string | null> => {
  const record = await dexieDb.metadata.get("last-sync-at")
  return record?.value ?? null
}
