import { NextResponse } from "next/server"

import {
  findModelById,
  listModelsByModality,
  type ModelCatalogEntry,
  type ModelModality,
} from "@/lib/ai/model-catalog"

export class ApiError extends Error {
  public status: number

  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export function handleError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    throw new ApiError("Request body must be valid JSON", 400)
  }
}

export function resolveModelForModality(
  modality: ModelModality,
  options: { modelId?: string | null; provider?: string | null } = {},
): ModelCatalogEntry {
  const models = listModelsByModality(modality)

  if (models.length === 0) {
    throw new ApiError(`No models registered for modality "${modality}"`, 404)
  }

  if (options.modelId) {
    const match = findModelById(options.modelId)
    if (!match || match.modality !== modality) {
      throw new ApiError(`Unknown model identifier "${options.modelId}" for modality "${modality}"`, 404)
    }
    return match
  }

  if (options.provider) {
    const providerMatch = models.find((model) => model.provider === options.provider)
    if (!providerMatch) {
      throw new ApiError(
        `No models for provider "${options.provider}" registered under modality "${modality}"`,
        404,
      )
    }
    return providerMatch
  }

  return models[0]
}
