import { NextResponse } from "next/server"

import { normalizeParameters } from "@/lib/ai/parameter-normalizer"
import { getAdapter } from "@/lib/ai/registry"
import type { ImageGenerationInput, ModelAdapter } from "@/lib/ai/types"

import { ApiError, handleError, readJsonBody, resolveModelForModality } from "./_utils"

interface ImageGenerationRequestBody {
  modelId?: string
  provider?: string
  prompt?: unknown
  parameters?: unknown
}

type ImageModality = "text-to-image" | "image-to-image"

export function createImageGenerationHandler(modality: ImageModality) {
  return async function POST(request: Request) {
    try {
      const body = await readJsonBody<ImageGenerationRequestBody>(request)

      const model = resolveModelForModality(modality, {
        modelId: typeof body.modelId === "string" ? body.modelId : undefined,
        provider: typeof body.provider === "string" ? body.provider : undefined,
      })

      const adapter = getAdapter(model.id) as ModelAdapter<"image">
      const parameterDefinitions = model.options.parameters ?? []
      const normalized = normalizeParameters(parameterDefinitions, body.parameters)

      const promptFromBody = pickString(body.prompt)
      const promptFromParameters = pickString(normalized.recognized.prompt)
      const prompt = promptFromBody ?? promptFromParameters

      const requiredErrors = normalized.missingRequired.filter((key) => {
        if (key === "prompt" && prompt) {
          return false
        }
        return true
      })

      if (requiredErrors.length > 0) {
        throw new ApiError(`Missing required parameters: ${requiredErrors.join(", ")}`, 400)
      }

      if (!prompt) {
        throw new ApiError("`prompt` is required for image generation", 400)
      }

      if (Object.keys(normalized.invalid).length > 0) {
        throw new ApiError(formatInvalidErrors(normalized.invalid), 400)
      }

      const negativePrompt = pickString(
        normalized.recognized.negative_prompt ?? normalized.recognized.negativePrompt,
      )

      const steps = pickNumber(normalized.recognized, ["steps", "num_inference_steps"])
      const guidanceScale = pickNumber(normalized.recognized, ["guidance_scale", "guidanceScale"])

      const extras = buildExtras(normalized.combined, [
        "prompt",
        "negative_prompt",
        "negativePrompt",
        "steps",
        "num_inference_steps",
        "guidance_scale",
        "guidanceScale",
      ])

      const input: ImageGenerationInput = {
        prompt,
        ...(negativePrompt ? { negativePrompt } : {}),
        ...(typeof steps === "number" ? { steps } : {}),
        ...(typeof guidanceScale === "number" ? { guidanceScale } : {}),
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
          prompt: input.prompt,
          ...(negativePrompt ? { negativePrompt } : {}),
          ...(typeof steps === "number" ? { steps } : {}),
          ...(typeof guidanceScale === "number" ? { guidanceScale } : {}),
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

function buildExtras(allParameters: Record<string, unknown>, removeKeys: string[]) {
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
