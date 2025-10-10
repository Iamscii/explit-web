import Dexie, { type Table } from "dexie"

import type { SyncCategory, SyncEntity, SyncOperationType } from "@/lib/sync/types"
import type { SafeCard, SafeUserCardProgress } from "@/types/data"

export interface DexieCardRecord {
  id: string
  cardId: string
  deckId: string | null
  payload: SafeCard
  updatedAt: string
}

export interface DexieProgressRecord {
  id: string
  progressId: string
  cardId: string
  userId: string
  payload: SafeUserCardProgress
  updatedAt: string
}

export interface DexiePendingOperation {
  id: string
  entity: SyncEntity
  entityId: string
  category: SyncCategory
  type: SyncOperationType
  payload: unknown
  version?: string
  createdAt: string
}

export interface DexieMetadataRecord {
  key: string
  value: string
}

class ExplitDexieDatabase extends Dexie {
  cards!: Table<DexieCardRecord>
  progresses!: Table<DexieProgressRecord>
  pendingOperations!: Table<DexiePendingOperation>
  metadata!: Table<DexieMetadataRecord>

  constructor() {
    super("explit-local")

    this.version(1).stores({
      cards: "&id, cardId, deckId",
      progresses: "&id, progressId, cardId, userId",
    })

    this.version(2).stores({
      pendingOperations: "&id, entity, category, createdAt",
      metadata: "&key",
    })
  }
}

export const dexieDb = new ExplitDexieDatabase()

export default dexieDb
