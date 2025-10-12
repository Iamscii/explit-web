"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";

import type {
  SafeField,
  SafeFieldPreference,
  SafeStyle,
  SafeTemplate,
} from "@/types/data";
import { CardFace, FieldRole, FieldType, TemplateType } from "@prisma/client";
import useAddTemplateDialog from "@/hooks/dialog/use-add-template-dialog";
import { useSyncOperations } from "@/hooks/use-sync-operations";
import { useAppDispatch } from "@/redux/hooks";
import { setFieldsForTemplate } from "@/redux/slices/fieldSlice";
import { upsertFieldPreference } from "@/redux/slices/fieldPreferenceSlice";
import { upsertTemplate } from "@/redux/slices/templateSlice";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface AddTemplateDialogProps {
  userId?: string | null;
  disabled?: boolean;
  onCompleted: (feedback: {
    type: "success" | "error";
    message: string;
  }) => void;
}

interface TemplateFieldDraft {
  id: string;
  name: string;
  type: FieldType;
}

interface TemplatePreferenceDraft {
  id: string;
  fieldId: string;
  role?: FieldRole | "";
  face: CardFace;
}

const STYLE_JSON_PLACEHOLDER = JSON.stringify(
  { background: "#ffffff" },
  null,
  2
);
const SETTINGS_JSON_PLACEHOLDER = JSON.stringify({ shuffle: true }, null, 2);
const DEFAULT_PREVIEW_STYLE: CSSProperties = {
  background: "#ffffff",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  color: "inherit",
};

const templateSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  type: z.nativeEnum(TemplateType),
  settings: z.string().optional(),
  styleJson: z.string().optional(),
});

type TemplateFormValues = z.infer<typeof templateSchema>;

const fieldRoleOptions: (FieldRole | "none")[] = [
  "none",
  ...Object.values(FieldRole),
];

interface TemplatePresetDrafts {
  fields: TemplateFieldDraft[];
  frontPreferences: TemplatePreferenceDraft[];
  backPreferences: TemplatePreferenceDraft[];
}

const createPresetDrafts = (
  templateType: TemplateType
): TemplatePresetDrafts => {
  const makeField = (name: string, type: FieldType): TemplateFieldDraft => ({
    id: crypto.randomUUID(),
    name,
    type,
  });

  const makePref = (
    fieldId: string,
    face: CardFace,
    role?: FieldRole
  ): TemplatePreferenceDraft => ({
    id: crypto.randomUUID(),
    fieldId,
    face,
    role,
  });

  switch (templateType) {
    case TemplateType.CHOICE: {
      const question = makeField("Question", FieldType.TEXT);
      const options = makeField("Options", FieldType.CHOICE);
      const answer = makeField("Answer", FieldType.TEXT);
      return {
        fields: [question, options, answer],
        frontPreferences: [
          makePref(question.id, CardFace.FRONT, FieldRole.QUESTION),
          makePref(options.id, CardFace.FRONT, FieldRole.OPTION),
        ],
        backPreferences: [makePref(answer.id, CardFace.BACK, FieldRole.ANSWER)],
      };
    }
    case TemplateType.CLOZE: {
      const passage = makeField("Passage", FieldType.RICH_TEXT);
      const answer = makeField("Cloze Answer", FieldType.TEXT);
      return {
        fields: [passage, answer],
        frontPreferences: [
          makePref(passage.id, CardFace.FRONT, FieldRole.PASSAGE),
        ],
        backPreferences: [makePref(answer.id, CardFace.BACK, FieldRole.ANSWER)],
      };
    }
    case TemplateType.SPELLING: {
      const prompt = makeField("Prompt", FieldType.TEXT);
      const answer = makeField("Answer", FieldType.TEXT);
      return {
        fields: [prompt, answer],
        frontPreferences: [
          makePref(prompt.id, CardFace.FRONT, FieldRole.SPELLING_PROMPT),
        ],
        backPreferences: [makePref(answer.id, CardFace.BACK, FieldRole.ANSWER)],
      };
    }
    case TemplateType.READING: {
      const passage = makeField("Passage", FieldType.RICH_TEXT);
      const guidance = makeField("Guidance", FieldType.TEXT);
      const comprehension = makeField("Comprehension", FieldType.TEXT);
      return {
        fields: [passage, guidance, comprehension],
        frontPreferences: [
          makePref(passage.id, CardFace.FRONT, FieldRole.PASSAGE),
          makePref(guidance.id, CardFace.FRONT, FieldRole.HINT),
        ],
        backPreferences: [
          makePref(comprehension.id, CardFace.BACK, FieldRole.ANSWER),
        ],
      };
    }
    case TemplateType.BASIC:
    default: {
      const question = makeField("Question", FieldType.TEXT);
      const answer = makeField("Answer", FieldType.TEXT);
      return {
        fields: [question, answer],
        frontPreferences: [
          makePref(question.id, CardFace.FRONT, FieldRole.QUESTION),
        ],
        backPreferences: [makePref(answer.id, CardFace.BACK, FieldRole.ANSWER)],
      };
    }
  }
};

interface FieldDraftListProps {
  drafts: TemplateFieldDraft[];
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<TemplateFieldDraft>) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  hasMultiple: boolean;
  translations: (key: string) => string;
}

const FieldDraftList = ({
  drafts,
  onAdd,
  onUpdate,
  onRemove,
  onMove,
  hasMultiple,
  translations,
}: FieldDraftListProps) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <h3 className="text-base font-semibold">
        {translations("sections.fields")}
      </h3>
      <Button type="button" size="sm" variant="outline" onClick={onAdd}>
        <PlusIcon className="mr-2 size-4" />
        {translations("fields.add")}
      </Button>
    </div>

    <div className="space-y-2">
      {drafts.map((draft, index) => (
        <div
          key={draft.id}
          className="border-border flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-end"
        >
          <div className="grid flex-1 gap-2 md:grid-cols-2 md:gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground text-xs uppercase tracking-wide">
                {translations("labels.fieldName")}
              </span>
              <Input
                value={draft.name}
                onChange={(event) =>
                  onUpdate(draft.id, { name: event.target.value })
                }
                placeholder={translations("placeholders.fieldName")}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground text-xs uppercase tracking-wide">
                {translations("labels.fieldType")}
              </span>
              <Select
                value={draft.type}
                onValueChange={(value) =>
                  onUpdate(draft.id, { type: value as FieldType })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(FieldType).map((fieldType) => (
                    <SelectItem key={fieldType} value={fieldType}>
                      {translations(`fieldTypes.${fieldType}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          <div className="flex items-center gap-2 md:flex-col md:items-stretch md:justify-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:h-9 md:w-9"
              onClick={() => onMove(draft.id, "up")}
              disabled={index === 0}
            >
              <ArrowUpIcon className="size-4" />
              <span className="sr-only">{translations("fields.moveUp")}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:h-9 md:w-9"
              onClick={() => onMove(draft.id, "down")}
              disabled={index === drafts.length - 1}
            >
              <ArrowDownIcon className="size-4" />
              <span className="sr-only">{translations("fields.moveDown")}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive md:h-9 md:w-9"
              onClick={() => onRemove(draft.id)}
              disabled={!hasMultiple}
            >
              <Trash2Icon className="size-4" />
              <span className="sr-only">{translations("fields.remove")}</span>
            </Button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

interface FieldPreferenceListProps {
  face: CardFace;
  drafts: TemplatePreferenceDraft[];
  fields: TemplateFieldDraft[];
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<TemplatePreferenceDraft>) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  translations: (key: string) => string;
}

const FieldPreferenceList = ({
  face,
  drafts,
  fields,
  onAdd,
  onUpdate,
  onRemove,
  onMove,
  translations,
}: FieldPreferenceListProps) => {
  const headingKey = face === CardFace.FRONT ? "front" : "back";
  const heading = translations(`fieldSections.${headingKey}`);
  const addLabel = translations("preferences.add");
  const emptyLabel = translations("preferences.empty");
  const fieldLabel = translations("preferences.field");
  const roleLabel = translations("preferences.role");
  const missingFieldLabel = translations("preferences.missingField");

  const hasFields = fields.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{heading}</h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onAdd}
          disabled={!hasFields}
        >
          <PlusIcon className="mr-2 size-4" />
          {addLabel}
        </Button>
      </div>

      {!hasFields ? (
        <p className="text-muted-foreground text-sm">{emptyLabel}</p>
      ) : drafts.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {translations("preferences.emptySlots")}
        </p>
      ) : (
        <div className="space-y-2">
          {drafts.map((draft, index) => {
            const field = fields.find((item) => item.id === draft.fieldId);

            return (
              <div
                key={draft.id}
                className="border-border flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-end"
              >
                <div className="grid flex-1 gap-2 md:grid-cols-2 md:gap-3">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-muted-foreground text-xs uppercase tracking-wide">
                      {fieldLabel}
                    </span>
                    <Select
                      value={draft.fieldId}
                      onValueChange={(value) =>
                        onUpdate(draft.id, { fieldId: value })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={missingFieldLabel} />
                      </SelectTrigger>
                      <SelectContent>
                        {fields.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!field && (
                      <span className="text-muted-foreground text-xs">
                        {missingFieldLabel}
                      </span>
                    )}
                  </label>

                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-muted-foreground text-xs uppercase tracking-wide">
                      {roleLabel}
                    </span>
                    <Select
                      value={draft.role ?? "none"}
                      onValueChange={(value) =>
                        onUpdate(draft.id, {
                          role: value === "none" ? "" : (value as FieldRole),
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fieldRoleOptions.map((roleOption) =>
                          roleOption === "none" ? (
                            <SelectItem key="none" value="none">
                              {translations("fieldRoles.none")}
                            </SelectItem>
                          ) : (
                            <SelectItem key={roleOption} value={roleOption}>
                              {translations(`fieldRoles.${roleOption}`)}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                  </label>
                </div>

                <div className="flex items-center gap-2 md:flex-col md:items-stretch md:justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="md:h-9 md:w-9"
                    onClick={() => onMove(draft.id, "up")}
                    disabled={index === 0}
                  >
                    <ArrowUpIcon className="size-4" />
                    <span className="sr-only">
                      {translations("fields.moveUp")}
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="md:h-9 md:w-9"
                    onClick={() => onMove(draft.id, "down")}
                    disabled={index === drafts.length - 1}
                  >
                    <ArrowDownIcon className="size-4" />
                    <span className="sr-only">
                      {translations("fields.moveDown")}
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive md:h-9 md:w-9"
                    onClick={() => onRemove(draft.id)}
                  >
                    <Trash2Icon className="size-4" />
                    <span className="sr-only">
                      {translations("fields.remove")}
                    </span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface TemplatePreviewProps {
  heading: string;
  title: string;
  body: string;
  style: CSSProperties;
  error?: string | null;
}

const TemplatePreview = ({
  heading,
  title,
  body,
  style,
  error,
}: TemplatePreviewProps) => {
  const flexDirection =
    (style.flexDirection as CSSProperties["flexDirection"]) ?? "column";
  const isHorizontal = flexDirection === "row";
  const writingMode: CSSProperties["writingMode"] = isHorizontal
    ? "vertical-rl"
    : "horizontal-tb";
  const textOrientation: CSSProperties["textOrientation"] = isHorizontal
    ? "upright"
    : "mixed";

  const resolvedStyle: CSSProperties = {
    display: "flex",
    flex: 1,
    gap: "1rem",
    alignItems: "center",
    justifyContent: "center",
    padding: "1.5rem",
    ...style,
  };

  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold">{heading}</h3>
      <div className="relative aspect-square">
        <div
          aria-hidden
          className="absolute inset-0 rounded-md"
          style={{
            backgroundImage:
              "linear-gradient(45deg, rgba(0,0,0,0.08) 25%, transparent 25%), " +
              "linear-gradient(-45deg, rgba(0,0,0,0.08) 25%, transparent 25%), " +
              "linear-gradient(45deg, transparent 75%, rgba(0,0,0,0.08) 75%), " +
              "linear-gradient(-45deg, transparent 75%, rgba(0,0,0,0.08) 75%)",
            backgroundSize: "20px 20px",
            backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
          }}
        />
        <div
          className="absolute inset-4 rounded-md border shadow-sm"
          style={resolvedStyle}
        >
          <h4
            className="m-0 text-lg font-semibold"
            style={{ writingMode, textOrientation }}
          >
            {title}
          </h4>
          <p className="m-0 text-sm" style={{ writingMode, textOrientation }}>
            {body}
          </p>
        </div>
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </section>
  );
};

export const AddTemplateDialog = ({
  userId,
  disabled,
  onCompleted,
}: AddTemplateDialogProps) => {
  const { isOpen, onOpen, onClose } = useAddTemplateDialog();
  const initialPreset = useMemo(
    () => createPresetDrafts(TemplateType.BASIC),
    []
  );
  const [fieldDrafts, setFieldDrafts] = useState<TemplateFieldDraft[]>(
    initialPreset.fields
  );
  const [frontPreferenceDrafts, setFrontPreferenceDrafts] = useState<
    TemplatePreferenceDraft[]
  >(initialPreset.frontPreferences);
  const [backPreferenceDrafts, setBackPreferenceDrafts] = useState<
    TemplatePreferenceDraft[]
  >(initialPreset.backPreferences);
  const [fieldsDirty, setFieldsDirty] = useState(false);
  const [structureError, setStructureError] = useState<string | null>(null);

  const {
    enqueueTemplateUpsert,
    enqueueStyleUpsert,
    enqueueFieldUpsert,
    enqueueFieldPreferenceUpsert,
  } = useSyncOperations();
  const dispatch = useAppDispatch();

  const formT = useTranslations("dashboard.form");
  const actionT = useTranslations("dashboard.actions.templates");
  const templateTypeOptions = useMemo(
    () => Object.values(TemplateType) as TemplateType[],
    []
  );

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: "",
      description: "",
      type: TemplateType.BASIC,
      settings: "",
      styleJson: STYLE_JSON_PLACEHOLDER,
    },
  });

  const styleJsonValue = form.watch("styleJson");
  const styleParseErrorLabel = formT("errors.stylePreview");

  const { previewStyle, styleParseError } = useMemo(() => {
    const fallbackStyle: CSSProperties = { ...DEFAULT_PREVIEW_STYLE };

    if (!styleJsonValue || !styleJsonValue.trim()) {
      return { previewStyle: fallbackStyle, styleParseError: null };
    }

    try {
      const parsed = JSON.parse(styleJsonValue);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const nextStyle: CSSProperties = {};
        Object.entries(parsed).forEach(([key, value]) => {
          if (typeof value === "string" || typeof value === "number") {
            (nextStyle as Record<string, unknown>)[key] = value;
          }
        });
        return {
          previewStyle: { ...fallbackStyle, ...nextStyle },
          styleParseError: null,
        };
      }
    } catch {
      return {
        previewStyle: fallbackStyle,
        styleParseError: styleParseErrorLabel,
      };
    }

    return {
      previewStyle: fallbackStyle,
      styleParseError: styleParseErrorLabel,
    };
  }, [styleJsonValue, styleParseErrorLabel]);

  const resetState = useCallback(() => {
    const preset = createPresetDrafts(TemplateType.BASIC);
    setFieldDrafts(preset.fields);
    setFrontPreferenceDrafts(preset.frontPreferences);
    setBackPreferenceDrafts(preset.backPreferences);
    setFieldsDirty(false);
    setStructureError(null);
  }, []);

  const resetForm = useCallback(() => {
    form.reset({
      name: "",
      description: "",
      type: TemplateType.BASIC,
      settings: "",
      styleJson: STYLE_JSON_PLACEHOLDER,
    });
    resetState();
  }, [form, resetState]);

  const closeDialog = useCallback(() => {
    onClose();
    resetForm();
  }, [onClose, resetForm]);

  useEffect(() => {
    if (disabled && isOpen) {
      closeDialog();
    }
  }, [closeDialog, disabled, isOpen]);

  const applyPresetForType = useCallback((templateType: TemplateType) => {
    const preset = createPresetDrafts(templateType);
    setFieldDrafts(preset.fields);
    setFrontPreferenceDrafts(preset.frontPreferences);
    setBackPreferenceDrafts(preset.backPreferences);
    setFieldsDirty(false);
    setStructureError(null);
  }, []);

  const reorderDraft = useCallback((id: string, direction: "up" | "down") => {
    setFieldDrafts((current) => {
      const index = current.findIndex((draft) => draft.id === id);
      if (index < 0) return current;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= current.length) return current;

      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setStructureError(null);
    setFieldsDirty(true);
  }, []);

  const updateDraft = useCallback(
    (id: string, updates: Partial<TemplateFieldDraft>) => {
      setFieldDrafts((current) =>
        current.map((draft) =>
          draft.id === id ? { ...draft, ...updates } : draft
        )
      );
      setStructureError(null);
      setFieldsDirty(true);
    },
    []
  );

  const addDraft = useCallback(() => {
    setFieldDrafts((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: formT("placeholders.fieldName"),
        type: FieldType.TEXT,
      },
    ]);
    setStructureError(null);
    setFieldsDirty(true);
  }, [formT]);

  const removeDraft = useCallback((id: string) => {
    setFieldDrafts((current) => current.filter((draft) => draft.id !== id));
    setFrontPreferenceDrafts((current) =>
      current.filter((pref) => pref.fieldId !== id)
    );
    setBackPreferenceDrafts((current) =>
      current.filter((pref) => pref.fieldId !== id)
    );
    setStructureError(null);
    setFieldsDirty(true);
  }, []);

  const addPreference = useCallback(
    (face: CardFace) => {
      if (!fieldDrafts.length) {
        return;
      }

      const defaultFieldId = fieldDrafts[0].id;
      const draft: TemplatePreferenceDraft = {
        id: crypto.randomUUID(),
        fieldId: defaultFieldId,
        role: "",
        face,
      };

      if (face === CardFace.FRONT) {
        setFrontPreferenceDrafts((current) => [...current, draft]);
      } else {
        setBackPreferenceDrafts((current) => [...current, draft]);
      }
      setStructureError(null);
      setFieldsDirty(true);
    },
    [fieldDrafts]
  );

  const updatePreference = useCallback(
    (face: CardFace, id: string, updates: Partial<TemplatePreferenceDraft>) => {
      const setter =
        face === CardFace.FRONT
          ? setFrontPreferenceDrafts
          : setBackPreferenceDrafts;
      setter((current) =>
        current.map((pref) => (pref.id === id ? { ...pref, ...updates } : pref))
      );
      setStructureError(null);
      setFieldsDirty(true);
    },
    []
  );

  const removePreference = useCallback((face: CardFace, id: string) => {
    const setter =
      face === CardFace.FRONT
        ? setFrontPreferenceDrafts
        : setBackPreferenceDrafts;
    setter((current) => current.filter((pref) => pref.id !== id));
    setStructureError(null);
    setFieldsDirty(true);
  }, []);

  const movePreference = useCallback(
    (face: CardFace, id: string, direction: "up" | "down") => {
      const setter =
        face === CardFace.FRONT
          ? setFrontPreferenceDrafts
          : setBackPreferenceDrafts;
      setter((current) => {
        const index = current.findIndex((pref) => pref.id === id);
        if (index < 0) return current;
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= current.length) return current;
        const next = [...current];
        const [moved] = next.splice(index, 1);
        next.splice(targetIndex, 0, moved);
        return next;
      });
      setStructureError(null);
      setFieldsDirty(true);
    },
    []
  );

  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : formT("unknownError");

  const onSubmit = async (values: TemplateFormValues) => {
    if (!userId) {
      onCompleted({ type: "error", message: formT("notSignedIn") });
      return;
    }

    setStructureError(null);

    if (!fieldDrafts.length) {
      setStructureError(formT("errors.fieldsRequired"));
      return;
    }

    if (fieldDrafts.some((draft) => !draft.name.trim())) {
      setStructureError(formT("errors.fieldNames"));
      return;
    }

    if (!frontPreferenceDrafts.length && !backPreferenceDrafts.length) {
      setStructureError(formT("errors.preferencesRequired"));
      return;
    }

    let parsedSettings: SafeTemplate["settings"] = null;
    if (values.settings && values.settings.trim().length > 0) {
      try {
        parsedSettings = JSON.parse(values.settings);
      } catch {
        form.setError("settings", {
          type: "manual",
          message: formT("errors.settings"),
        });
        return;
      }
    }

    let parsedStyle: SafeStyle["stylesJson"] = {};
    if (values.styleJson && values.styleJson.trim().length > 0) {
      try {
        parsedStyle = JSON.parse(values.styleJson);
      } catch {
        form.setError("styleJson", {
          type: "manual",
          message: formT("errors.style"),
        });
        return;
      }
    }

    const now = new Date().toISOString();

    const templateId = crypto.randomUUID();
    const styleId = crypto.randomUUID();

    const template: SafeTemplate = {
      id: templateId,
      name: values.name,
      description:
        values.description && values.description.length > 0
          ? values.description
          : null,
      createdAt: now,
      lastModifiedAt: now,
      createdById: userId,
      ownedById: userId,
      type: values.type,
      settings: parsedSettings,
      styleId,
      style: {
        id: styleId,
        templateId,
        stylesJson: parsedStyle,
        createdAt: now,
        lastModifiedAt: now,
      },
    };

    const style: SafeStyle = {
      id: styleId,
      templateId,
      stylesJson: parsedStyle,
      createdAt: now,
      lastModifiedAt: now,
    };

    const fields: SafeField[] = fieldDrafts.map((draft) => ({
      id: draft.id,
      name: draft.name.trim(),
      type: draft.type,
      templateId,
      lastModifiedAt: now,
    }));

    const validFieldIds = new Set(fieldDrafts.map((draft) => draft.id));

    const buildPreferences = (
      drafts: TemplatePreferenceDraft[],
      face: CardFace
    ): SafeFieldPreference[] =>
      drafts
        .filter((draft) => validFieldIds.has(draft.fieldId))
        .map((draft, index) => ({
          id: crypto.randomUUID(),
          fieldId: draft.fieldId,
          templateId,
          face,
          role: draft.role ? (draft.role as FieldRole) : null,
          position: index,
          styleJson: null,
          lastModifiedAt: now,
        }));

    const preferences: SafeFieldPreference[] = [
      ...buildPreferences(frontPreferenceDrafts, CardFace.FRONT),
      ...buildPreferences(backPreferenceDrafts, CardFace.BACK),
    ];

    if (!preferences.length) {
      setStructureError(formT("errors.preferencesRequired"));
      return;
    }

    try {
      await Promise.all([
        enqueueTemplateUpsert(template),
        enqueueStyleUpsert(style),
        ...fields.map((field) => enqueueFieldUpsert(field)),
        ...preferences.map((pref) => enqueueFieldPreferenceUpsert(pref)),
      ]);

      dispatch(upsertTemplate(template));
      dispatch(setFieldsForTemplate({ templateId, fields }));
      preferences.forEach((pref) => dispatch(upsertFieldPreference(pref)));

      onCompleted({ type: "success", message: actionT("success") });
      closeDialog();
    } catch (error) {
      onCompleted({
        type: "error",
        message: actionT("error", { message: getErrorMessage(error) }),
      });
    }
  };

  return (
    <Dialog
      open={isOpen && !disabled}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeDialog();
        } else if (!disabled) {
          onOpen();
        }
      }}
    >
      {isOpen && !disabled && (
        <DialogContent className="max-h-[90vh] min-w-[1200px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{actionT("title")}</DialogTitle>
            <DialogDescription>{actionT("description")}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void form.handleSubmit(onSubmit)(event);
              }}
              className="space-y-6"
            >
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)_minmax(0,22rem)]">
                <section className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{formT("labels.name")}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder={formT("placeholders.templateName")}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{formT("labels.templateType")}</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value as TemplateType);
                              if (!fieldsDirty) {
                                applyPresetForType(value as TemplateType);
                              }
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={formT(
                                    "placeholders.templateType"
                                  )}
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {templateTypeOptions.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {formT(`templateTypes.${option}` as const)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            {formT("descriptions.templateType")}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>{formT("labels.description")}</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={formT(
                                "placeholders.templateDescription"
                              )}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            {formT("descriptions.templateDescription")}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          applyPresetForType(form.getValues("type"))
                        }
                      >
                        {formT("fields.applyPreset")}
                      </Button>
                      <p className="text-muted-foreground text-sm">
                        {fieldsDirty
                          ? formT("fields.customizedHint")
                          : formT("fields.presetHint")}
                      </p>
                    </div>

                    <FieldDraftList
                      drafts={fieldDrafts}
                      onAdd={addDraft}
                      onUpdate={updateDraft}
                      onRemove={removeDraft}
                      onMove={reorderDraft}
                      hasMultiple={fieldDrafts.length > 1}
                      translations={formT}
                    />

                    <FieldPreferenceList
                      face={CardFace.FRONT}
                      drafts={frontPreferenceDrafts}
                      fields={fieldDrafts}
                      onAdd={() => addPreference(CardFace.FRONT)}
                      onUpdate={(id, updates) =>
                        updatePreference(CardFace.FRONT, id, updates)
                      }
                      onRemove={(id) => removePreference(CardFace.FRONT, id)}
                      onMove={(id, direction) =>
                        movePreference(CardFace.FRONT, id, direction)
                      }
                      translations={formT}
                    />

                    <FieldPreferenceList
                      face={CardFace.BACK}
                      drafts={backPreferenceDrafts}
                      fields={fieldDrafts}
                      onAdd={() => addPreference(CardFace.BACK)}
                      onUpdate={(id, updates) =>
                        updatePreference(CardFace.BACK, id, updates)
                      }
                      onRemove={(id) => removePreference(CardFace.BACK, id)}
                      onMove={(id, direction) =>
                        movePreference(CardFace.BACK, id, direction)
                      }
                      translations={formT}
                    />

                    <FormField
                      control={form.control}
                      name="settings"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{formT("labels.settings")}</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={SETTINGS_JSON_PLACEHOLDER}
                              className="font-mono text-sm"
                              rows={4}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            {formT("descriptions.settings")}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {structureError && (
                      <p className="text-destructive text-sm">
                        {structureError}
                      </p>
                    )}
                  </div>
                </section>

                <section className="space-y-4">
                  <FormField
                    control={form.control}
                    name="styleJson"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{formT("labels.styleJson")}</FormLabel>
                        <FormControl>
                          <Textarea
                            className="font-mono text-sm"
                            rows={16}
                            placeholder={STYLE_JSON_PLACEHOLDER}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {formT("descriptions.styleJson")}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </section>

                <section className="space-y-4">
                  <TemplatePreview
                    heading={formT("sections.preview")}
                    title={formT("preview.title")}
                    body={formT("preview.body")}
                    style={previewStyle}
                    error={styleParseError}
                  />
                </section>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => closeDialog()}
                >
                  {formT("cancel")}
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting
                    ? formT("saving")
                    : formT("submit")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      )}
    </Dialog>
  );
};

export default AddTemplateDialog;
