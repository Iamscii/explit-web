import { listModelsByModality } from "./model-catalog"
import type { ModelCatalogEntry, ModelModality } from "./model-catalog"
import { ensureAbsoluteUrl, getEnv, stripUndefined } from "./utils"
import type { ModelAdapter, TextGenerationInput } from "./types"

const OPENROUTER_MODALITIES: ModelModality[] = ["llm", "vlm"]

const OPENROUTER_TEXT_MODELS = OPENROUTER_MODALITIES.flatMap((modality) =>
  listModelsByModality(modality).filter((entry) => entry.provider === "openrouter"),
)

function createOpenRouterAdapter(entry: ModelCatalogEntry): ModelAdapter<"text"> {
  return {
    id: entry.id,
    label: entry.label,
    provider: entry.provider,
    task: "text",
    defaultOptions: entry.options.defaultParams,
    async invoke(input: TextGenerationInput) {
      const apiKey = getEnv("OPENROUTER_API_KEY")
      const baseUrl = process.env.OPENROUTER_API_URL ?? "https://openrouter.ai/api/v1"
      const endpoint = ensureAbsoluteUrl(baseUrl, "/chat/completions")

      const modelFieldName = entry.options.modelFieldName ?? "model"
      const payloadBase: Record<string, unknown> = {
        messages: input.messages,
        temperature: input.temperature,
        max_tokens: input.maxOutputTokens,
        ...(entry.options.defaultParams ?? {}),
        ...(input.extras ?? {}),
      }

      payloadBase[modelFieldName] = entry.upstreamId

      const payload = stripUndefined(payloadBase)

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorPayload = await safeReadJson(response)
        throw new Error(
          `OpenRouter request failed (${response.status}): ${JSON.stringify(errorPayload ?? {})}`,
        )
      }

      const data = await response.json()
      const text = data?.choices?.[0]?.message?.content

      if (typeof text !== "string" || !text.trim()) {
        throw new Error("OpenRouter response did not include a completion message")
      }

      const usageData = data?.usage
      const usage = usageData
        ? {
            promptTokens: usageNumber(usageData.prompt_tokens),
            completionTokens: usageNumber(usageData.completion_tokens),
            totalTokens: usageNumber(usageData.total_tokens),
          }
        : undefined

      return {
        text,
        raw: data,
        usage,
      }
    },
  }
}

function usageNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? undefined : parsed
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

export const openRouterAdapters = OPENROUTER_TEXT_MODELS.map(createOpenRouterAdapter)
