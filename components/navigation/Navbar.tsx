'use client'

import { useMemo, useState } from "react"
import Link from "next/link"

import { useTranslations } from "next-intl"
import { signIn, signOut, useSession } from "next-auth/react"
import { MenuIcon } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

import { LanguageSwitch } from "@/components/navigation/LanguageSwitch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const navigationLinks = [
  { href: "/", key: "home" },
  { href: "/ai-lab", key: "aiLab" },
  { href: "/dashboard", key: "dashboard" },
] as const

const getInitials = (value: string) => {
  if (!value) {
    return "U"
  }

  const parts = value.trim().split(/\s+/)
  const initials = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase())

  return initials.join("") || "U"
}

export const Navbar = () => {
  const t = useTranslations("nav")
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, status } = useSession()
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const isLoadingSession = status === "loading"
  const displayName =
    session?.user?.name ?? session?.user?.email ?? t("account")
  const avatarFallback = useMemo(
    () => getInitials(displayName),
    [displayName],
  )

  const isActive = (href: string) => {
    if (!pathname) {
      return false
    }

    if (href === "/") {
      return pathname === "/"
    }

    return pathname.startsWith(href)
  }

  const handleNavigate = (href: string) => {
    router.push(href)
    setIsMobileOpen(false)
  }

  const handleSignIn = (opts?: {
    screenHint?: string
    callbackUrl?: string
  }) => {
    const { screenHint, callbackUrl } = opts ?? {}
    const authorizationParams =
      screenHint !== undefined ? { screen_hint: screenHint } : undefined

    void signIn(undefined, callbackUrl ? { callbackUrl } : undefined, authorizationParams)
  }

  const handleSignOut = () => {
    void signOut({ callbackUrl: "/" })
  }

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex flex-1 items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold text-lg text-foreground transition hover:text-primary"
          >
            <span>{t("brand")}</span>
          </Link>
          <nav className="hidden items-center gap-4 md:flex">
            {navigationLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                  isActive(link.href) && "text-foreground",
                )}
              >
                {t(`links.${link.key}`)}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:block">
            <LanguageSwitch />
          </div>

          {isLoadingSession ? (
            <div className="hidden h-9 w-24 animate-pulse rounded-md bg-muted md:block" />
          ) : session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden items-center gap-2 px-2 md:inline-flex"
                >
                  <Avatar className="size-8">
                    <AvatarImage src={session.user?.image ?? undefined} alt={displayName} />
                    <AvatarFallback>{avatarFallback}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{displayName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="truncate">
                  {displayName}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault()
                    handleNavigate("/dashboard")
                  }}
                >
                  {t("links.dashboard")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault()
                    handleSignOut()
                  }}
                >
                  {t("auth.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSignIn()}
              >
                {t("auth.signIn")}
              </Button>
              <Button
                size="sm"
                onClick={() => handleSignIn({ screenHint: "signup", callbackUrl: "/dashboard" })}
              >
                {t("auth.register")}
              </Button>
            </div>
          )}

          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label={t("menu.open")}
              >
                <MenuIcon className="size-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex flex-col gap-6 px-4 py-6">
              <div className="flex items-center justify-between">
                <Link
                  href="/"
                  onClick={() => setIsMobileOpen(false)}
                  className="text-lg font-semibold text-foreground"
                >
                  {t("brand")}
                </Link>
              </div>
              <nav className="flex flex-col gap-3">
                {navigationLinks.map((link) => (
                  <Button
                    key={link.href}
                    variant={isActive(link.href) ? "secondary" : "ghost"}
                    className="justify-start"
                    onClick={() => handleNavigate(link.href)}
                  >
                    {t(`links.${link.key}`)}
                  </Button>
                ))}
              </nav>
              <div className="border-t border-border pt-6">
                <LanguageSwitch />
              </div>
              <div className="flex flex-col gap-3">
                {isLoadingSession ? (
                  <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
                ) : session ? (
                  <>
                    <Button
                      variant="ghost"
                      className="justify-start"
                      onClick={() => handleNavigate("/dashboard")}
                    >
                      {t("links.dashboard")}
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setIsMobileOpen(false)
                      handleSignOut()
                    }}>
                      {t("auth.signOut")}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={() => {
                        setIsMobileOpen(false)
                        handleSignIn({ screenHint: "signup", callbackUrl: "/dashboard" })
                      }}
                    >
                      {t("auth.register")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsMobileOpen(false)
                        handleSignIn()
                      }}
                    >
                      {t("auth.signIn")}
                    </Button>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}

export default Navbar
