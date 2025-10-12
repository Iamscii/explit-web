import { HomePage } from "@/components/home/HomePage"
import { getAuthSession } from "@/lib/auth"

export default async function Home() {
  const session = await getAuthSession()

  return <HomePage userId={session?.user?.id ?? null} />
}
