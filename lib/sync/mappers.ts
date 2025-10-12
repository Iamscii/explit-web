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

import type {
  DexieCardRecord,
  DexieDeckRecord,
  DexieFieldPreferenceRecord,
  DexieFieldRecord,
  DexieProgressRecord,
  DexieStyleRecord,
  DexieTemplateRecord,
  DexieUserPreferencesRecord,
} from "@/lib/db-dexie"

export const mapSafeCardToDexieRecord = (card: SafeCard): DexieCardRecord => ({
  id: card.id,
  cardId: card.id,
  deckId: card.primaryDeckId ?? null,
  userId: card.ownedById,
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
  deckId: progress.deckId,
  payload: progress,
  updatedAt: progress.lastModifiedAt,
})

export const mapSafeDeckToDexieRecord = (deck: SafeDeck): DexieDeckRecord => ({
  id: deck.id,
  deckId: deck.id,
  parentId: deck.parentId ?? null,
  userId: deck.ownedById,
  payload: deck,
  updatedAt: deck.lastModifiedAt,
})

export const mapSafeTemplateToDexieRecord = (
  template: SafeTemplate,
): DexieTemplateRecord => ({
  id: template.id,
  templateId: template.id,
  styleId: template.styleId ?? template.style?.id ?? null,
  userId: template.ownedById,
  payload: template,
  updatedAt: template.lastModifiedAt,
})

export const mapSafeFieldToDexieRecord = (
  field: SafeField,
  ownerId: string,
): DexieFieldRecord => ({
  id: field.id,
  fieldId: field.id,
  templateId: field.templateId,
  userId: ownerId,
  payload: field,
  updatedAt: field.lastModifiedAt,
})

export const mapSafeFieldPreferenceToDexieRecord = (
  preference: SafeFieldPreference,
  ownerId: string,
): DexieFieldPreferenceRecord => ({
  id: preference.id,
  fieldPreferenceId: preference.id,
  templateId: preference.templateId,
  fieldId: preference.fieldId,
  userId: ownerId,
  payload: preference,
  updatedAt: preference.lastModifiedAt,
})

export const mapSafeStyleToDexieRecord = (style: SafeStyle, ownerId: string): DexieStyleRecord => ({
  id: style.id,
  templateId: style.templateId,
  userId: ownerId,
  payload: style,
  updatedAt: style.lastModifiedAt,
})

export const mapSafeUserPreferencesToDexieRecord = (
  preferences: SafeUserPreferences,
): DexieUserPreferencesRecord => ({
  id: preferences.id ?? preferences.userId,
  userId: preferences.userId,
  payload: preferences,
  updatedAt: preferences.updatedAt,
})
