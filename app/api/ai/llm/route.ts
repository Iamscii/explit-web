import { NextResponse } from "next/server"

import { normalizeParameters } from "@/lib/ai/parameter-normalizer"
import { getAdapter } from "@/lib/ai/registry"
import type { ChatMessage, ModelAdapter, TextGenerationInput } from "@/lib/ai/types"

import { ApiError, handleError, readJsonBody, resolveModelForModality } from "../_utils"

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

    const model = resolveModelForModality("llm", {
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

    const messages = buildMessages(body.messages, systemPrompt, prompt)

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

function buildMessages(input: unknown, systemPrompt?: string, fallbackPrompt?: string): ChatMessage[] {
  const parsed = parseMessages(input)
  const messages: ChatMessage[] = []

  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt })
  }

  if (parsed.length) {
    messages.push(...parsed)
  } else if (fallbackPrompt) {
    messages.push({ role: "user", content: fallbackPrompt })
  }

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

    if (!isValidRole(role) || typeof content !== "string") {
      continue
    }

    const trimmed = content.trim()
    if (!trimmed) {
      continue
    }

    messages.push({ role, content: trimmed })
  }

  return messages
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
