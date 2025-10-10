import type { SafeCard, SafeUserCardProgress } from "@/types/data"

import type { DexieCardRecord, DexieProgressRecord } from "@/lib/db-dexie"

export const mapSafeCardToDexieRecord = (card: SafeCard): DexieCardRecord => ({
  id: card.id,
  cardId: card.id,
  deckId: null,
  payload: card,
  updatedAt: card.lastModifiedAt,
})

export const mapSafeProgressToDexieRecord = (
  progress: SafeUserCardProgress,
): DexieProgressRecord => ({
  id: progress.id,
  progressId: progress.id,
  cardId: progress.cardId,
  userId: progress.userId,
  payload: progress,
  updatedAt: progress.lastModifiedAt,
})
