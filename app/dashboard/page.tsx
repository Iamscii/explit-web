import { DashboardPage } from "@/components/dashboard/DashboardPage"
import { getAuthSession } from "@/lib/auth"

export default async function Dashboard() {
  const session = await getAuthSession()
  const userId = session?.user?.id ?? null

  return <DashboardPage userId={userId} />
}
