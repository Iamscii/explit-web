import { NextResponse } from "next/server"

const SUPPORTED_LOCALES = ["en", "zh"] as const
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

type LocaleRequestPayload = {
  locale?: string
  maxAge?: number
}

const isSupportedLocale = (value: string): value is SupportedLocale =>
  SUPPORTED_LOCALES.includes(value as SupportedLocale)

export async function POST(request: Request) {
  let body: LocaleRequestPayload

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const requestedLocale = body.locale

  if (!requestedLocale || !isSupportedLocale(requestedLocale)) {
    return NextResponse.json({ error: "Unsupported locale" }, { status: 400 })
  }

  const maxAge =
    typeof body.maxAge === "number" && Number.isFinite(body.maxAge)
      ? Math.max(60, Math.round(body.maxAge))
      : 60 * 60 * 24 * 365

  const response = NextResponse.json({ locale: requestedLocale })

  response.cookies.set({
    name: "NEXT_LOCALE",
    value: requestedLocale,
    path: "/",
    maxAge,
    sameSite: "lax",
  })

  return response
}

