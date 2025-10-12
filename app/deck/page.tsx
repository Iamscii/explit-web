import { DeckStudyClient } from "@/components/deck/DeckStudyClient"
import { getAuthSession } from "@/lib/auth"

export default async function DeckPage() {
  const session = await getAuthSession()

  return <DeckStudyClient userId={session?.user?.id ?? null} />
}
