import { CardFace } from "@prisma/client"

import type { SafeField, SafeFieldPreference } from "@/types/data"

export interface TemplateFieldMeta {
  field: SafeField
  preference?: SafeFieldPreference
}

export interface TemplateFieldGroups {
  orderedIds: string[]
  groups: Record<CardFace, TemplateFieldMeta[]>
}

export const FIELD_GROUP_ORDER: CardFace[] = [CardFace.FRONT, CardFace.BACK, CardFace.UNCATEGORIZED]

export const buildTemplateGroups = (
  templateId: string | undefined,
  fields: Record<string, SafeField>,
  idsByTemplate: Record<string, string[]>,
  preferencesById: Record<string, SafeFieldPreference>,
  preferencesByTemplate: Record<string, string[]>,
): TemplateFieldGroups => {
  if (!templateId) {
    return {
      orderedIds: [],
      groups: {
        [CardFace.FRONT]: [],
        [CardFace.BACK]: [],
        [CardFace.UNCATEGORIZED]: [],
      },
    }
  }

  const fieldIdsForTemplate = idsByTemplate[templateId] ?? []
  const groups: TemplateFieldGroups["groups"] = {
    [CardFace.FRONT]: [],
    [CardFace.BACK]: [],
    [CardFace.UNCATEGORIZED]: [],
  }

  const preferenceIds = preferencesByTemplate[templateId] ?? []
  const orderedFieldIds: string[] = []

  const preferenceEntries = preferenceIds
    .map((id) => preferencesById[id])
    .filter((pref): pref is SafeFieldPreference => Boolean(pref))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  const seenFieldIds = new Set<string>()

  preferenceEntries.forEach((preference) => {
    const field = fields[preference.fieldId]
    if (!field || seenFieldIds.has(field.id)) return
    seenFieldIds.add(field.id)
    const groupKey = preference.face ?? CardFace.UNCATEGORIZED
    groups[groupKey].push({ field, preference })
    orderedFieldIds.push(field.id)
  })

  fieldIdsForTemplate.forEach((fieldId) => {
    if (seenFieldIds.has(fieldId)) return
    const field = fields[fieldId]
    if (!field) return
    seenFieldIds.add(field.id)
    groups[CardFace.UNCATEGORIZED].push({ field })
    orderedFieldIds.push(field.id)
  })

  return { orderedIds: orderedFieldIds, groups }
}

