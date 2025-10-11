'use client'

import { type ComponentType, useState } from "react"

import { useTranslations } from "next-intl"
import { signIn } from "next-auth/react"
import { Loader2 } from "lucide-react"
import { AiFillGithub } from "react-icons/ai"
import { FcGoogle } from "react-icons/fc"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import useLoginDialog from "@/hooks/dialog/use-login-dialog"
import useRegisterDialog from "@/hooks/dialog/use-register-dialog"

type ProviderId = "google" | "github"

type ProviderConfig = {
  id: ProviderId
  Icon: ComponentType<{ className?: string }>
  labelKey: `providers.${ProviderId}`
}

const providers: ProviderConfig[] = [
  {
    id: "google",
    Icon: FcGoogle,
    labelKey: "providers.google",
  },
  {
    id: "github",
    Icon: AiFillGithub,
    labelKey: "providers.github",
  },
]

const LoginDialog = () => {
  const loginDialog = useLoginDialog()
  const registerDialog = useRegisterDialog()
  const t = useTranslations("authDialog")
  const [pendingProvider, setPendingProvider] = useState<ProviderId | null>(null)

  const handleProviderClick = async (provider: ProviderId) => {
    setPendingProvider(provider)

    try {
      await signIn(provider)
      loginDialog.onClose()
    } catch (error) {
      console.error("OAuth sign-in failed", error)
    } finally {
      setPendingProvider(null)
    }
  }

  const handleSwitch = () => {
    loginDialog.onClose()
    registerDialog.onOpen()
  }

  return (
    <Dialog open={loginDialog.isOpen} onOpenChange={(open: boolean) => (!open ? loginDialog.onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("login.title")}</DialogTitle>
          <DialogDescription>{t("login.description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          {providers.map(({ id, Icon, labelKey }) => (
            <Button
              key={id}
              type="button"
              variant="outline"
              className="justify-start gap-2"
              disabled={Boolean(pendingProvider)}
              onClick={() => handleProviderClick(id)}
            >
              {pendingProvider === id ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Icon className="size-5" aria-hidden="true" />
              )}
              <span className="flex-1 text-left">{t(labelKey)}</span>
            </Button>
          ))}
        </div>

        <DialogFooter className="flex-col items-center gap-1">
          <p className="text-sm text-muted-foreground">
            {t("login.switchPrompt")}{" "}
            <button
              type="button"
              onClick={handleSwitch}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t("login.switchAction")}
            </button>
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default LoginDialog
