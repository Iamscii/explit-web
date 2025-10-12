'use client'

import { useCallback } from "react"

import dexieDb from "@/lib/db-dexie"
import useSyncQueue from "@/hooks/use-sync-queue"
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
  SafeCard,
  SafeDeck,
  SafeField,
  SafeFieldPreference,
  SafeStyle,
  SafeTemplate,
  SafeUserCardProgress,
  SafeUserPreferences,
} from "@/types/data"
import { useAppSelector } from "@/redux/hooks"

export const useSyncOperations = () => {
  const { queueOperation } = useSyncQueue()
  const userId = useAppSelector((state) => state.user.profile?.id ?? null)

  const assertUserContext = useCallback(() => {
    if (!userId) {
      throw new Error("Cannot perform sync operations without an authenticated user")
    }
    return userId
  }, [userId])

  const enqueueDeckUpsert = useCallback(
    async (deck: SafeDeck) => {
      const currentUserId = assertUserContext()
      if (deck.ownedById !== currentUserId) {
        throw new Error("Deck owner mismatch while queuing sync operation")
      }
      await dexieDb.decks.put(mapSafeDeckToDexieRecord(deck))
      return queueOperation({
        entity: "deck",
        entityId: deck.id,
        category: "cold",
        type: "UPSERT",
        payload: deck,
        version: deck.lastModifiedAt,
      })
    },
    [assertUserContext, queueOperation],
  )

  const enqueueCardUpsert = useCallback(
    async (card: SafeCard) => {
      const currentUserId = assertUserContext()
      if (card.ownedById !== currentUserId) {
        throw new Error("Card owner mismatch while queuing sync operation")
      }
      await dexieDb.cards.put(mapSafeCardToDexieRecord(card))
      return queueOperation({
        entity: "card",
        entityId: card.id,
        category: "warm",
        type: "UPSERT",
        payload: card,
        version: card.lastModifiedAt,
      })
    },
    [assertUserContext, queueOperation],
  )

  const enqueueCardDelete = useCallback(
    async (cardId: string) => {
      assertUserContext()
      await dexieDb.cards.delete(cardId)
      return queueOperation({
        entity: "card",
        entityId: cardId,
        category: "warm",
        type: "DELETE",
        payload: null,
      })
    },
    [assertUserContext, queueOperation],
  )

  const enqueueProgressUpdate = useCallback(
    async (progress: SafeUserCardProgress) => {
      const currentUserId = assertUserContext()
      if (progress.userId !== currentUserId) {
        throw new Error("Progress user mismatch while queuing sync operation")
      }
      await dexieDb.progresses.put(mapSafeProgressToDexieRecord(progress))
      return queueOperation({
        entity: "progress",
        entityId: progress.id,
        category: "hot",
        type: "UPSERT",
        payload: progress,
        version: progress.lastModifiedAt,
      })
    },
    [assertUserContext, queueOperation],
  )

  const enqueueTemplateUpsert = useCallback(
    async (template: SafeTemplate) => {
      const currentUserId = assertUserContext()
      if (template.ownedById !== currentUserId) {
        throw new Error("Template owner mismatch while queuing sync operation")
      }
      await dexieDb.templates.put(mapSafeTemplateToDexieRecord(template))
      return queueOperation({
        entity: "template",
        entityId: template.id,
        category: "cold",
        type: "UPSERT",
        payload: template,
        version: template.lastModifiedAt,
      })
    },
    [assertUserContext, queueOperation],
  )

  const enqueueStyleUpsert = useCallback(
    async (style: SafeStyle) => {
      const currentUserId = assertUserContext()
      await dexieDb.styles.put(mapSafeStyleToDexieRecord(style, currentUserId))
      return queueOperation({
        entity: "style",
        entityId: style.id,
        category: "cold",
        type: "UPSERT",
        payload: style,
        version: style.lastModifiedAt,
      })
    },
    [assertUserContext, queueOperation],
  )

  const enqueueFieldUpsert = useCallback(
    async (field: SafeField) => {
      const currentUserId = assertUserContext()
      await dexieDb.fields.put(mapSafeFieldToDexieRecord(field, currentUserId))
      return queueOperation({
        entity: "field",
        entityId: field.id,
        category: "cold",
        type: "UPSERT",
        payload: field,
        version: field.lastModifiedAt,
      })
    },
    [assertUserContext, queueOperation],
  )

  const enqueueFieldPreferenceUpsert = useCallback(
    async (preference: SafeFieldPreference) => {
      const currentUserId = assertUserContext()
      await dexieDb.fieldPreferences.put(
        mapSafeFieldPreferenceToDexieRecord(preference, currentUserId),
      )
      return queueOperation({
        entity: "fieldPreference",
        entityId: preference.id,
        category: "cold",
        type: "UPSERT",
        payload: preference,
        version: preference.lastModifiedAt,
      })
    },
    [assertUserContext, queueOperation],
  )

  const enqueueUserPreferencesUpsert = useCallback(
    async (preferences: SafeUserPreferences) => {
      const currentUserId = assertUserContext()
      if (preferences.userId !== currentUserId) {
        throw new Error("User preferences mismatch while queuing sync operation")
      }
      await dexieDb.userPreferences.put(mapSafeUserPreferencesToDexieRecord(preferences))
      return queueOperation({
        entity: "userPreference",
        entityId: preferences.userId,
        category: "cold",
        type: "UPSERT",
        payload: preferences,
        version: preferences.updatedAt,
      })
    },
    [assertUserContext, queueOperation],
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
