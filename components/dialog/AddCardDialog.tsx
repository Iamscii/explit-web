'use client'

import { useCallback, useEffect, useMemo } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { useSyncOperations } from "@/hooks/use-sync-operations"
import useAddCardDialog from "@/hooks/dialog/use-add-card-dialog"
import { useAppDispatch, useAppSelector } from "@/redux/hooks"
import { upsertCard } from "@/redux/slices/cardSlice"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { SafeCard, SafeDeck, SafeTemplate } from "@/types/data"
import { CardFace, DeckType, FieldType } from "@prisma/client"
import {
  FIELD_GROUP_ORDER,
  buildTemplateGroups,
  type TemplateFieldMeta,
} from "@/lib/templates/groups"


const cardSchema = z.object({
  deckId: z.string().trim().min(1),
  templateId: z.string().trim().min(1),
  fieldValues: z.record(z.string(), z.string()),
})

type CardFormValues = z.infer<typeof cardSchema>
type FieldValueKey = `fieldValues.${string}`

export interface AddCardDialogProps {
  userId?: string | null
  templates: SafeTemplate[]
  decks: SafeDeck[]
  disabled?: boolean
  onCompleted: (feedback: { type: "success" | "error"; message: string }) => void
}
const resolveInputComponent = (fieldType: FieldType) => {
  switch (fieldType) {
    case FieldType.TEXT:
    case FieldType.AUDIO:
    case FieldType.IMAGE:
    case FieldType.VIDEO:
      return Input
    case FieldType.RICH_TEXT:
    case FieldType.CHOICE:
    default:
      return Textarea
  }
}

export const AddCardDialog = ({
  userId,
  templates,
  decks,
  disabled,
  onCompleted,
}: AddCardDialogProps) => {
  const { onOpen, onClose, isOpen } = useAddCardDialog()
  const { enqueueCardUpsert } = useSyncOperations()
  const dispatch = useAppDispatch()

  const formT = useTranslations("dashboard.form")
  const actionT = useTranslations("dashboard.actions.cards")

  const deckOptions = useMemo(
    () => [...decks].sort((a, b) => a.name.localeCompare(b.name)),
    [decks],
  )
  const templateOptions = useMemo(
    () => [...templates].sort((a, b) => a.name.localeCompare(b.name)),
    [templates],
  )

  const userPreferences = useAppSelector((state) => state.userPreferences.value)
  const preferredDeckId = userPreferences?.defaultDeck ?? undefined
  const preferredTemplateId = userPreferences?.defaultCardTemplate ?? undefined

  const defaultDeckId = useMemo(() => {
    if (!deckOptions.length) {
      return ""
    }

    if (preferredDeckId && deckOptions.some((deck) => deck.id === preferredDeckId)) {
      return preferredDeckId
    }

    const allDeck = deckOptions.find((deck) => deck.type === DeckType.ALL)
    if (allDeck) {
      return allDeck.id
    }

    return deckOptions[0]!.id
  }, [deckOptions, preferredDeckId])

  const defaultTemplateId = useMemo(() => {
    if (!templateOptions.length) {
      return ""
    }

    if (
      preferredTemplateId &&
      templateOptions.some((template) => template.id === preferredTemplateId)
    ) {
      return preferredTemplateId
    }

    return templateOptions[0]!.id
  }, [preferredTemplateId, templateOptions])

  const form = useForm<CardFormValues>({
    resolver: zodResolver(cardSchema),
    defaultValues: {
      deckId: defaultDeckId,
      templateId: defaultTemplateId,
      fieldValues: {},
    },
  })

  const fieldState = useAppSelector((state) => state.field)
  const fieldPreferenceState = useAppSelector((state) => state.fieldPreference)

  const watchTemplateId = form.watch("templateId")

  const templateGroups = useMemo(
    () =>
      buildTemplateGroups(
        watchTemplateId,
        fieldState.byId,
        fieldState.idsByTemplate,
        fieldPreferenceState.byId,
        fieldPreferenceState.idsByTemplate,
      ),
    [
      watchTemplateId,
      fieldState.byId,
      fieldState.idsByTemplate,
      fieldPreferenceState.byId,
      fieldPreferenceState.idsByTemplate,
    ],
  )

  useEffect(() => {
    const orderedIds = templateGroups.orderedIds
    if (!orderedIds.length) {
      form.setValue("fieldValues", {}, { shouldDirty: false })
      return
    }

    const currentValues = form.getValues("fieldValues")
    const nextValues: Record<string, string> = {}
    let changed = false

    orderedIds.forEach((fieldId) => {
      const existing = currentValues[fieldId]
      nextValues[fieldId] = typeof existing === "string" ? existing : ""
      if (existing === undefined) {
        changed = true
      }
    })

    if (Object.keys(currentValues).length !== Object.keys(nextValues).length) {
      changed = true
    }

    if (changed) {
      form.setValue("fieldValues", nextValues, { shouldDirty: false })
    }
  }, [form, templateGroups.orderedIds])

  const hasTemplates = templateOptions.length > 0
  const hasDecks = deckOptions.length > 0

  useEffect(() => {
    if (!isOpen) return
    if (!deckOptions.length) return
    const currentDeckId = form.getValues("deckId")
    const nextDeckId = defaultDeckId
    const deckIsValid = currentDeckId && deckOptions.some((deck) => deck.id === currentDeckId)
    if (!deckIsValid) {
      form.setValue("deckId", nextDeckId, { shouldDirty: false })
    }
  }, [deckOptions, defaultDeckId, form, isOpen])

  useEffect(() => {
    if (!isOpen) return
    if (!templateOptions.length) return
    const currentTemplateId = form.getValues("templateId")
    const nextTemplateId = defaultTemplateId
    const templateIsValid =
      currentTemplateId && templateOptions.some((template) => template.id === currentTemplateId)
    if (!templateIsValid) {
      form.setValue("templateId", nextTemplateId, { shouldDirty: false })
    }
  }, [defaultTemplateId, form, isOpen, templateOptions])

  const resetForm = useCallback(() => {
    form.reset({
      deckId: defaultDeckId,
      templateId: defaultTemplateId,
      fieldValues: {},
    })
  }, [defaultDeckId, defaultTemplateId, form])

  const closeDialog = useCallback(() => {
    onClose()
    resetForm()
  }, [onClose, resetForm])

  useEffect(() => {
    if (disabled && isOpen) {
      closeDialog()
    }
  }, [closeDialog, disabled, isOpen])

  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : formT("unknownError")

  const onSubmit = async (values: CardFormValues) => {
    if (!userId) {
      onCompleted({ type: "error", message: formT("notSignedIn") })
      return
    }

    if (!templateGroups.orderedIds.length) {
      onCompleted({
        type: "error",
        message: actionT("error", { message: formT("errors.templateFieldsMissing") }),
      })
      return
    }

    let hasEmptyField = false

    templateGroups.orderedIds.forEach((fieldId) => {
      const raw = values.fieldValues[fieldId] ?? ""
      if (!raw.trim()) {
        hasEmptyField = true
        form.setError(`fieldValues.${fieldId}` as FieldValueKey, {
          type: "manual",
          message: formT("errors.fieldValueRequired"),
        })
      }
    })

    if (hasEmptyField) {
      return
    }

    const orderedValues = templateGroups.orderedIds.map(
      (fieldId) => values.fieldValues[fieldId]?.trim() ?? "",
    )

    const now = new Date().toISOString()
    const selectedDeck = deckOptions.find((deck) => deck.id === values.deckId)

    const card: SafeCard = {
      id: crypto.randomUUID(),
      templateId: values.templateId,
      createdById: userId,
      ownedById: userId,
      fieldValues: orderedValues,
      createdAt: now,
      lastModifiedAt: now,
      deletedAt: null,
      lastAccessedAt: null,
      primaryDeckId: values.deckId,
      deckNames: selectedDeck ? [selectedDeck.name] : [],
    }

    try {
      await enqueueCardUpsert(card)
      dispatch(upsertCard(card))
      onCompleted({ type: "success", message: actionT("success") })
      closeDialog()
    } catch (error) {
      onCompleted({
        type: "error",
        message: actionT("error", { message: getErrorMessage(error) }),
      })
    }
  }

  const sections = useMemo(() => {
    return FIELD_GROUP_ORDER.map((groupKey) => {
      const items = templateGroups.groups[groupKey]
      if (!items?.length) {
        return null
      }

      const titleKey =
        groupKey === CardFace.FRONT
          ? "fieldSections.front"
          : groupKey === CardFace.BACK
            ? "fieldSections.back"
            : "fieldSections.uncategorized"

      return {
        key: groupKey,
        title: formT(titleKey),
        items,
      }
    }).filter(Boolean) as Array<{ key: CardFace | "UNCATEGORIZED"; title: string; items: TemplateFieldMeta[] }>
  }, [formT, templateGroups.groups])

  return (
    <Dialog
      open={isOpen && !disabled}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeDialog()
        } else if (!disabled) {
          onOpen()
        }
      }}
    >
      {isOpen && !disabled && (
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{actionT("title")}</DialogTitle>
            <DialogDescription>{actionT("description")}</DialogDescription>
          </DialogHeader>

          {(!hasTemplates || !hasDecks) && (
            <div className="grid gap-4">
              {!hasDecks && (
                <p className="text-sm text-muted-foreground">
                  {formT("errors.noDecks")}
                </p>
              )}
              {!hasTemplates && (
                <p className="text-sm text-muted-foreground">
                  {actionT("noTemplates")}
                </p>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => closeDialog()}>
                  {formT("close")}
                </Button>
              </DialogFooter>
            </div>
          )}

          {hasTemplates && hasDecks && (
            <Form {...form}>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void form.handleSubmit(onSubmit)(event)
                }}
                className="space-y-6"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="deckId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{formT("labels.deck")}</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(value) => field.onChange(value)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={formT("placeholders.deck")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {deckOptions.map((deck) => (
                              <SelectItem key={deck.id} value={deck.id}>
                                {deck.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>{formT("descriptions.deck")}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="templateId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{formT("labels.template")}</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(value) => field.onChange(value)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={formT("placeholders.template")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {templateOptions.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>{formT("descriptions.template")}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {!templateGroups.orderedIds.length ? (
                  <p className="text-sm text-muted-foreground">
                    {formT("errors.templateFieldsMissing")}
                  </p>
                ) : (
                  <div className="space-y-6">
                    {sections.map((section) => (
                      <div key={section.key} className="space-y-4">
                        <h3 className="text-base font-semibold">{section.title}</h3>
                        <div className="space-y-4">
                          {section.items.map(({ field: templateField }) => {
                            const fieldPath = `fieldValues.${templateField.id}` as FieldValueKey
                            const InputComponent = resolveInputComponent(templateField.type)

                            return (
                              <FormField
                                key={templateField.id}
                                control={form.control}
                                name={fieldPath}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>
                                      {templateField.name}
                                      <span className="ml-2 text-xs uppercase tracking-wide text-muted-foreground">
                                        {formT(`fieldTypes.${templateField.type}`)}
                                      </span>
                                    </FormLabel>
                                    <FormControl>
                                      <InputComponent
                                        {...field}
                                        value={typeof field.value === "string" ? field.value : ""}
                                        rows={InputComponent === Textarea ? 3 : undefined}
                                        placeholder={formT("placeholders.fieldValue")}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => closeDialog()}>
                    {formT("cancel")}
                  </Button>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? formT("saving") : formT("submit")}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      )}
    </Dialog>
  )
}

export default AddCardDialog
