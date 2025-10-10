'use client'

import { useCallback } from "react"

import useSyncQueue from "@/hooks/use-sync-queue"
import type { SafeCard, SafeDeck, SafeUserCardProgress } from "@/types/data"

export const useSyncOperations = () => {
  const { queueOperation } = useSyncQueue()

  const enqueueDeckUpsert = useCallback(
    async (deck: SafeDeck) =>
      queueOperation({
        entity: "deck",
        entityId: deck.id,
        category: "cold",
        type: "UPSERT",
        payload: deck,
        version: deck.lastModifiedAt,
      }),
    [queueOperation],
  )

  const enqueueCardUpsert = useCallback(
    async (card: SafeCard) =>
      queueOperation({
        entity: "card",
        entityId: card.id,
        category: "warm",
        type: "UPSERT",
        payload: card,
        version: card.lastModifiedAt,
      }),
    [queueOperation],
  )

  const enqueueCardDelete = useCallback(
    async (cardId: string) =>
      queueOperation({
        entity: "card",
        entityId: cardId,
        category: "warm",
        type: "DELETE",
        payload: null,
      }),
    [queueOperation],
  )

  const enqueueProgressUpdate = useCallback(
    async (progress: SafeUserCardProgress) =>
      queueOperation({
        entity: "progress",
        entityId: progress.id,
        category: "hot",
        type: "UPSERT",
        payload: progress,
        version: progress.lastModifiedAt,
      }),
    [queueOperation],
  )

  return {
    enqueueDeckUpsert,
    enqueueCardUpsert,
    enqueueCardDelete,
    enqueueProgressUpdate,
  }
}

export default useSyncOperations
