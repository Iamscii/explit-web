'use client'

import { useCallback } from "react"

import useSyncQueue from "@/hooks/use-sync-queue"
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

  const enqueueTemplateUpsert = useCallback(
    async (template: SafeTemplate) =>
      queueOperation({
        entity: "template",
        entityId: template.id,
        category: "cold",
        type: "UPSERT",
        payload: template,
        version: template.lastModifiedAt,
      }),
    [queueOperation],
  )

  const enqueueStyleUpsert = useCallback(
    async (style: SafeStyle) =>
      queueOperation({
        entity: "style",
        entityId: style.id,
        category: "cold",
        type: "UPSERT",
        payload: style,
        version: style.lastModifiedAt,
      }),
    [queueOperation],
  )

  const enqueueFieldUpsert = useCallback(
    async (field: SafeField) =>
      queueOperation({
        entity: "field",
        entityId: field.id,
        category: "cold",
        type: "UPSERT",
        payload: field,
        version: field.lastModifiedAt,
      }),
    [queueOperation],
  )

  const enqueueFieldPreferenceUpsert = useCallback(
    async (preference: SafeFieldPreference) =>
      queueOperation({
        entity: "fieldPreference",
        entityId: preference.id,
        category: "cold",
        type: "UPSERT",
        payload: preference,
        version: preference.lastModifiedAt,
      }),
    [queueOperation],
  )

  const enqueueUserPreferencesUpsert = useCallback(
    async (preferences: SafeUserPreferences) =>
      queueOperation({
        entity: "userPreference",
        entityId: preferences.userId,
        category: "cold",
        type: "UPSERT",
        payload: preferences,
        version: preferences.updatedAt,
      }),
    [queueOperation],
  )

  return {
    enqueueDeckUpsert,
    enqueueCardUpsert,
    enqueueCardDelete,
    enqueueProgressUpdate,
    enqueueTemplateUpsert,
    enqueueStyleUpsert,
    enqueueFieldUpsert,
    enqueueFieldPreferenceUpsert,
    enqueueUserPreferencesUpsert,
  }
}

export default useSyncOperations
