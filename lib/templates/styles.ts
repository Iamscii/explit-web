import type { CSSProperties } from "react"

import type { SafeJsonValue } from "@/types/data"

const isRecord = (
  value: SafeJsonValue | null | undefined,
): value is Record<string, SafeJsonValue> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const toCssProperties = (value: SafeJsonValue | null | undefined): CSSProperties => {
  if (!isRecord(value)) {
    return {}
  }

  return Object.entries(value).reduce<CSSProperties>((acc, [key, raw]) => {
    if (typeof raw === "string" || typeof raw === "number") {
      ;(acc as Record<string, string | number>)[key] = raw
    }
    return acc
  }, {})
}

const SELECTOR_START_PATTERN = /^(?:\.|#|@|:|\[|--)/ // ., #, @media, pseudo, attribute, custom property

type StyleRule = {
  selector: string
  properties: CSSProperties
}

const replaceAmpersand = (selector: string, base: string) =>
  selector.startsWith("&") ? `${base}${selector.slice(1)}` : selector

const maybeWrapSelector = (selector: string, base: string) => {
  if (selector.includes("&")) {
    return replaceAmpersand(selector, base)
  }
  if (SELECTOR_START_PATTERN.test(selector) || selector.includes(" ")) {
    return selector
  }
  return `${base} ${selector}`
}

export const jsonToCssProperties = (value: SafeJsonValue | null | undefined): CSSProperties =>
  toCssProperties(value)

interface StyleParseOptions {
  defaultSelector: string
  aliasMap?: Record<string, string>
  transformSelector?: (selector: string) => string
}

export const parseStyleJson = (
  value: SafeJsonValue | null | undefined,
  { defaultSelector, aliasMap = {}, transformSelector }: StyleParseOptions,
): { base: CSSProperties; rules: StyleRule[] } => {
  const base: CSSProperties = {}
  const rules: StyleRule[] = []

  if (!isRecord(value)) {
    return { base, rules }
  }

  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "string" || typeof raw === "number") {
      ;(base as Record<string, string | number>)[key] = raw
      continue
    }

    if (!isRecord(raw)) {
      continue
    }

    const properties = toCssProperties(raw)
    if (!Object.keys(properties).length) {
      continue
    }

    const resolvedAlias = aliasMap[key]
    let selector = resolvedAlias ?? key

    selector = maybeWrapSelector(selector, defaultSelector)
    if (transformSelector) {
      selector = transformSelector(selector)
    }

    rules.push({
      selector,
      properties,
    })
  }

  return { base, rules }
}
