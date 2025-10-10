export type ModelTask = "text" | "image" | "video"

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface TextGenerationInput {
  messages: ChatMessage[]
  temperature?: number
  maxOutputTokens?: number
  extras?: Record<string, unknown>
}

export interface ImageGenerationInput {
  prompt: string
  negativePrompt?: string
  steps?: number
  guidanceScale?: number
  aspectRatio?: string
  extras?: Record<string, unknown>
}

export interface VideoGenerationInput {
  prompt?: string
  extras?: Record<string, unknown>
}

type ModelInputMap = {
  text: TextGenerationInput
  image: ImageGenerationInput
  video: VideoGenerationInput
}

type ModelResultMap = {
  text: {
    text: string
    raw: unknown
    usage?: {
      promptTokens?: number
      completionTokens?: number
      totalTokens?: number
    }
  }
  image: {
    assets: Array<{
      url: string
      mimeType?: string
      provider?: string
      seed?: string
    }>
    raw: unknown
  }
  video: {
    assets: Array<{
      url: string
      mimeType?: string
      provider?: string
      seed?: string
    }>
    raw: unknown
  }
}

export type ModelInput<TTask extends ModelTask> = ModelInputMap[TTask]
export type ModelResult<TTask extends ModelTask> = ModelResultMap[TTask]

export interface ModelAdapter<TTask extends ModelTask> {
  id: string
  label: string
  provider: string
  task: TTask
  defaultOptions?: Record<string, unknown>
  invoke(input: ModelInput<TTask>): Promise<ModelResult<TTask>>
}

export type AnyModelAdapter = ModelAdapter<ModelTask>
