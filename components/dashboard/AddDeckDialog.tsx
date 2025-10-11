'use client'

import { useCallback, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useForm } from "react-hook-form"
import { z } from "zod"

import type { SafeDeck } from "@/types/data"
import { DeckType } from "@/types/data"
import { useSyncOperations } from "@/hooks/use-sync-operations"
import { useAppDispatch } from "@/redux/hooks"
import { upsertDeck } from "@/redux/slices/deckSlice"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"

export type DeckFormValues = z.infer<typeof deckSchema>

const deckSchema = z.object({
  name: z.string().trim().min(1),
  description: z
    .string()
    .trim()
    .optional(),
  parentId: z
    .string()
    .trim()
    .optional(),
})

export interface AddDeckDialogProps {
  userId?: string | null
  existingDecks: SafeDeck[]
  disabled?: boolean
  onCompleted: (feedback: { type: "success" | "error"; message: string }) => void
}

const NO_PARENT_VALUE = "__none__"

export const AddDeckDialog = ({
  userId,
  existingDecks,
  disabled,
  onCompleted,
}: AddDeckDialogProps) => {
  const [open, setOpen] = useState(false)
  const { enqueueDeckUpsert } = useSyncOperations()
  const dispatch = useAppDispatch()
  const formT = useTranslations("dashboard.form")
  const actionT = useTranslations("dashboard.actions.decks")

  const form = useForm<DeckFormValues>({
    resolver: zodResolver(deckSchema),
    defaultValues: {
      name: "",
      description: "",
      parentId: undefined,
    },
  })

  const sortedDecks = useMemo(
    () => [...existingDecks].sort((a, b) => a.name.localeCompare(b.name)),
    [existingDecks],
  )

  const resetForm = useCallback(() => {
    form.reset({
      name: "",
      description: "",
      parentId: undefined,
    })
  }, [form])

  const closeDialog = useCallback(() => {
    setOpen(false)
    resetForm()
  }, [resetForm])

  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : formT("unknownError")

  const onSubmit = async (values: DeckFormValues) => {
    if (!userId) {
      onCompleted({ type: "error", message: formT("notSignedIn") })
      return
    }

    const now = new Date().toISOString()
    const deck: SafeDeck = {
      id: crypto.randomUUID(),
      name: values.name,
      type: DeckType.USER,
      description: values.description && values.description.length > 0 ? values.description : null,
      parentId:
        values.parentId && values.parentId !== NO_PARENT_VALUE && values.parentId.length > 0
          ? values.parentId
          : null,
      createdAt: now,
      lastModifiedAt: now,
      deletedAt: null,
      lastAccessedAt: null,
      createdById: userId,
      ownedById: userId,
      favorited: false,
      cardCount: 0,
      children: [],
    }

    try {
      await enqueueDeckUpsert(deck)
      dispatch(upsertDeck(deck))
      onCompleted({ type: "success", message: actionT("success") })
      closeDialog()
    } catch (error) {
      onCompleted({
        type: "error",
        message: actionT("error", { message: getErrorMessage(error) }),
      })
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeDialog()
        } else if (!disabled) {
          setOpen(true)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={disabled}>{actionT("button")}</Button>
      </DialogTrigger>
      {open && (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionT("title")}</DialogTitle>
            <DialogDescription>{actionT("description")}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void form.handleSubmit(onSubmit)(event)
              }}
              className="grid gap-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{formT("labels.name")}</FormLabel>
                    <FormControl>
                      <Input placeholder={formT("placeholders.name")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{formT("labels.description")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={formT("placeholders.description")}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>{formT("descriptions.deckDescription")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{formT("labels.parentDeck")}</FormLabel>
                    <Select
                      value={
                        field.value && field.value.length > 0 ? field.value : NO_PARENT_VALUE
                      }
                      onValueChange={(value) => {
                        field.onChange(value === NO_PARENT_VALUE ? "" : value)
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={formT("placeholders.parentDeck")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_PARENT_VALUE}>{formT("noParent")}</SelectItem>
                        {sortedDecks.map((deck) => (
                          <SelectItem key={deck.id} value={deck.id}>
                            {deck.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>{formT("descriptions.parentDeck")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => closeDialog()}
                >
                  {formT("cancel")}
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? formT("saving") : formT("submit")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      )}
    </Dialog>
  )
}

export default AddDeckDialog
