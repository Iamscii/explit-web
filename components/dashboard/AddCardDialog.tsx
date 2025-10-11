'use client'

import { useCallback, useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useForm } from "react-hook-form"
import { z } from "zod"

import type {
  SafeCard,
  SafeDeck,
  SafeField,
  SafeFieldPreference,
  SafeTemplate,
} from "@/types/data"
import { CardFace, FieldType } from "@/types/data"
import { useSyncOperations } from "@/hooks/use-sync-operations"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type CardFormValues = {
  deckId: string
  templateId: string
  fieldValues: Record<string, string>
}

const cardSchema = z.object({
  deckId: z.string().trim().min(1),
  templateId: z.string().trim().min(1),
  fieldValues: z.record(z.string()),
})

interface TemplateFieldMeta {
  field: SafeField
  preference?: SafeFieldPreference
}

interface TemplateFieldGroups {
  orderedIds: string[]
  groups: Record<CardFace, TemplateFieldMeta[]>
}

const FIELD_GROUP_ORDER: CardFace[] = [CardFace.FRONT, CardFace.BACK, CardFace.UNCATEGORIZED]

export interface AddCardDialogProps {
  userId?: string | null
  templates: SafeTemplate[]
  decks: SafeDeck[]
  disabled?: boolean
  onCompleted: (feedback: { type: "success" | "error"; message: string }) => void
}

const buildTemplateGroups = (
  templateId: string | undefined,
  fields: Record<string, SafeField>,
  idsByTemplate: Record<string, string[]>,
  preferencesById: Record<string, SafeFieldPreference>,
  preferencesByTemplate: Record<string, string[]>,
): TemplateFieldGroups => {
  if (!templateId) {
    return {
      orderedIds: [],
      groups: {
        [CardFace.FRONT]: [],
        [CardFace.BACK]: [],
        [CardFace.UNCATEGORIZED]: [],
      },
    }
  }

  const fieldIdsForTemplate = idsByTemplate[templateId] ?? []
  const fieldMap = fieldIdsForTemplate
    .map((fieldId) => fields[fieldId])
    .filter((field): field is SafeField => Boolean(field))

  const groups: TemplateFieldGroups["groups"] = {
    [CardFace.FRONT]: [],
    [CardFace.BACK]: [],
    [CardFace.UNCATEGORIZED]: [],
  }

  const preferenceIds = preferencesByTemplate[templateId] ?? []
  const orderedFieldIds: string[] = []

  const preferenceEntries = preferenceIds
    .map((id) => preferencesById[id])
    .filter((pref): pref is SafeFieldPreference => Boolean(pref))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  const seenFieldIds = new Set<string>()

  preferenceEntries.forEach((preference) => {
    const field = fields[preference.fieldId]
    if (!field || seenFieldIds.has(field.id)) return
    seenFieldIds.add(field.id)
    const groupKey = preference.face ?? CardFace.UNCATEGORIZED
    groups[groupKey].push({ field, preference })
    orderedFieldIds.push(field.id)
  })

  fieldMap.forEach((field) => {
    if (seenFieldIds.has(field.id)) return
    seenFieldIds.add(field.id)
    groups[CardFace.UNCATEGORIZED].push({ field })
    orderedFieldIds.push(field.id)
  })

  return { orderedIds: orderedFieldIds, groups }
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
  const [open, setOpen] = useState(false)

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

  const form = useForm<CardFormValues>({
    resolver: zodResolver(cardSchema),
    defaultValues: {
      deckId: deckOptions[0]?.id ?? "",
      templateId: templateOptions[0]?.id ?? "",
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
    [watchTemplateId, fieldState.byId, fieldState.idsByTemplate, fieldPreferenceState.byId, fieldPreferenceState.idsByTemplate],
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

  const resetForm = useCallback(() => {
    form.reset({
      deckId: deckOptions[0]?.id ?? "",
      templateId: templateOptions[0]?.id ?? "",
      fieldValues: {},
    })
  }, [deckOptions, form, templateOptions])

  const closeDialog = useCallback(() => {
    setOpen(false)
    resetForm()
  }, [resetForm])

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
        form.setError(`fieldValues.${fieldId}` as const, {
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
                  <p className="text-muted-foreground text-sm">
                    {formT("errors.templateFieldsMissing")}
                  </p>
                ) : (
                  <div className="space-y-6">
                    {sections.map((section) => (
                      <div key={section.key} className="space-y-4">
                        <h3 className="text-base font-semibold">{section.title}</h3>
                        <div className="space-y-4">
                          {section.items.map(({ field: templateField }) => {
                            const fieldPath = `fieldValues.${templateField.id}` as const
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
                                      <span className="text-muted-foreground ml-2 text-xs uppercase tracking-wide">
                                        {formT(`fieldTypes.${templateField.type}`)}
                                      </span>
                                    </FormLabel>
                                    <FormControl>
                                      <InputComponent
                                        {...field}
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
