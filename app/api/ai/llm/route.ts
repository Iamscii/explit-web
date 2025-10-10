import { NextResponse } from "next/server"

import { normalizeParameters } from "@/lib/ai/parameter-normalizer"
import { getAdapter } from "@/lib/ai/registry"
import type {
  ChatMessage,
  ChatMessageContent,
  ChatMessageContentPart,
  ModelAdapter,
  TextGenerationInput,
} from "@/lib/ai/types"
import {
  findModelById,
  listModelsByModality,
  type ModelCatalogEntry,
  type ModelModality,
} from "@/lib/ai/model-catalog"

import { ApiError, handleError, readJsonBody } from "../_utils"

interface LlmRequestBody {
  modelId?: string
  provider?: string
  prompt?: unknown
  systemPrompt?: unknown
  messages?: unknown
  parameters?: unknown
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<LlmRequestBody>(request)

    const model = resolveTextModel({
      modelId: typeof body.modelId === "string" ? body.modelId : undefined,
      provider: typeof body.provider === "string" ? body.provider : undefined,
    })

    const adapter = getAdapter(model.id) as ModelAdapter<"text">
    const parameterDefinitions = model.options.parameters ?? []
    const normalized = normalizeParameters(parameterDefinitions, body.parameters)

    const systemPrompt = pickString(
      body.systemPrompt ?? normalized.recognized.system_prompt ?? normalized.recognized.systemPrompt,
    )
    const prompt = pickString(body.prompt ?? normalized.recognized.prompt)

    const imageUrls = extractImageUrls(normalized.recognized.image_urls)
    const messages = buildMessages(body.messages, systemPrompt, prompt, imageUrls)

    const remainingMissing = normalized.missingRequired.filter((key) => {
      if (key === "prompt" && prompt) {
        return false
      }
      if (key === "system_prompt" && systemPrompt) {
        return false
      }
      return true
    })

    if (remainingMissing.length > 0) {
      throw new ApiError(`Missing required parameters: ${remainingMissing.join(", ")}`, 400)
    }

    if (!messages.length) {
      throw new ApiError("Provide at least one message in the `messages` array or a `prompt` string.", 400)
    }

    if (Object.keys(normalized.invalid).length > 0) {
      throw new ApiError(formatInvalidErrors(normalized.invalid), 400)
    }

    const extras = buildExtras(normalized.combined, [
      "prompt",
      "system_prompt",
      "systemPrompt",
      "temperature",
      "temperature_c",
      "max_tokens",
      "maxTokens",
      "max_output_tokens",
      "image_urls",
    ])

    const temperature = pickNumber(normalized.recognized, ["temperature", "temperature_c"])
    const maxOutputTokens = pickNumber(normalized.recognized, ["max_output_tokens", "maxTokens", "max_tokens"])

    const input: TextGenerationInput = {
      messages,
      ...(typeof temperature === "number" ? { temperature } : {}),
      ...(typeof maxOutputTokens === "number" ? { maxOutputTokens } : {}),
      ...(Object.keys(extras).length ? { extras } : {}),
    }

    const result = await adapter.invoke(input)

    return NextResponse.json({
      model: {
        id: model.id,
        label: model.label,
        provider: model.provider,
        modality: model.modality,
      },
      request: {
        messages,
        ...(typeof temperature === "number" ? { temperature } : {}),
        ...(typeof maxOutputTokens === "number" ? { maxOutputTokens } : {}),
        parameters: extras,
      },
      result,
    })
  } catch (error) {
    return handleError(error)
  }
}

function extractImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((url) => url.length > 0)
}

function buildMessages(
  input: unknown,
  systemPrompt?: string,
  fallbackPrompt?: string,
  imageUrls: string[] = [],
): ChatMessage[] {
  const parsed = parseMessages(input)
  const messages: ChatMessage[] = []

  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt })
  }

  if (parsed.length) {
    messages.push(...parsed)
    return messages
  }

  const parts: ChatMessageContentPart[] = []

  if (fallbackPrompt) {
    parts.push({ type: "text", text: fallbackPrompt })
  }

  for (const url of imageUrls) {
    parts.push({ type: "image_url", image_url: { url } })
  }

  if (!parts.length) {
    return messages
  }

  const content: ChatMessageContent =
    parts.length === 1 && parts[0]?.type === "text" ? parts[0].text : parts

  messages.push({ role: "user", content })

  return messages
}

function parseMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) {
    return []
  }

  const messages: ChatMessage[] = []

  for (const item of input) {
    if (!item || typeof item !== "object") {
      continue
    }

    const role = (item as Record<string, unknown>).role
    const content = (item as Record<string, unknown>).content

    if (!isValidRole(role)) {
      continue
    }

    const normalizedContent = normalizeMessageContent(content)
    if (!normalizedContent) {
      continue
    }

    messages.push({ role, content: normalizedContent })
  }

  return messages
}

function normalizeMessageContent(content: unknown): ChatMessageContent | null {
  if (typeof content === "string") {
    const trimmed = content.trim()
    return trimmed.length ? trimmed : null
  }

  if (Array.isArray(content)) {
    const parts: ChatMessageContentPart[] = []

    for (const item of content) {
      const normalized = normalizeMessageContentPart(item)
      if (normalized) {
        parts.push(normalized)
      }
    }

    if (!parts.length) {
      return null
    }

    return parts
  }

  return null
}

function normalizeMessageContentPart(part: unknown): ChatMessageContentPart | null {
  if (!part || typeof part !== "object") {
    return null
  }

  const record = part as Record<string, unknown>
  const type = record.type

  if (type === "text" || type === "input_text") {
    const textValue = typeof record.text === "string" ? record.text.trim() : ""
    return textValue ? { type: "text", text: textValue } : null
  }

  if (type === "image_url") {
    const imageRecord = record.image_url
    if (!imageRecord || typeof imageRecord !== "object") {
      return null
    }

    const url = (imageRecord as Record<string, unknown>).url
    if (typeof url !== "string") {
      return null
    }

    const trimmed = url.trim()
    return trimmed ? { type: "image_url", image_url: { url: trimmed } } : null
  }

  return null
}

function pickString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length ? trimmed : undefined
  }
  return undefined
}

function pickNumber(source: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === "number" && Number.isFinite(value)) {
      return value
    }
    if (typeof value === "string") {
      const parsed = Number(value)
      if (!Number.isNaN(parsed)) {
        return parsed
      }
    }
  }
  return undefined
}

function buildExtras(allParameters: Record<string, unknown>, removeKeys: string[]): Record<string, unknown> {
  const extras: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(allParameters)) {
    if (removeKeys.includes(key)) {
      continue
    }

    extras[key] = value
  }

  return extras
}

function formatInvalidErrors(errors: Record<string, string>) {
  const entries = Object.entries(errors)
  if (entries.length === 0) {
    return "Invalid parameter values"
  }

  return entries.map(([key, message]) => `${key}: ${message}`).join("; ")
}

function isValidRole(role: unknown): role is ChatMessage["role"] {
  return role === "system" || role === "user" || role === "assistant"
}

function resolveTextModel(options: { modelId?: string; provider?: string }): ModelCatalogEntry {
  const supportedModalities: ModelModality[] = ["llm", "vlm"]

  if (options.modelId) {
    const match = findModelById(options.modelId)

    if (!match || !supportedModalities.includes(match.modality)) {
      throw new ApiError(`Unknown model identifier "${options.modelId}" for modality "llm"`, 404)
    }

    return match
  }

  const allModels = supportedModalities.flatMap((modality) => listModelsByModality(modality))

  if (!allModels.length) {
    throw new ApiError('No models registered for modalities "llm" or "vlm"', 404)
  }

  if (options.provider) {
    const providerMatch = allModels.find((model) => model.provider === options.provider)

    if (!providerMatch) {
      throw new ApiError(
        `No models for provider "${options.provider}" registered under modalities "llm" or "vlm"`,
        404,
      )
    }

    return providerMatch
  }

  return allModels[0]
}
