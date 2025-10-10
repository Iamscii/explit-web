export function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, currentValue]) => currentValue !== undefined && currentValue !== null),
  ) as Partial<T>
}

export function getEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

export function ensureAbsoluteUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}

