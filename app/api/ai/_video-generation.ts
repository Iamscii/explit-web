import { NextResponse } from "next/server"

import { normalizeParameters } from "@/lib/ai/parameter-normalizer"
import { getAdapter } from "@/lib/ai/registry"
import type { ModelAdapter, VideoGenerationInput } from "@/lib/ai/types"

import { ApiError, handleError, readJsonBody, resolveModelForModality } from "./_utils"

interface VideoGenerationRequestBody {
  modelId?: string
  provider?: string
  prompt?: unknown
  parameters?: unknown
}

type VideoModality = "text-to-video" | "image-to-video"

export function createVideoGenerationHandler(modality: VideoModality) {
  return async function POST(request: Request) {
    try {
      const body = await readJsonBody<VideoGenerationRequestBody>(request)

      const model = resolveModelForModality(modality, {
        modelId: typeof body.modelId === "string" ? body.modelId : undefined,
        provider: typeof body.provider === "string" ? body.provider : undefined,
      })

      const adapter = getAdapter(model.id) as ModelAdapter<"video">
      const parameterDefinitions = model.options.parameters ?? []
      const normalized = normalizeParameters(parameterDefinitions, body.parameters)

      const prompt = pickString(body.prompt ?? normalized.recognized.prompt)

      const remainingMissing = normalized.missingRequired.filter((key) => {
        if (key === "prompt" && prompt) {
          return false
        }
        return true
      })

      if (remainingMissing.length > 0) {
        throw new ApiError(`Missing required parameters: ${remainingMissing.join(", ")}`, 400)
      }

      if (Object.keys(normalized.invalid).length > 0) {
        throw new ApiError(formatInvalidErrors(normalized.invalid), 400)
      }

      const extras = buildExtras(normalized.combined, ["prompt"])

      const input: VideoGenerationInput = {
        ...(prompt ? { prompt } : {}),
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
          ...(prompt ? { prompt } : {}),
          parameters: extras,
        },
        result,
      })
    } catch (error) {
      return handleError(error)
    }
  }
}

function pickString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length ? trimmed : undefined
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
