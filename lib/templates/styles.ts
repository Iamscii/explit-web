import type { CSSProperties } from "react"

import type { SafeJsonValue } from "@/types/data"

const isRecord = (value: SafeJsonValue): value is Record<string, SafeJsonValue> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export const jsonToCssProperties = (value: SafeJsonValue | null | undefined): CSSProperties => {
  if (!isRecord(value)) {
    return {}
  }

  const styles: CSSProperties = {}

  Object.entries(value).forEach(([key, raw]) => {
    if (typeof raw === "string" || typeof raw === "number") {
      styles[key as keyof CSSProperties] = raw as never
    }
  })

  return styles
}

