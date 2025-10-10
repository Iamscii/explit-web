export type Primitive = string | number | boolean | null | undefined

/**
 * Recursively converts Date instances inside an object or array into ISO strings.
 * Keeps null values untouched to preserve optional semantics.
 */
export const dateToStrings = <T>(value: T): T => {
  if (value instanceof Date) {
    return value.toISOString() as T
  }

  if (Array.isArray(value)) {
    return value.map((item) => dateToStrings(item)) as T
  }

  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>
    const output: Record<string, unknown> = {}

    for (const key of Object.keys(input)) {
      const field = input[key]

      if (field instanceof Date) {
        output[key] = field.toISOString()
      } else if (Array.isArray(field)) {
        output[key] = field.map((item) => dateToStrings(item))
      } else if (field && typeof field === "object") {
        output[key] = dateToStrings(field)
      } else {
        output[key] = field
      }
    }

    return output as T
  }

  return value
}
