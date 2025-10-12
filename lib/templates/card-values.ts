import type { SafeCard, SafeJsonValue } from "@/types/data"

const normalizeValue = (value: SafeJsonValue | undefined): string => {
  if (typeof value === "string") {
    return value
  }

  if (value === null || value === undefined) {
    return ""
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  try {
    return JSON.stringify(value)
  } catch {
    return ""
  }
}

export const mapFieldValuesById = (card: SafeCard, orderedFieldIds: string[]) => {
  const values: Record<string, string> = {}

  orderedFieldIds.forEach((fieldId, index) => {
    values[fieldId] = normalizeValue(card.fieldValues[index])
  })

  return values
}

