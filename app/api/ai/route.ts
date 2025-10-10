import { Buffer } from "node:buffer"

import { NextResponse } from "next/server"

import { getAdapter, listAdapters } from "@/lib/ai/registry"
import type {
  ChatMessage,
  ImageGenerationInput,
  ModelAdapter,
  ModelResult,
  ModelTask,
  TextGenerationInput,
} from "@/lib/ai/types"
import { uploadToS3 } from "@/lib/storage/s3"

type PersistConfig =
  | {
      provider: "s3"
      directory?: string
      makePublic?: boolean
    }
  | undefined

interface TextResponse {
  modelId: string
  provider: string
  task: "text"
  result: ModelResult<"text">
}

interface ImageResponse {
  modelId: string
  provider: string
  task: "image"
  result: ModelResult<"image">
  persistedAssets?: Array<{
    bucket: string
    key: string
    url: string
    sourceUrl: string
    contentType: string
  }>
}

class ApiError extends Error {
  public status: number

  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const taskParam = url.searchParams.get("task")

  let task: ModelTask | undefined

  if (taskParam === "text" || taskParam === "image") {
    task = taskParam
  } else if (taskParam) {
    return NextResponse.json(
      { error: `Unsupported task filter: ${taskParam}` },
      { status: 400 },
    )
  }

  const models = listAdapters(task).map((adapter) => ({
    id: adapter.id,
    label: adapter.label,
    provider: adapter.provider,
    task: adapter.task,
    defaultOptions: adapter.defaultOptions ?? {},
  }))

  return NextResponse.json({ models })
}

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const { modelId, task: requestedTask } = payload ?? {}

    if (typeof modelId !== "string" || !modelId.trim()) {
      throw new ApiError("`modelId` must be a non-empty string", 400)
    }

    let adapter
    try {
      adapter = getAdapter(modelId)
    } catch (lookupError) {
      const message = lookupError instanceof Error ? lookupError.message : "Unknown model identifier"
      throw new ApiError(message, 404)
    }

    if (requestedTask && requestedTask !== adapter.task) {
      throw new ApiError(
        `Requested task (${requestedTask}) does not match the registered task (${adapter.task}) for model ${modelId}`,
        400,
      )
    }

    if (adapter.task === "text") {
      const textAdapter = adapter as ModelAdapter<"text">
      const input = normalizeTextInput(payload?.input)
      const result = await textAdapter.invoke(input)

      const body: TextResponse = {
        modelId: adapter.id,
        provider: adapter.provider,
        task: "text",
        result,
      }

      return NextResponse.json(body)
    }

    if (adapter.task === "image") {
      const imageAdapter = adapter as ModelAdapter<"image">
      const input = normalizeImageInput(payload?.input)
      const persistConfig = normalizePersistConfig(payload?.persist)

      const result = await imageAdapter.invoke(input)
      let persistedAssets: ImageResponse["persistedAssets"]

      if (persistConfig) {
        persistedAssets = await persistImages(result, adapter.id, persistConfig)
      }

      const body: ImageResponse = {
        modelId: adapter.id,
        provider: adapter.provider,
        task: "image",
        result,
        ...(persistedAssets ? { persistedAssets } : {}),
      }

      return NextResponse.json(body)
    }

    throw new ApiError(`Unsupported task for model ${adapter.id}`, 400)
  } catch (error) {
    console.error("[AI_ROUTE_ERROR]", error)

    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
  }
}

function normalizeTextInput(input: unknown): TextGenerationInput {
  if (!input || typeof input !== "object") {
    throw new ApiError("Text generation input must be an object", 400)
  }

  const record = input as Record<string, unknown>
  const messages = record.messages

  if (!Array.isArray(messages) || !messages.length) {
    throw new ApiError("`input.messages` must be a non-empty array", 400)
  }

  const parsedMessages = messages.map((message, index) => parseChatMessage(message, index))

  const temperature = parseOptionalNumber(record.temperature, "input.temperature")
  const maxOutputTokens = parseOptionalNumber(record.maxOutputTokens, "input.maxOutputTokens")
  const extras = record.extras && typeof record.extras === "object" ? (record.extras as Record<string, unknown>) : undefined

  return {
    messages: parsedMessages,
    ...(temperature !== undefined ? { temperature } : {}),
    ...(maxOutputTokens !== undefined ? { maxOutputTokens } : {}),
    ...(extras ? { extras } : {}),
  }
}

function normalizeImageInput(input: unknown): ImageGenerationInput {
  if (!input || typeof input !== "object") {
    throw new ApiError("Image generation input must be an object", 400)
  }

  const record = input as Record<string, unknown>
  const prompt = record.prompt

  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new ApiError("`input.prompt` must be a non-empty string", 400)
  }

  const extras = record.extras && typeof record.extras === "object" ? (record.extras as Record<string, unknown>) : undefined
  const steps = parseOptionalNumber(record.steps, "input.steps")
  const guidanceScale = parseOptionalNumber(record.guidanceScale, "input.guidanceScale")

  return {
    prompt,
    ...(typeof record.negativePrompt === "string" && record.negativePrompt.trim()
      ? { negativePrompt: record.negativePrompt }
      : {}),
    ...(steps !== undefined ? { steps } : {}),
    ...(guidanceScale !== undefined ? { guidanceScale } : {}),
    ...(typeof record.aspectRatio === "string" && record.aspectRatio.trim()
      ? { aspectRatio: record.aspectRatio }
      : {}),
    ...(extras ? { extras } : {}),
  }
}

function normalizePersistConfig(input: unknown): PersistConfig {
  if (!input || typeof input !== "object") {
    return undefined
  }

  const record = input as Record<string, unknown>
  const provider = record.provider

  if (provider !== "s3") {
    throw new ApiError("Currently only `s3` persistence is supported", 400)
  }

  return {
    provider: "s3",
    directory:
      typeof record.directory === "string" && record.directory.trim()
        ? sanitizePath(record.directory)
        : "generated",
    makePublic: Boolean(record.makePublic),
  }
}

function parseChatMessage(message: unknown, index: number): ChatMessage {
  if (!message || typeof message !== "object") {
    throw new ApiError(`Message at index ${index} must be an object`, 400)
  }

  const record = message as Record<string, unknown>
  const role = record.role
  const content = record.content

  if (role !== "system" && role !== "user" && role !== "assistant") {
    throw new ApiError(`Message at index ${index} has an invalid role`, 400)
  }

  if (typeof content !== "string" || !content.trim()) {
    throw new ApiError(`Message at index ${index} must include non-empty content`, 400)
  }

  return { role, content }
}

function parseOptionalNumber(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }

  throw new ApiError(`${fieldName} must be a finite number`, 400)
}

async function persistImages(result: ModelResult<"image">, modelId: string, config: Exclude<PersistConfig, undefined>) {
  const persistedAssets: ImageResponse["persistedAssets"] = []
  const safeModelSegment = sanitizePath(modelId)
  const directory = `${config.directory}/${safeModelSegment}`

  for (const [index, asset] of result.assets.entries()) {
    const response = await fetch(asset.url)

    if (!response.ok) {
      throw new ApiError(
        `Failed to download generated asset (${response.status}) from ${asset.url}`,
        502,
      )
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const contentType = asset.mimeType ?? response.headers.get("content-type") ?? "application/octet-stream"
    const extension = guessExtension(contentType)
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const key = `${directory}/${timestamp}-${index}.${extension}`

    const uploadResult = await uploadToS3({
      key,
      body: buffer,
      contentType,
      acl: config.makePublic ? "public-read" : undefined,
    })

    persistedAssets.push({
      bucket: uploadResult.bucket,
      key: uploadResult.key,
      url: uploadResult.url,
      sourceUrl: asset.url,
      contentType,
    })
  }

  return persistedAssets
}

function guessExtension(contentType: string | null): string {
  const mime = (contentType ?? "").toLowerCase()

  if (mime.includes("png")) {
    return "png"
  }

  if (mime.includes("jpeg") || mime.includes("jpg")) {
    return "jpg"
  }

  if (mime.includes("webp")) {
    return "webp"
  }

  if (mime.includes("gif")) {
    return "gif"
  }

  if (mime.includes("svg")) {
    return "svg"
  }

  return "bin"
}

function sanitizePath(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9/_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/\/+/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
}
