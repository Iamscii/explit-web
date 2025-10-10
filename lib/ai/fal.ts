import { listModelsByModality } from "./model-catalog"
import type { ModelCatalogEntry, ModelModality } from "./model-catalog"
import type { ImageGenerationInput, ModelAdapter, VideoGenerationInput } from "./types"
import { ensureAbsoluteUrl, getEnv, stripUndefined } from "./utils"

const FAL_API_BASE = process.env.FAL_API_BASE ?? "https://fal.run"

const IMAGE_MODALITIES: ModelModality[] = ["text-to-image", "image-to-image"]
const VIDEO_MODALITIES: ModelModality[] = ["text-to-video", "image-to-video"]

const FAL_IMAGE_MODELS = collectFalModels(IMAGE_MODALITIES)
const FAL_VIDEO_MODELS = collectFalModels(VIDEO_MODALITIES)

function collectFalModels(modalities: ModelModality[]): ModelCatalogEntry[] {
  return modalities.flatMap((modality) =>
    listModelsByModality(modality).filter((entry) => entry.provider === "fal"),
  )
}

function createFalImageAdapter(entry: ModelCatalogEntry): ModelAdapter<"image"> {
  return {
    id: entry.id,
    label: entry.label,
    provider: entry.provider,
    task: "image",
    defaultOptions: entry.options.defaultParams,
    async invoke(input: ImageGenerationInput) {
      const apiKey = getEnv("FAL_KEY")
      const endpoint = buildEndpoint(entry)

      const payload = stripUndefined({
        prompt: input.prompt,
        negative_prompt: input.negativePrompt,
        steps: input.steps,
        guidance_scale: input.guidanceScale,
        aspect_ratio: input.aspectRatio,
        ...(entry.options.defaultParams ?? {}),
        ...(input.extras ?? {}),
      })

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Key ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorPayload = await safeReadJson(response)
        throw new Error(`FAL request failed (${response.status}): ${JSON.stringify(errorPayload ?? {})}`)
      }

      const data = await response.json()
      const assets = extractMediaAssets(data)

      if (!assets.length) {
        throw new Error("FAL response did not include any media assets")
      }

      return {
        assets,
        raw: data,
      }
    },
  }
}

function createFalVideoAdapter(entry: ModelCatalogEntry): ModelAdapter<"video"> {
  return {
    id: entry.id,
    label: entry.label,
    provider: entry.provider,
    task: "video",
    defaultOptions: entry.options.defaultParams,
    async invoke(input: VideoGenerationInput) {
      const apiKey = getEnv("FAL_KEY")
      const endpoint = buildEndpoint(entry)

      const payload = stripUndefined({
        prompt: input.prompt,
        ...(entry.options.defaultParams ?? {}),
        ...(input.extras ?? {}),
      })

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Key ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorPayload = await safeReadJson(response)
        throw new Error(`FAL request failed (${response.status}): ${JSON.stringify(errorPayload ?? {})}`)
      }

      const data = await response.json()
      const assets = extractMediaAssets(data)

      if (!assets.length) {
        throw new Error("FAL response did not include any media assets")
      }

      return {
        assets,
        raw: data,
      }
    },
  }
}

function buildEndpoint(entry: ModelCatalogEntry) {
  const endpointPath =
    typeof entry.options.endpointPath === "string" && entry.options.endpointPath.length > 0
      ? entry.options.endpointPath
      : entry.upstreamId
  return ensureAbsoluteUrl(FAL_API_BASE, `/${endpointPath}`)
}

function extractMediaAssets(data: unknown) {
  const assets: Array<{ url: string; mimeType?: string; seed?: string }> = []
  const seen = new Set<string>()

  function visit(value: unknown, depth: number) {
    if (depth > 6 || value === null || value === undefined) {
      return
    }

    if (typeof value === "string") {
      maybeAddAsset({ url: value })
      return
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item, depth + 1)
      }
      return
    }

    if (typeof value === "object") {
      const record = value as Record<string, unknown>
      const url = record.url

      if (typeof url === "string") {
        const mimeType =
          typeof record.content_type === "string"
            ? record.content_type
            : typeof record.mime_type === "string"
              ? record.mime_type
              : guessMimeType(url)
        const seed =
          typeof record.seed === "string" || typeof record.seed === "number"
            ? String(record.seed)
            : undefined

        maybeAddAsset({ url, mimeType, seed })
      }

      for (const nested of Object.values(record)) {
        visit(nested, depth + 1)
      }
    }
  }

  function maybeAddAsset(asset: { url: string; mimeType?: string; seed?: string }) {
    if (!asset.url || !asset.url.startsWith("http")) {
      return
    }

    if (seen.has(asset.url)) {
      return
    }

    seen.add(asset.url)
    assets.push(asset)
  }

  visit(data, 0)
  return assets
}

function guessMimeType(url: string): string | undefined {
  const lower = url.toLowerCase()
  if (lower.endsWith(".mp4")) {
    return "video/mp4"
  }
  if (lower.endsWith(".webm")) {
    return "video/webm"
  }
  if (lower.endsWith(".gif")) {
    return "image/gif"
  }
  if (lower.endsWith(".png")) {
    return "image/png"
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg"
  }
  if (lower.endsWith(".webp")) {
    return "image/webp"
  }
  return undefined
}

async function safeReadJson(response: Response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

export const falAdapters = [
  ...FAL_IMAGE_MODELS.map(createFalImageAdapter),
  ...FAL_VIDEO_MODELS.map(createFalVideoAdapter),
]
