export type SyncCategory = "cold" | "warm" | "hot"

export type SyncEntity =
  | "deck"
  | "card"
  | "template"
  | "style"
  | "field"
  | "fieldPreference"
  | "progress"
  | "userPreference"

export type SyncOperationType = "UPSERT" | "DELETE"

export interface SyncOperationPayload {
  id: string
  entity: SyncEntity
  entityId: string
  type: SyncOperationType
  payload?: unknown
  category: SyncCategory
  version?: string
  createdAt: string
}

export interface SyncCursorMap {
  cold?: string
  warm?: string
  hot?: string
}

export interface SyncRequestPayload {
  deviceId: string
  operations: SyncOperationPayload[]
  cursors: SyncCursorMap
  options?: {
    categories?: SyncCategory[]
    forcePull?: boolean
    reason?: string
  }
}

export interface SyncCollectionPayload {
  decks?: unknown[]
  cards?: unknown[]
  templates?: unknown[]
  styles?: unknown[]
  fields?: unknown[]
  fieldPreferences?: unknown[]
  progresses?: unknown[]
  userPreferences?: unknown[]
}

export interface SyncResponsePayload {
  appliedOperationIds: string[]
  collections: SyncCollectionPayload
  cursors: SyncCursorMap
  deviceId: string
  timestamp: string
}

export interface SyncExecutionOptions {
  categories?: SyncCategory[]
  forcePull?: boolean
  reason?: string
}
