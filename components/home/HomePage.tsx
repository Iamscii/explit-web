'use client'

import { useSearchParams } from "next/navigation"

import DeckExplorer from "@/components/deck/DeckExplorer"
import HomeHero from "@/components/home/HomeHero"

interface HomePageProps {
  userId: string | null
}

export const HomePage = ({ userId }: HomePageProps) => {
  const isAuthenticated = Boolean(userId)
  const searchParams = useSearchParams()
  const selectedDeckId = searchParams.get("category")

  if (!isAuthenticated) {
    return <HomeHero />
  }

  return <DeckExplorer selectedDeckId={selectedDeckId} />
}

export default HomePage
