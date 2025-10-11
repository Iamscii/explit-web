'use client'

import { useCallback, useTransition } from "react"

import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"

import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

type SupportedLocale = "en" | "zh"

const DEFAULT_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

const updateLocaleCookie = async (locale: SupportedLocale) => {
  const response = await fetch("/api/locale", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ locale, maxAge: DEFAULT_MAX_AGE }),
  })

  if (!response.ok) {
    throw new Error("Failed to update locale")
  }
}

export const LanguageSwitch = () => {
  const locale = useLocale()
  const router = useRouter()
  const t = useTranslations("nav.language")
  const [isPending, startTransition] = useTransition()

  const handleCheckedChange = useCallback(
    (checked: boolean) => {
      const nextLocale = checked ? "zh" : "en"

      if (nextLocale === locale || isPending) {
        return
      }

      startTransition(() => {
        void (async () => {
          try {
            await updateLocaleCookie(nextLocale)
            router.refresh()
          } catch (error) {
            console.error("Language toggle failed", error)
          }
        })()
      })
    },
    [locale, isPending, router],
  )

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="hidden sm:inline">{t("label")}</span>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-xs font-medium uppercase tracking-wide transition-colors",
            locale === "en" ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {t("en")}
        </span>
        <Switch
          checked={locale === "zh"}
          onCheckedChange={handleCheckedChange}
          disabled={isPending}
          aria-label={t("ariaLabel")}
        />
        <span
          className={cn(
            "text-xs font-medium tracking-wide transition-colors",
            locale === "zh" ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {t("zh")}
        </span>
      </div>
    </div>
  )
}
