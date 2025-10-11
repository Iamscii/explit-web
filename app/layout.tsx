import type { Metadata } from "next"
import { cookies } from "next/headers"
import { Geist, Geist_Mono } from "next/font/google"

import "@/app/globals.css"

import { Navbar } from "@/components/navigation/Navbar"
import { AppProviders } from "@/components/providers/AppProviders"
import enMessages from "@/messages/en.json"
import zhMessages from "@/messages/zh.json"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const messagesMap = {
  en: enMessages,
  zh: zhMessages,
}

export const metadata: Metadata = {
  title: "Explit Study",
  description: "An Anki-inspired spaced repetition platform.",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const localeCookie = cookieStore.get("NEXT_LOCALE")?.value
  const locale = localeCookie && localeCookie in messagesMap ? (localeCookie as keyof typeof messagesMap) : "en"
  const messages = messagesMap[locale]

  return (
    <html lang={locale}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AppProviders locale={locale} messages={messages}>
          <div className="flex min-h-screen flex-col bg-background text-foreground">
            <Navbar />
            <main className="flex-1">{children}</main>
          </div>
        </AppProviders>
      </body>
    </html>
  )
}
