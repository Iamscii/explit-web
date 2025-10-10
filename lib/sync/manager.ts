'use client'

import dexieDb, {
  type DexieMetadataRecord,
  type DexiePendingOperation,
} from "@/lib/db-dexie"
import { mapSafeCardToDexieRecord, mapSafeProgressToDexieRecord } from "@/lib/sync/mappers"
import type {
  SyncCursorMap,
  SyncExecutionOptions,
  SyncOperationPayload,
  SyncResponsePayload,
} from "@/lib/sync/types"
import type { SafeCard, SafeUserCardProgress } from "@/types/data"

export interface SyncSnapshot {
  cards: SafeCard[]
  progresses: SafeUserCardProgress[]
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

const readDexieSnapshot = async (): Promise<Pick<SyncSnapshot, "cards" | "progresses">> => {
  const [cardRecords, progressRecords] = await Promise.all([
    dexieDb.cards.toArray(),
    dexieDb.progresses.toArray(),
  ])

  return {
    cards: cardRecords.map((record) => record.payload),
    progresses: progressRecords.map((record) => record.payload),
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
  const progresses = (response.collections.progresses ?? []) as SafeUserCardProgress[]

  await dexieDb.transaction(
    "rw",
    dexieDb.cards,
    dexieDb.progresses,
    dexieDb.pendingOperations,
    dexieDb.metadata,
    async () => {
      if (cards.length) {
        await dexieDb.cards.bulkPut(cards.map(mapSafeCardToDexieRecord))
      }

      if (progresses.length) {
        await dexieDb.progresses.bulkPut(progresses.map(mapSafeProgressToDexieRecord))
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
