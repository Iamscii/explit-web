import type { ModelParameterDefinition } from "./model-catalog"
import { resolveImageSizeValue } from "./image-size"

export interface NormalizedParametersResult {
  recognized: Record<string, unknown>
  extras: Record<string, unknown>
  combined: Record<string, unknown>
  missingRequired: string[]
  invalid: Record<string, string>
}

export function normalizeParameters(
  definitions: ModelParameterDefinition[],
  input: unknown,
): NormalizedParametersResult {
  const provided = isPlainRecord(input) ? input : {}
  const recognized: Record<string, unknown> = {}
  const extras: Record<string, unknown> = {}
  const missingRequired: string[] = []
  const invalid: Record<string, string> = {}

  const definitionByKey = new Map(definitions.map((definition) => [definition.key, definition]))

  for (const [key, value] of Object.entries(provided)) {
    if (!definitionByKey.has(key)) {
      extras[key] = value
    }
  }

  for (const definition of definitions) {
    const enumValues = (definition as { enum?: unknown[] }).enum
    const fallbackFromEnum =
      Array.isArray(enumValues) && enumValues.length > 0 ? enumValues[0] : undefined

    const rawValue = Object.prototype.hasOwnProperty.call(provided, definition.key)
      ? provided[definition.key]
      : definition.defaultValue ?? fallbackFromEnum

    if (rawValue === undefined) {
      if (definition.required) {
        missingRequired.push(definition.key)
      }
      continue
    }

    const coerced = coerceParameterValue(definition, rawValue)

    if (!coerced.success) {
      invalid[definition.key] = coerced.error ?? "Invalid value"
      continue
    }

    recognized[definition.key] = coerced.value
  }

  const combined = { ...extras, ...recognized }

  return {
    recognized,
    extras,
    combined,
    missingRequired,
    invalid,
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

interface CoerceSuccess {
  success: true
  value: unknown
}

interface CoerceFailure {
  success: false
  error?: string
}

function coerceParameterValue(
  definition: ModelParameterDefinition,
  rawValue: unknown,
): CoerceSuccess | CoerceFailure {
  switch (definition.type) {
    case "string":
      return { success: true, value: String(rawValue) }
    case "boolean": {
      if (typeof rawValue === "boolean") {
        return { success: true, value: rawValue }
      }

      if (typeof rawValue === "number") {
        return { success: true, value: rawValue !== 0 }
      }

      if (typeof rawValue === "string") {
        const normalized = rawValue.trim().toLowerCase()
        if (["true", "1", "yes", "y", "on"].includes(normalized)) {
          return { success: true, value: true }
        }
        if (["false", "0", "no", "n", "off"].includes(normalized)) {
          return { success: true, value: false }
        }
      }

      return { success: false, error: "Expected a boolean-compatible value" }
    }
    case "number":
    case "integer": {
      const numeric = parseNumeric(rawValue)
      if (numeric === null) {
        return { success: false, error: "Expected a numeric value" }
      }
      if (definition.type === "integer" && !Number.isInteger(numeric)) {
        return { success: false, error: "Expected an integer value" }
      }
      return { success: true, value: numeric }
    }
    case "array": {
      if (Array.isArray(rawValue)) {
        return { success: true, value: rawValue }
      }
      if (typeof rawValue === "string") {
        try {
          const parsed = JSON.parse(rawValue)
          if (Array.isArray(parsed)) {
            return { success: true, value: parsed }
          }
          return { success: false, error: "JSON did not resolve to an array" }
        } catch {
          return { success: false, error: "Expected JSON array" }
        }
      }
      return { success: false, error: "Expected an array value" }
    }
    case "object": {
      if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) {
        return { success: true, value: rawValue }
      }
      if (typeof rawValue === "string") {
        try {
          const parsed = JSON.parse(rawValue)
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return { success: true, value: parsed }
          }
          return { success: false, error: "JSON did not resolve to an object" }
        } catch {
          return { success: false, error: "Expected JSON object" }
        }
      }
      return { success: false, error: "Expected an object value" }
    }
    case "imagesize": {
      const resolved = resolveImageSizeValue(rawValue, definition.imageSize)
      if (!resolved) {
        return {
          success: false,
          error: "Expected a preset id (e.g. 16:9) or an object with width/height",
        }
      }
      return { success: true, value: resolved }
    }
    default:
      return { success: true, value: rawValue }
  }
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}
