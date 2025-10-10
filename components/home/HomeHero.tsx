'use client'

import Link from "next/link"

import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"

export const HomeHero = () => {
  const t = useTranslations("home")

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-24 text-foreground">
      <div className="max-w-xl text-center sm:text-left">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          {t("welcome")}
        </h1>
        <p className="mt-4 text-base text-muted-foreground sm:text-lg">
          Manage card decks, review efficiently, and keep your study progress synced across devices.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Button size="lg" asChild>
          <Link href="/study">{t("cta")}</Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="/decks">Explore decks</Link>
        </Button>
      </div>
    </main>
  )
}

export default HomeHero
