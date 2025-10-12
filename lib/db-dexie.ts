import Dexie, { type Table } from "dexie"

import type { SyncCategory, SyncEntity, SyncOperationType } from "@/lib/sync/types"
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

export interface DexieCardRecord {
  id: string
  cardId: string
  deckId: string | null
  userId: string
  payload: SafeCard
  updatedAt: string
}

export interface DexieProgressRecord {
  id: string
  progressId: string
  cardId: string
  userId: string
  deckId: string
  payload: SafeUserCardProgress
  updatedAt: string
}

export interface DexieDeckRecord {
  id: string
  deckId: string
  parentId: string | null
  userId: string
  payload: SafeDeck
  updatedAt: string
}

export interface DexieTemplateRecord {
  id: string
  templateId: string
  styleId: string | null
  userId: string
  payload: SafeTemplate
  updatedAt: string
}

export interface DexieFieldRecord {
  id: string
  fieldId: string
  templateId: string
  userId: string
  payload: SafeField
  updatedAt: string
}

export interface DexieFieldPreferenceRecord {
  id: string
  fieldPreferenceId: string
  templateId: string
  fieldId: string
  userId: string
  payload: SafeFieldPreference
  updatedAt: string
}

export interface DexieStyleRecord {
  id: string
  templateId: string
  userId: string
  payload: SafeStyle
  updatedAt: string
}

export interface DexieUserPreferencesRecord {
  id: string
  userId: string
  payload: SafeUserPreferences
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
  userId: string
}

export interface DexieMetadataRecord {
  key: string
  value: string
}

class ExplitDexieDatabase extends Dexie {
  cards!: Table<DexieCardRecord>
  progresses!: Table<DexieProgressRecord>
  decks!: Table<DexieDeckRecord>
  templates!: Table<DexieTemplateRecord>
  fields!: Table<DexieFieldRecord>
  fieldPreferences!: Table<DexieFieldPreferenceRecord>
  styles!: Table<DexieStyleRecord>
  userPreferences!: Table<DexieUserPreferencesRecord>
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

    this.version(3).stores({
      cards: "&id, cardId, deckId",
      progresses: "&id, progressId, cardId, userId",
      pendingOperations: "&id, entity, category, createdAt",
      metadata: "&key",
      decks: "&id, deckId, parentId",
      templates: "&id, templateId, styleId",
      fields: "&id, fieldId, templateId",
      fieldPreferences: "&id, templateId, fieldId",
      styles: "&id, templateId",
      userPreferences: "&id, userId",
    })

    this.version(4)
      .stores({
        cards: "&id, cardId, deckId, userId",
        progresses: "&id, progressId, cardId, deckId, userId",
        pendingOperations: "&id, entity, category, createdAt, userId",
        metadata: "&key",
        decks: "&id, deckId, parentId, userId",
        templates: "&id, templateId, styleId, userId",
        fields: "&id, fieldId, templateId, userId",
        fieldPreferences: "&id, templateId, fieldId, userId",
        styles: "&id, templateId, userId",
        userPreferences: "&id, userId",
      })
      .upgrade(async (transaction) => {
        await Promise.all([
          transaction.table("cards").clear(),
          transaction.table("progresses").clear(),
          transaction.table("pendingOperations").clear(),
          transaction.table("decks").clear(),
          transaction.table("templates").clear(),
          transaction.table("fields").clear(),
          transaction.table("fieldPreferences").clear(),
          transaction.table("styles").clear(),
          transaction.table("userPreferences").clear(),
          transaction.table("metadata").clear(),
        ])
      })
  }
}

export const dexieDb = new ExplitDexieDatabase()

export default dexieDb
