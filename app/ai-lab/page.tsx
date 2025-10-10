"use client"

import { useMemo, useRef, useState } from "react"
import type { ChangeEvent } from "react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  getModelParameters,
  getModelTask,
  groupModelsByProviderForModality,
  listModelsByModality,
  type ModelCatalogEntry,
  type ModelModality,
  type ModelParameterDefinition,
  type ModelParameterType,
} from "@/lib/ai/model-catalog"

const MODALITY_ORDER: ModelModality[] = [
  "llm",
  "vlm",
  "text-to-image",
  "image-to-image",
  "text-to-video",
  "image-to-video",
]

const SECTION_ENDPOINT: Partial<Record<ModelModality, string>> = {
  llm: "/api/ai/llm",
  vlm: "/api/ai/llm",
  "text-to-image": "/api/ai/text-to-image",
  "image-to-image": "/api/ai/image-to-image",
  "text-to-video": "/api/ai/text-to-video",
  "image-to-video": "/api/ai/image-to-video",
}

const ADVANCED_JSON_PLACEHOLDER = `{
  "parameters": {
    "custom": "value"
  }
}`

interface SectionData {
  modality: ModelModality
  models: ModelCatalogEntry[]
  providerMap: Record<string, ModelCatalogEntry[]>
  endpoint: string | null
}

interface SectionSelection {
  provider: string | null
  modelId: string | null
}

interface SectionRuntimeState {
  values: Record<string, string | boolean>
  advancedJSON: string
  isLoading: boolean
  error?: string
  response?: unknown
}

type FieldType = "text" | "textarea" | "number" | "select" | "boolean" | "json" | "urls"
type TranslateFn = ReturnType<typeof useTranslations>

interface FieldDefinition {
  key: string
  label: string
  type: FieldType
  target: "payload" | "parameters"
  required?: boolean
  defaultValue?: string | number | boolean | string[]
  description?: string
  rows?: number
  options?: Array<{ label: string; value: string }>
  parameterType?: ModelParameterType
}

export default function AiLabPage() {
  const t = useTranslations("aiLab")

  const sections = useMemo<SectionData[]>(() => {
    return MODALITY_ORDER.map((modality) => {
      const models = listModelsByModality(modality)
      const providerMap = groupModelsByProviderForModality(modality)
      return {
        modality,
        models,
        providerMap,
        endpoint: SECTION_ENDPOINT[modality] ?? null,
      }
    })
  }, [])

  const { initialSelection, initialState } = useMemo(() => {
    const selections: Partial<Record<ModelModality, SectionSelection>> = {}
    const states: Partial<Record<ModelModality, SectionRuntimeState>> = {}

    sections.forEach((section) => {
      const providerKeys = Object.keys(section.providerMap)
      const defaultProvider = providerKeys[0] ?? null
      const defaultModel =
        (defaultProvider ? section.providerMap[defaultProvider]?.[0] : section.models[0]) ?? null
      const parameterDefinitions = defaultModel ? getModelParameters(defaultModel.id) : []
      const fields = buildFieldsForSection(section.modality, defaultModel, parameterDefinitions, t)

      selections[section.modality] = {
        provider: defaultProvider,
        modelId: defaultModel?.id ?? null,
      }

      states[section.modality] = {
        values: buildInitialValues(fields),
        advancedJSON: "{}",
        isLoading: false,
      }
    })

    return { initialSelection: selections, initialState: states }
  }, [sections, t])

  const [selection, setSelection] =
    useState<Partial<Record<ModelModality, SectionSelection>>>(initialSelection)
  const [sectionState, setSectionState] =
    useState<Partial<Record<ModelModality, SectionRuntimeState>>>(initialState)

  const handleProviderChange = (modality: ModelModality, provider: string) => {
    const section = sections.find((entry) => entry.modality === modality)
    if (!section) {
      return
    }
    const providerModels = section.providerMap[provider] ?? []
    const nextModel = providerModels[0] ?? section.models[0] ?? null
    const parameterDefinitions = nextModel ? getModelParameters(nextModel.id) : []
    const fields = buildFieldsForSection(modality, nextModel, parameterDefinitions, t)

    setSelection((current) => ({
      ...current,
      [modality]: {
        provider,
        modelId: nextModel?.id ?? null,
      },
    }))

    setSectionState((current) => ({
      ...current,
      [modality]: {
        values: syncValues(current[modality]?.values, fields),
        advancedJSON: current[modality]?.advancedJSON ?? "{}",
        isLoading: false,
        response: undefined,
        error: undefined,
      },
    }))
  }

  const handleModelChange = (modality: ModelModality, modelId: string) => {
    const section = sections.find((entry) => entry.modality === modality)
    if (!section) {
      return
    }

    const model =
      section.models.find((item) => item.id === modelId) ??
      section.models.find((item) => item.id === selection[modality]?.modelId) ??
      section.models[0] ??
      null

    const parameterDefinitions = model ? getModelParameters(model.id) : []
    const fields = buildFieldsForSection(modality, model, parameterDefinitions, t)

    setSelection((current) => ({
      ...current,
      [modality]: {
        provider: current[modality]?.provider ?? model?.provider ?? null,
        modelId: model?.id ?? null,
      },
    }))

    setSectionState((current) => ({
      ...current,
      [modality]: {
        values: syncValues(current[modality]?.values, fields),
        advancedJSON: current[modality]?.advancedJSON ?? "{}",
        isLoading: false,
        response: undefined,
        error: undefined,
      },
    }))
  }

  const handleFieldChange = (modality: ModelModality, key: string, value: string | boolean) => {
    setSectionState((current) => ({
      ...current,
      [modality]: {
        ...current[modality],
        values: {
          ...(current[modality]?.values ?? {}),
          [key]: value,
        },
        advancedJSON: current[modality]?.advancedJSON ?? "{}",
        isLoading: current[modality]?.isLoading ?? false,
        response: current[modality]?.response,
        error: undefined,
      },
    }))
  }

  const handleAdvancedChange = (modality: ModelModality, value: string) => {
    setSectionState((current) => ({
      ...current,
      [modality]: {
        ...current[modality],
        advancedJSON: value,
      },
    }))
  }

  const handleSubmit = async (
    modality: ModelModality,
    section: SectionData,
    model: ModelCatalogEntry | null,
    fields: FieldDefinition[],
  ) => {
    if (!section.endpoint || !model) {
      return
    }

    const runtime = sectionState[modality]
    if (!runtime) {
      return
    }

    const { payload, error: assemblyError } = assemblePayload({
      model,
      fields,
      values: runtime.values,
      advancedJSON: runtime.advancedJSON,
    })

    if (assemblyError || !payload) {
      setSectionState((current) => ({
        ...current,
        [modality]: {
          ...current[modality],
          error: assemblyError ?? t("actions.unknownError"),
          isLoading: false,
        },
      }))
      return
    }

    setSectionState((current) => ({
      ...current,
      [modality]: {
        ...current[modality],
        isLoading: true,
        error: undefined,
        response: undefined,
      },
    }))

    try {
      const response = await fetch(section.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = await safeReadJson(response)
      if (!response.ok) {
        const errorData = data as { error?: unknown }
        const errorMessage = typeof errorData?.error === "string" ? errorData.error : response.statusText
        throw new Error(errorMessage)
      }

      setSectionState((current) => ({
        ...current,
        [modality]: {
          ...current[modality],
          isLoading: false,
          response: data,
          error: undefined,
        },
      }))
    } catch (error) {
      setSectionState((current) => ({
        ...current,
        [modality]: {
          ...current[modality],
          isLoading: false,
          response: undefined,
          error: error instanceof Error ? error.message : String(error),
        },
      }))
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6 lg:px-0">
      <section className="space-y-3">
        <span className="bg-muted text-muted-foreground inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-widest">
          {t("badge")}
        </span>
        <h1 className="text-3xl font-semibold sm:text-4xl">{t("title")}</h1>
        <p className="text-muted-foreground max-w-2xl text-base leading-relaxed">{t("description")}</p>
      </section>

      <div className="space-y-12">
        {sections.map((section) => {
          const providerKeys = Object.keys(section.providerMap)
          const activeSelection = selection[section.modality]
          const activeProvider =
            activeSelection?.provider && providerKeys.includes(activeSelection.provider)
              ? activeSelection.provider
              : providerKeys[0] ?? null
          const modelsForProvider = activeProvider ? section.providerMap[activeProvider] ?? [] : section.models
          const activeModel =
            modelsForProvider.find((model) => model.id === activeSelection?.modelId) ??
            modelsForProvider[0] ??
            null

          const parameterDefinitions = activeModel ? getModelParameters(activeModel.id) : []
          const fields = buildFieldsForSection(section.modality, activeModel, parameterDefinitions, t)
          const runtime = sectionState[section.modality]

          const values = runtime?.values ?? {}
          const advancedJSON = runtime?.advancedJSON ?? "{}"

          const textOutput = extractTextOutput(runtime?.response)
          const assets = extractAssets(runtime?.response)

          const sectionTitle = t(`sectionTitles.${section.modality}`)
          const sectionDescription = t(`sectionDescriptions.${section.modality}`)

          return (
            <section key={section.modality} className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">{sectionTitle}</h2>
                <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed">{sectionDescription}</p>
              </div>

              {section.models.length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{t("emptyState.title")}</CardTitle>
                    <CardDescription>{t("emptyState.description")}</CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>{t("selectors.title")}</CardTitle>
                      <CardDescription>{t("selectors.description")}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-3">
                        <Label htmlFor={`${section.modality}-provider`}>
                          {t("selectors.providerLabel")}
                        </Label>
                        {providerKeys.length > 0 ? (
                          <Select
                            value={activeProvider ?? ""}
                            onValueChange={(value) => handleProviderChange(section.modality, value)}
                          >
                            <SelectTrigger id={`${section.modality}-provider`} className="w-full">
                              <SelectValue placeholder={t("selectors.providerPlaceholder")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel>{t("selectors.providerGroup")}</SelectLabel>
                                {providerKeys.map((provider) => (
                                  <SelectItem key={provider} value={provider}>
                                    {provider}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-muted-foreground text-sm">{t("selectors.noProviders")}</p>
                        )}
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor={`${section.modality}-model`}>{t("selectors.modelLabel")}</Label>
                        {modelsForProvider.length > 0 ? (
                          <Select
                            value={activeModel?.id ?? ""}
                            onValueChange={(value) => handleModelChange(section.modality, value)}
                          >
                            <SelectTrigger id={`${section.modality}-model`} className="w-full">
                              <SelectValue placeholder={t("selectors.modelPlaceholder")} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel>{t("selectors.modelGroup")}</SelectLabel>
                                {modelsForProvider.map((model) => (
                                  <SelectItem key={model.id} value={model.id}>
                                    <div className="flex flex-col gap-0.5">
                                      <span>{model.label}</span>
                                      <span className="text-muted-foreground text-xs">{model.id}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-muted-foreground text-sm">{t("selectors.noModels")}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {activeModel ? (
                    <>
                      <Card>
                        <CardHeader>
                          <CardTitle>{t("formCard.title")}</CardTitle>
                          <CardDescription>
                            {t("formCard.description", { endpoint: section.endpoint ?? "—" })}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div className="grid gap-3 text-sm sm:grid-cols-2">
                            <MetadataRow label={t("metadata.id")} value={activeModel.id} />
                            <MetadataRow label={t("metadata.provider")} value={activeModel.provider} />
                            <MetadataRow
                              label={t("metadata.modality")}
                              value={t(`modalityLabels.${activeModel.modality}`)}
                            />
                            <MetadataRow
                              label={t("metadata.task")}
                              value={t(`taskLabels.${getModelTask(activeModel)}`)}
                            />
                            <MetadataRow
                              label={t("metadata.structuredOutputs")}
                              value={activeModel.options.structuredOutputs ? t("boolean.yes") : t("boolean.no")}
                            />
                            <MetadataRow
                              label={t("metadata.endpointPath")}
                              value={activeModel.options.endpointPath ?? "—"}
                            />
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            {fields.map((field) => (
                              <FieldInput
                                key={`${section.modality}-${field.key}`}
                                field={field}
                                value={values[field.key]}
                                onChange={(next) => handleFieldChange(section.modality, field.key, next)}
                              />
                            ))}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`${section.modality}-advanced`}>
                              {t("advancedOverrides.label")}
                            </Label>
                            <Textarea
                              id={`${section.modality}-advanced`}
                              value={advancedJSON}
                              onChange={(event) => handleAdvancedChange(section.modality, event.target.value)}
                              rows={6}
                              placeholder={ADVANCED_JSON_PLACEHOLDER}
                              className="font-mono text-sm"
                            />
                            <p className="text-muted-foreground text-xs">{t("advancedOverrides.help")}</p>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            <Button
                              type="button"
                              onClick={() => handleSubmit(section.modality, section, activeModel, fields)}
                              disabled={!section.endpoint || runtime?.isLoading}
                            >
                              {runtime?.isLoading ? t("actions.running") : t("actions.run")}
                            </Button>
                            {!section.endpoint ? (
                              <span className="text-muted-foreground text-xs">{t("actions.noEndpoint")}</span>
                            ) : null}
                            {runtime?.error ? (
                              <span className="text-destructive text-sm">
                                {t("response.error", { message: runtime.error })}
                              </span>
                            ) : null}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>{t("response.title")}</CardTitle>
                          <CardDescription>{t("response.description")}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {runtime?.isLoading ? (
                            <p className="text-muted-foreground text-sm">{t("actions.running")}</p>
                          ) : runtime?.response ? (
                            <>
                              {textOutput ? (
                                <div>
                                  <h4 className="text-sm font-semibold">{t("response.textOutput")}</h4>
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{textOutput}</p>
                                </div>
                              ) : null}

                              {assets.length > 0 ? (
                                <div className="space-y-2">
                                  <h4 className="text-sm font-semibold">{t("response.assets")}</h4>
                                  <div className="grid gap-3 md:grid-cols-2">
                                    {assets.map((asset) => (
                                      <div
                                        key={asset.url}
                                        className="overflow-hidden rounded-md border bg-muted/30"
                                      >
                                        {isVideoAsset(asset) ? (
                                          <video
                                            src={asset.url}
                                            controls
                                            className="h-full w-full bg-black"
                                          />
                                        ) : (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                            src={asset.url}
                                            alt={asset.url}
                                            className="h-auto w-full"
                                            loading="lazy"
                                          />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              <div>
                                <h4 className="text-sm font-semibold">{t("response.raw")}</h4>
                                <pre className="bg-muted mt-2 max-h-80 overflow-auto rounded-md p-3 text-[11px] leading-relaxed">
                                  {JSON.stringify(runtime.response, null, 2)}
                                </pre>
                              </div>
                            </>
                          ) : (
                            <p className="text-muted-foreground text-sm">{t("response.empty")}</p>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  ) : null}
                </>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function buildFieldsForSection(
  modality: ModelModality,
  model: ModelCatalogEntry | null,
  parameters: ModelParameterDefinition[],
  t: TranslateFn,
): FieldDefinition[] {
  if (!model) {
    return []
  }

  const fields: FieldDefinition[] = []

  if (modality === "llm" || modality === "vlm") {
    fields.push(
      {
        key: "systemPrompt",
        label: t("formFields.systemPrompt"),
        type: "textarea",
        target: "payload",
        defaultValue: "You are a helpful assistant.",
        rows: 3,
      },
      {
        key: "prompt",
        label: t("formFields.userPrompt"),
        type: "textarea",
        target: "payload",
        rows: 6,
      },
      {
        key: "temperature",
        label: t("formFields.temperature"),
        type: "number",
        target: "parameters",
        defaultValue: 0.7,
        parameterType: "number",
      },
      {
        key: "max_output_tokens",
        label: t("formFields.maxTokens"),
        type: "number",
        target: "parameters",
        parameterType: "integer",
      },
    )
  } else if (modality === "text-to-image" || modality === "text-to-video" || modality === "image-to-video") {
    const hasPromptParameter = parameters.some((parameter) => parameter.key === "prompt")
    if (!hasPromptParameter) {
      fields.push({
        key: "prompt",
        label: t("formFields.prompt"),
        type: "textarea",
        target: "payload",
        rows: 5,
        required: modality !== "image-to-video",
      })
    }
  }

  const parameterFields = parameters.map((parameter) => mapParameterToField(parameter))
  fields.push(...parameterFields)

  return fields
}

function mapParameterToField(parameter: ModelParameterDefinition): FieldDefinition {
  const label = formatParameterLabel(parameter.key)

  if (parameter.enum?.length) {
    const options = parameter.enum.map((value) => ({
      label: String(value),
      value: String(value),
    }))
    return {
      key: parameter.key,
      label,
      type: "select",
      target: "parameters",
      required: parameter.required,
      defaultValue:
        parameter.defaultValue !== undefined ? String(parameter.defaultValue) : options[0]?.value,
      description: parameter.description,
      options,
      parameterType: parameter.type,
    }
  }

  if (parameter.type === "boolean") {
    let defaultValue = false
    if (typeof parameter.defaultValue === "boolean") {
      defaultValue = parameter.defaultValue
    } else if (typeof parameter.defaultValue === "string") {
      defaultValue = ["true", "1", "yes", "on"].includes(parameter.defaultValue.toLowerCase())
    }

    return {
      key: parameter.key,
      label,
      type: "boolean",
      target: "parameters",
      required: parameter.required,
      defaultValue,
      description: parameter.description,
      parameterType: parameter.type,
    }
  }

  if (parameter.type === "number" || parameter.type === "integer") {
    return {
      key: parameter.key,
      label,
      type: "number",
      target: "parameters",
      required: parameter.required,
      defaultValue: typeof parameter.defaultValue === "number" ? parameter.defaultValue : undefined,
      description: parameter.description,
      parameterType: parameter.type,
    }
  }

  if (parameter.type === "array") {
    const lowerKey = parameter.key.toLowerCase()
    const expectsUrls = lowerKey.includes("url") || lowerKey.includes("uri") || lowerKey.includes("image")

    if (expectsUrls) {
      const defaultValue = Array.isArray(parameter.defaultValue)
        ? parameter.defaultValue.map((item) => String(item))
        : typeof parameter.defaultValue === "string"
          ? parameter.defaultValue
          : undefined

      return {
        key: parameter.key,
        label,
        type: "urls",
        target: "parameters",
        required: parameter.required,
        defaultValue,
        description: parameter.description,
        parameterType: parameter.type,
      }
    }

    return {
      key: parameter.key,
      label,
      type: "json",
      target: "parameters",
      required: parameter.required,
      defaultValue:
        typeof parameter.defaultValue === "string"
          ? parameter.defaultValue
          : parameter.defaultValue
            ? JSON.stringify(parameter.defaultValue, null, 2)
            : "",
      description: parameter.description,
      rows: 4,
      parameterType: parameter.type,
    }
  }

  if (parameter.type === "object") {
    return {
      key: parameter.key,
      label,
      type: "json",
      target: "parameters",
      required: parameter.required,
      defaultValue:
        typeof parameter.defaultValue === "string"
          ? parameter.defaultValue
          : parameter.defaultValue
            ? JSON.stringify(parameter.defaultValue, null, 2)
            : "",
      description: parameter.description,
      rows: 4,
      parameterType: parameter.type,
    }
  }

  const isPromptField = parameter.key.toLowerCase().includes("prompt")

  return {
    key: parameter.key,
    label,
    type: isPromptField ? "textarea" : "text",
    target: "parameters",
    required: parameter.required,
    defaultValue:
      typeof parameter.defaultValue === "string"
        ? parameter.defaultValue
        : parameter.defaultValue !== undefined
        ? String(parameter.defaultValue)
        : undefined,
    description: parameter.description,
    rows: isPromptField ? 5 : undefined,
    parameterType: parameter.type,
  }
}

function buildInitialValues(fields: FieldDefinition[]): Record<string, string | boolean> {
  return Object.fromEntries(
    fields.map((field) => {
      if (field.type === "boolean") {
        const boolValue =
          typeof field.defaultValue === "boolean"
            ? field.defaultValue
            : typeof field.defaultValue === "string"
              ? ["true", "1", "yes", "on"].includes(field.defaultValue.toLowerCase())
              : false
        return [field.key, boolValue]
      }

      if (field.type === "urls") {
        if (Array.isArray(field.defaultValue)) {
          return [field.key, field.defaultValue.join("\n")]
        }
        if (typeof field.defaultValue === "string") {
          return [field.key, field.defaultValue]
        }
        return [field.key, ""]
      }

      if (field.defaultValue === undefined || field.defaultValue === null) {
        return [field.key, ""]
      }

      return [field.key, String(field.defaultValue)]
    }),
  )
}

function syncValues(
  previous: Record<string, string | boolean> | undefined,
  fields: FieldDefinition[],
): Record<string, string | boolean> {
  const next: Record<string, string | boolean> = {}

  fields.forEach((field) => {
    const existing = previous?.[field.key]
    if (existing !== undefined) {
      if (field.type === "boolean") {
        next[field.key] = Boolean(existing)
      } else if (field.type === "urls") {
        if (typeof existing === "string") {
          next[field.key] = existing
        } else if (Array.isArray(existing)) {
          next[field.key] = existing.join("\n")
        } else {
          next[field.key] = ""
        }
      } else {
        next[field.key] = existing as string | boolean
      }
      return
    }

    next[field.key] = buildInitialValues([field])[field.key]
  })

  return next
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDefinition
  value: string | boolean | undefined
  onChange: (value: string | boolean) => void
}) {
  const t = useTranslations("aiLab")
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const description = field.description ? (
    <p className="text-muted-foreground mt-1 text-xs">{field.description}</p>
  ) : null

  if (field.type === "boolean") {
    return (
      <div className="flex flex-col space-y-2 rounded-md border p-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">
              {field.label}
              {field.required ? <span className="text-destructive ml-1">*</span> : null}
            </Label>
          </div>
          <Switch checked={Boolean(value)} onCheckedChange={(checked) => onChange(checked)} />
        </div>
        {description}
      </div>
    )
  }

  if (field.type === "urls") {
    const urlsValue = typeof value === "string" ? value : ""
    const parsedUrls = parseUrlInput(urlsValue)

    const handleManualChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
      setUploadError(null)
      onChange(event.target.value)
    }

    const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files
      if (!files?.length) {
        return
      }

      setUploading(true)
      setUploadError(null)

      const uploadedUrls: string[] = []

      try {
        for (const file of Array.from(files)) {
          const presignResponse = await fetch("/api/s3-upload", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fileName: file.name,
              fileType: file.type || "application/octet-stream",
            }),
          })

          if (!presignResponse.ok) {
            const errorPayload = await presignResponse.json().catch(() => null)
            const message =
              (errorPayload && typeof errorPayload.error === "string" && errorPayload.error) ||
              presignResponse.statusText
            throw new Error(message)
          }

          const { uploadUrl } = (await presignResponse.json()) as { uploadUrl: string }

          const uploadResponse = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Type": file.type || "application/octet-stream",
            },
            body: file,
          })

          if (!uploadResponse.ok) {
            throw new Error(`S3 upload failed (${uploadResponse.status})`)
          }

          const publicUrl = uploadUrl.split("?")[0]
          uploadedUrls.push(publicUrl)
        }

        const combined = [...parsedUrls, ...uploadedUrls]
        onChange(combined.join("\n"))
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : String(error))
      } finally {
        setUploading(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }
    }

    return (
      <div className="flex flex-col space-y-3">
        <Label htmlFor={field.key} className="text-sm font-medium">
          {field.label}
          {field.required ? <span className="text-destructive ml-1">*</span> : null}
        </Label>
        <Tabs defaultValue="manual">
          <TabsList>
            <TabsTrigger value="manual">{t("uploadTabs.urls")}</TabsTrigger>
            <TabsTrigger value="upload">{t("uploadTabs.upload")}</TabsTrigger>
          </TabsList>
          <TabsContent value="manual" className="space-y-2">
            <Textarea
              id={field.key}
              value={urlsValue}
              onChange={handleManualChange}
              rows={field.rows ?? 5}
              placeholder={t("upload.urlPlaceholder")}
              className="font-mono text-sm"
            />
            <p className="text-muted-foreground text-xs">{t("upload.manualHint")}</p>
          </TabsContent>
          <TabsContent value="upload" className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFilesSelected}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? t("upload.uploading") : t("upload.button")}
              </Button>
              <span className="text-muted-foreground text-xs">
                {uploading ? t("upload.uploading") : t("upload.hint")}
              </span>
            </div>
            {uploadError ? (
              <p className="text-destructive text-xs">{t("upload.error", { message: uploadError })}</p>
            ) : null}
          </TabsContent>
        </Tabs>
        {parsedUrls.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("upload.currentTitle")}
            </p>
            <ul className="space-y-1 text-xs font-mono">
              {parsedUrls.map((url) => (
                <li key={url} className="truncate">
                  {url}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {description}
      </div>
    )
  }

  return (
    <div className="flex flex-col space-y-2">
      <Label htmlFor={field.key} className="text-sm font-medium">
        {field.label}
        {field.required ? <span className="text-destructive ml-1">*</span> : null}
      </Label>
      {field.type === "textarea" ? (
        <Textarea
          id={field.key}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          rows={field.rows ?? 4}
        />
      ) : field.type === "json" ? (
        <Textarea
          id={field.key}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          rows={field.rows ?? 4}
          className="font-mono text-sm"
        />
      ) : field.type === "number" ? (
        <Input
          id={field.key}
          type="number"
          value={
            typeof value === "string"
              ? value
              : value !== undefined
                ? String(value)
                : ""
          }
          onChange={(event) => onChange(event.target.value)}
        />
      ) : field.type === "select" && field.options ? (
        <Select
          value={typeof value === "string" ? value : field.options[0]?.value ?? ""}
          onValueChange={(newValue) => onChange(newValue)}
        >
          <SelectTrigger id={field.key}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>{field.label}</SelectLabel>
              {field.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={field.key}
          value={typeof value === "string" ? value : value !== undefined ? String(value) : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {description}
    </div>
  )
}

function assemblePayload({
  model,
  fields,
  values,
  advancedJSON,
}: {
  model: ModelCatalogEntry
  fields: FieldDefinition[]
  values: Record<string, string | boolean>
  advancedJSON: string
}): { payload?: Record<string, unknown>; error?: string } {
  const payload: Record<string, unknown> = {
    modelId: model.id,
    provider: model.provider,
  }
  const parameters: Record<string, unknown> = {}
  const errors: string[] = []

  for (const field of fields) {
    const rawValue = values[field.key]
    const conversion = convertFieldValue(field, rawValue)

    if (conversion.error) {
      errors.push(`${field.label}: ${conversion.error}`)
      continue
    }

    if (conversion.value === undefined) {
      if (field.required) {
        errors.push(`${field.label}: value is required`)
      }
      continue
    }

    if (field.target === "payload") {
      payload[field.key] = conversion.value
    } else {
      parameters[field.key] = conversion.value
    }
  }

  if (parameters.prompt && payload.prompt === undefined && typeof parameters.prompt === "string") {
    payload.prompt = parameters.prompt
  }

  const trimmedAdvanced = advancedJSON.trim()
  if (trimmedAdvanced && trimmedAdvanced !== "{}") {
    try {
      const overrides = JSON.parse(trimmedAdvanced)
      if (overrides && typeof overrides === "object") {
        if (overrides.parameters && typeof overrides.parameters === "object") {
          Object.assign(parameters, overrides.parameters)
          delete overrides.parameters
        }
        Object.assign(payload, overrides)
      }
    } catch {
      errors.push("Advanced overrides JSON is invalid")
    }
  }

  if (Object.keys(parameters).length > 0) {
    payload.parameters = parameters
  }

  if (errors.length > 0) {
    return { error: errors.join("\n") }
  }

  return { payload }
}

function convertFieldValue(
  field: FieldDefinition,
  raw: string | boolean | undefined,
): { value?: unknown; error?: string } {
  if (field.type === "boolean") {
    return { value: Boolean(raw) }
  }

  const stringValue = typeof raw === "string" ? raw : raw !== undefined ? String(raw) : ""
  const trimmed = stringValue.trim()

  if (!trimmed && !field.required) {
    return { value: undefined }
  }

  if (field.type === "urls") {
    if (!trimmed) {
      return field.required ? { error: "value is required" } : { value: undefined }
    }

    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          const values = parsed.map((item) => String(item)).filter(Boolean)
          if (!values.length && !field.required) {
            return { value: undefined }
          }
          return { value: values }
        }
        return { error: "must be an array" }
      } catch {
        return { error: "must be valid JSON" }
      }
    }

    const urls = parseUrlInput(trimmed)
    if (!urls.length) {
      return field.required ? { error: "value is required" } : { value: undefined }
    }

    return { value: urls }
  }

  if (field.type === "number") {
    if (!trimmed) {
      return field.required ? { error: "value is required" } : { value: undefined }
    }
    const numeric = Number(trimmed)
    if (Number.isNaN(numeric)) {
      return { error: "must be a number" }
    }
    if (field.parameterType === "integer" && !Number.isInteger(numeric)) {
      return { error: "must be an integer" }
    }
    return { value: numeric }
  }

  if (field.type === "json") {
    if (!trimmed) {
      return field.required ? { error: "value is required" } : { value: undefined }
    }
    try {
      return { value: JSON.parse(trimmed) }
    } catch {
      return { error: "must be valid JSON" }
    }
  }

  return { value: trimmed || undefined }
}

function extractTextOutput(response: unknown): string | null {
  if (!response || typeof response !== "object") {
    return null
  }
  const record = response as Record<string, unknown>
  const result = record.result as Record<string, unknown> | undefined
  const text = result?.text
  if (typeof text === "string" && text.trim()) {
    return text
  }
  return null
}

function extractAssets(response: unknown): Array<{ url: string; mimeType?: string }> {
  if (!response || typeof response !== "object") {
    return []
  }

  const record = response as Record<string, unknown>
  const result = record.result as Record<string, unknown> | undefined
  const assets = result?.assets

  if (!Array.isArray(assets)) {
    return []
  }

  const normalized: Array<{ url: string; mimeType?: string }> = []

  for (const asset of assets) {
    if (!asset || typeof asset !== "object") {
      continue
    }

    const current = asset as Record<string, unknown>
    const url = current.url

    if (typeof url !== "string" || !url) {
      continue
    }

    const mimeType = typeof current.mimeType === "string" ? current.mimeType : undefined
    normalized.push({ url, mimeType })
  }

  return normalized
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md bg-muted/50 p-3">
      <span className="text-muted-foreground text-xs uppercase tracking-wide">{label}</span>
      <span className="font-mono text-sm">{value}</span>
    </div>
  )
}

function formatParameterLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function isVideoAsset(asset: { url: string; mimeType?: string }) {
  if (asset.mimeType && asset.mimeType.startsWith("video/")) {
    return true
  }

  const lower = asset.url.toLowerCase()
  return lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov")
}

function parseUrlInput(value: string): string[] {
  if (!value) {
    return []
  }

  return value
    .split(/\r?\n/)
    .flatMap((line) => line.split(","))
    .map((item) => item.trim())
    .filter(Boolean)
}

async function safeReadJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}
