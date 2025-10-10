import type { ImageSizeConfig, ImageSizePreset } from "./image-size";
import type { ModelTask } from "./types";

export type ModelModality =
  | "llm"
  | "vlm"
  | "text-to-image"
  | "image-to-image"
  | "text-to-video"
  | "image-to-video";

export interface ModelOptions {
  /**
   * Name of the payload field the upstream provider expects for the model identifier.
   */
  modelFieldName: string;
  /**
   * Providers like OpenRouter may support tool-calling / structured outputs for specific models.
   */
  structuredOutputs?: boolean;
  /**
   * Optional path override for providers that rely on REST endpoints (e.g., FAL).
   */
  endpointPath?: string;
  /**
   * Default parameters that should be merged into the provider request payload.
   */
  defaultParams?: Record<string, unknown>;
  /**
   * Declarative parameter schema for UI builders or validation layers.
   */
  parameters?: ModelParameterDefinition[];
}

export type StandardModelParameterType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "array"
  | "object";

export type ModelParameterType = StandardModelParameterType | "imagesize";

interface BaseModelParameterDefinition {
  key: string;
  type: StandardModelParameterType;
  required?: boolean;
  defaultValue?: unknown;
  description?: string;
  enum?: unknown[];
}

export interface ImageSizeParameterDefinition {
  key: string;
  type: "imagesize";
  required?: boolean;
  /**
   * Defaults to a preset identifier (e.g. "1:1").
   */
  defaultValue?: string;
  description?: string;
  imageSize: ImageSizeConfig;
}

export type ModelParameterDefinition =
  | BaseModelParameterDefinition
  | ImageSizeParameterDefinition;

export interface ModelCatalogEntry {
  /**
   * Stable identifier exposed to the rest of the app.
   * Defaults to `${provider}:${upstreamId}` to remain stable across refactors.
   */
  id: string;
  /**
   * Human-readable label surfaced to the UI.
   */
  label: string;
  /**
   * Upstream provider slug (e.g., `openrouter`, `fal`).
   */
  provider: string;
  /**
   * High-level modality bucket.
   */
  modality: ModelModality;
  /**
   * Provider-native model identifier (e.g., `openai/gpt-4.1-mini`).
   */
  upstreamId: string;
  /**
   * Additional configuration for invoking the provider.
   */
  options: ModelOptions;
}

export type ModelCatalog = {
  [K in ModelModality]: ModelCatalogEntry[];
};

const OPENROUTER_TEXT_PARAMETERS: ModelParameterDefinition[] = [
  {
    key: "top_p",
    type: "number",
    defaultValue: 1,
    description:
      "Nucleus sampling cutoff (0-1). Lower values focus on more likely tokens.",
  },
  {
    key: "frequency_penalty",
    type: "number",
    defaultValue: 0,
    description:
      "Discourage repeated tokens. Negative values encourage repetition (range -2.0 to 2.0).",
  },
  {
    key: "presence_penalty",
    type: "number",
    defaultValue: 0,
    description:
      "Encourage new topics. Positive values reduce repetition (range -2.0 to 2.0).",
  },
  {
    key: "stop",
    type: "array",
    description:
      "JSON array of stop sequences that will halt generation when encountered.",
  },
  {
    key: "logprobs",
    type: "integer",
    description:
      "Return log probabilities for the top tokens at each step when greater than 0.",
  },
  {
    key: "top_logprobs",
    type: "integer",
    description:
      "How many alternative tokens to include when logprobs are enabled.",
  },
  {
    key: "seed",
    type: "integer",
    description:
      "Deterministic seed for reproducible generations when the model supports it.",
  },
  {
    key: "user",
    type: "string",
    description:
      "Unique end-user identifier for abuse monitoring on the provider side.",
  },
  {
    key: "response_format",
    type: "object",
    description:
      'Structured output control, e.g. {"type":"json_object"} or a JSON schema payload.',
  },
  {
    key: "tools",
    type: "array",
    description:
      "Array of tool definitions/functions available for tool-calling.",
  },
  {
    key: "tool_choice",
    type: "string",
    description:
      "Force a specific tool or disable tool-calling (values: auto, none, or tool name).",
  },
  {
    key: "parallel_tool_calls",
    type: "boolean",
    description:
      "Allow the model to execute multiple tool calls in parallel when supported.",
  },
];

const FAL_STANDARD_IMAGE_SIZE_PRESETS: ImageSizePreset[] = [
  {
    id: "1:1",
    label: "1:1",
    ratio: [1, 1],
    aliases: ["square", "square_hd"],
  },
  {
    id: "1:2",
    label: "1:2",
    ratio: [1, 2],
    aliases: ["portrait_1_2"],
  },
  {
    id: "2:1",
    label: "2:1",
    ratio: [2, 1],
    aliases: ["portrait_2_1"],
  },
  {
    id: "2:3",
    label: "2:3",
    ratio: [2, 3],
    aliases: ["portrait_2_3"],
  },
  {
    id: "3:2",
    label: "3:2",
    ratio: [3, 2],
    aliases: ["portrait_3_2"],
  },
  {
    id: "3:4",
    label: "3:4",
    ratio: [3, 4],
    aliases: ["portrait_4_3"],
  },
  {
    id: "4:3",
    label: "4:3",
    ratio: [4, 3],
    aliases: ["landscape_4_3"],
  },
  {
    id: "9:16",
    label: "9:16",
    ratio: [9, 16],
    aliases: ["portrait_16_9"],
  },
  {
    id: "16:9",
    label: "16:9",
    ratio: [16, 9],
    aliases: ["landscape_16_9"],
  },
];

const FAL_FLUX_IMAGE_SIZE_CONFIG: ImageSizeConfig = {
  presets: FAL_STANDARD_IMAGE_SIZE_PRESETS,
  constraints: {
    min: 512,
    max: 1536,
    multiple: 8,
  },
};

const FAL_QWEN_IMAGE_SIZE_CONFIG: ImageSizeConfig = {
  presets: FAL_STANDARD_IMAGE_SIZE_PRESETS,
  constraints: {
    min: 512,
    max: 1536,
    multiple: 8,
  },
};

const FAL_SEEDREAM_IMAGE_SIZE_CONFIG: ImageSizeConfig = {
  presets: FAL_STANDARD_IMAGE_SIZE_PRESETS,
  constraints: {
    min: 1024,
    max: 4096,
    multiple: 8,
  },
};

interface ModelEntryConfig {
  label: string;
  provider: string;
  modality: ModelModality;
  upstreamId: string;
  options: ModelOptions;
  id?: string;
}

function createModelEntry(config: ModelEntryConfig): ModelCatalogEntry {
  const {
    label,
    provider,
    modality,
    upstreamId,
    options,
    id = `${provider}:${upstreamId}`,
  } = config;

  return {
    id,
    label,
    provider,
    modality,
    upstreamId,
    options,
  };
}

export const MODEL_CATALOG: ModelCatalog = {
  llm: [
    createModelEntry({
      label: "DeepSeek Chat v3.2 Experimental",
      provider: "openrouter",
      modality: "llm",
      upstreamId: "deepseek/deepseek-v3.2-exp",
      options: {
        modelFieldName: "model",
        structuredOutputs: false,
        parameters: [...OPENROUTER_TEXT_PARAMETERS],
      },
    }),
    createModelEntry({
      label: "GPT-4.1 Mini",
      provider: "openrouter",
      modality: "llm",
      upstreamId: "openai/gpt-4.1-mini",
      options: {
        modelFieldName: "model",
        structuredOutputs: true,
        parameters: [...OPENROUTER_TEXT_PARAMETERS],
      },
    }),
    createModelEntry({
      label: "Grok 4 Fast",
      provider: "openrouter",
      modality: "llm",
      upstreamId: "x-ai/grok-4-fast",
      options: {
        modelFieldName: "model",
        structuredOutputs: false,
        parameters: [...OPENROUTER_TEXT_PARAMETERS],
      },
    }),
    createModelEntry({
      label: "Anthropic Claude 3.5 Sonnet",
      provider: "openrouter",
      modality: "llm",
      upstreamId: "anthropic/claude-3.5-sonnet",
      options: {
        modelFieldName: "model",
        structuredOutputs: false,
        parameters: [...OPENROUTER_TEXT_PARAMETERS],
      },
    }),
    createModelEntry({
      label: "GPT-5 Pro (非常慢，慎选)",
      provider: "openrouter",
      modality: "llm",
      upstreamId: "openai/gpt-5-pro",
      options: {
        modelFieldName: "model",
        structuredOutputs: true,
        parameters: [
          ...OPENROUTER_TEXT_PARAMETERS,
          {
            key: "reasoning",
            type: "object",
            description:
              'Reasoning configuration for advanced models, e.g. {"effort":"medium"} to trade speed vs. depth.',
          },
        ],
      },
    }),
    createModelEntry({
      label: "OpenRouter GPT-4o mini",
      provider: "openrouter",
      modality: "llm",
      upstreamId: "openai/gpt-4o-mini",
      options: {
        modelFieldName: "model",
        structuredOutputs: false,
        parameters: [...OPENROUTER_TEXT_PARAMETERS],
      },
    }),
  ],
  vlm: [
    createModelEntry({
      label: "Qwen VL 30B A3B Instruct",
      provider: "openrouter",
      modality: "vlm",
      upstreamId: "qwen/qwen3-vl-30b-a3b-instruct",
      options: {
        modelFieldName: "model",
        structuredOutputs: true,
        parameters: [
          ...OPENROUTER_TEXT_PARAMETERS,
          {
            key: "image_urls",
            type: "array",
            description:
              "List of image URLs to include alongside the user prompt.",
          },
        ],
      },
    }),
  ],
  "text-to-image": [
    createModelEntry({
      label: "FAL Flux Pro",
      provider: "fal",
      modality: "text-to-image",
      upstreamId: "fal-ai/flux-pro",
      options: {
        modelFieldName: "path",
        endpointPath: "fal-ai/flux-pro",
        parameters: [
          { key: "sync_mode", type: "boolean", defaultValue: false },
          { key: "prompt", type: "string", required: true },
          { key: "negative_prompt", type: "string" },
          { key: "num_inference_steps", type: "number", defaultValue: 30 },
          { key: "guidance_scale", type: "number", defaultValue: 4 },
          { key: "num_images", type: "number", defaultValue: 1 },
          { key: "enable_safety_checker", type: "boolean", defaultValue: true },
          {
            key: "output_format",
            type: "string",
            defaultValue: "png",
            enum: ["jpeg", "png"],
          },
          {
            key: "image_size",
            type: "imagesize",
            defaultValue: "1:1",
            description:
              "Aspect ratio for the generated image. Converted to width/height before dispatching to FAL.",
            imageSize: FAL_FLUX_IMAGE_SIZE_CONFIG,
          },
          { key: "seed", type: "number" },
          {
            key: "acceleration",
            type: "string",
            defaultValue: "regular",
            enum: ["none", "regular", "high"],
          },
          { key: "strength", type: "number", defaultValue: 0.94 },
          { key: "image_url", type: "string" },
        ],
      },
    }),
    createModelEntry({
      label: "FAL Flux LoRA",
      provider: "fal",
      modality: "text-to-image",
      upstreamId: "fal-ai/flux-lora",
      options: {
        modelFieldName: "path",
        endpointPath: "fal-ai/flux-lora",
        parameters: [
          { key: "sync_mode", type: "boolean", defaultValue: false },
          { key: "prompt", type: "string", required: true },
          { key: "negative_prompt", type: "string" },
          { key: "num_inference_steps", type: "number", defaultValue: 30 },
          { key: "guidance_scale", type: "number", defaultValue: 4 },
          { key: "num_images", type: "number", defaultValue: 1 },
          { key: "enable_safety_checker", type: "boolean", defaultValue: true },
          {
            key: "output_format",
            type: "string",
            defaultValue: "png",
            enum: ["jpeg", "png"],
          },
          {
            key: "image_size",
            type: "imagesize",
            defaultValue: "1:1",
            description:
              "Aspect ratio for the generated image. Converted to width/height before dispatching to FAL.",
            imageSize: FAL_FLUX_IMAGE_SIZE_CONFIG,
          },
          { key: "seed", type: "number" },
          {
            key: "acceleration",
            type: "string",
            defaultValue: "regular",
            enum: ["none", "regular", "high"],
          },
          { key: "strength", type: "number", defaultValue: 0.94 },
          { key: "image_url", type: "string" },
        ],
      },
    }),
    createModelEntry({
      label: "FAL Flux Pro v1.1 Ultra",
      provider: "fal",
      modality: "text-to-image",
      upstreamId: "fal-ai/flux-pro/v1.1-ultra",
      options: {
        modelFieldName: "path",
        endpointPath: "fal-ai/flux-pro/v1.1-ultra",
        parameters: [
          {
            key: "prompt",
            type: "string",
            required: true,
            description: "The prompt to generate an image from",
          },
          {
            key: "seed",
            type: "number",
            description:
              "The same seed and the same prompt given to the same version of the model will output the same image every time",
          },
          {
            key: "sync_mode",
            type: "boolean",
            defaultValue: false,
            description:
              "If set to true, the function will wait for the image to be generated and uploaded before returning the response",
          },
          {
            key: "num_images",
            type: "number",
            defaultValue: 1,
            description: "The number of images to generate",
          },
          {
            key: "enable_safety_checker",
            type: "boolean",
            defaultValue: true,
            description: "If set to true, the safety checker will be enabled",
          },
          {
            key: "output_format",
            type: "string",
            defaultValue: "jpeg",
            enum: ["jpeg", "png"],
            description: "The format of the generated image",
          },
          {
            key: "safety_tolerance",
            type: "string",
            defaultValue: "2",
            enum: ["1", "2", "3", "4", "5", "6"],
            description:
              "The safety tolerance level for the generated image. 1 being the most strict and 5 being the most permissive",
          },
          {
            key: "enhance_prompt",
            type: "boolean",
            description: "Whether to enhance the prompt for better results",
          },
          {
            key: "aspect_ratio",
            type: "string",
            defaultValue: "16:9",
            enum: [
              "21:9",
              "16:9",
              "4:3",
              "3:2",
              "1:1",
              "2:3",
              "3:4",
              "9:16",
              "9:21",
            ],
            description: "The aspect ratio of the generated image",
          },
          {
            key: "raw",
            type: "boolean",
            description: "Generate less processed, more natural-looking images",
          },
        ],
      },
    }),
    createModelEntry({
      label: "Qwen Image",
      provider: "fal",
      modality: "text-to-image",
      upstreamId: "fal-ai/qwen-image",
      options: {
        modelFieldName: "path",
        endpointPath: "fal-ai/qwen-image",
        parameters: [
          {
            key: "prompt",
            type: "string",
            required: true,
            description: "The prompt to generate the image with",
          },
          {
            key: "image_size",
            type: "imagesize",
            defaultValue: "4:3",
            description:
              "Aspect ratio for the generated image. Converted to width/height before dispatching to FAL.",
            imageSize: FAL_QWEN_IMAGE_SIZE_CONFIG,
          },
          {
            key: "num_inference_steps",
            type: "integer",
            defaultValue: 30,
            description: "The number of inference steps to perform",
          },
          {
            key: "seed",
            type: "integer",
            description:
              "The same seed and the same prompt given to the same version of the model will output the same image every time",
          },
          {
            key: "guidance_scale",
            type: "number",
            defaultValue: 2.5,
            description:
              "The CFG (Classifier Free Guidance) scale is a measure of how close you want the model to stick to your prompt",
          },
          {
            key: "sync_mode",
            type: "boolean",
            defaultValue: false,
            description:
              "If set to true, the function will wait for the image to be generated and uploaded before returning the response",
          },
          {
            key: "num_images",
            type: "integer",
            defaultValue: 1,
            description: "The number of images to generate",
          },
          {
            key: "enable_safety_checker",
            type: "boolean",
            defaultValue: true,
            description: "If set to true, the safety checker will be enabled",
          },
          {
            key: "output_format",
            type: "string",
            defaultValue: "png",
            enum: ["jpeg", "png"],
            description: "The format of the generated image",
          },
          {
            key: "negative_prompt",
            type: "string",
            defaultValue: " ",
            description: "The negative prompt for the generation",
          },
          {
            key: "acceleration",
            type: "string",
            defaultValue: "none",
            enum: ["none", "regular", "high"],
            description:
              "Acceleration level for image generation. Higher acceleration increases speed. 'regular' balances speed and quality. 'high' is recommended for images without text",
          },
          {
            key: "loras",
            type: "array",
            description:
              "The LoRAs to use for the image generation. You can use up to 3 LoRAs and they will be merged together to generate the final image",
          },
        ],
      },
    }),
    createModelEntry({
      label: "FAL Bytedance Seedream v4",
      provider: "fal",
      modality: "text-to-image",
      upstreamId: "fal-ai/bytedance/seedream/v4/text-to-image",
      options: {
        modelFieldName: "path",
        endpointPath: "fal-ai/bytedance/seedream/v4/text-to-image",
        parameters: [
          {
            key: "prompt",
            type: "string",
            required: true,
            description: "The text prompt used to generate the image",
          },
          {
            key: "image_size",
            type: "imagesize",
            defaultValue: "1:1",
            description:
              "Aspect ratio for the generated image. Width and height are auto-derived (1024-4096 range enforced).",
            imageSize: FAL_SEEDREAM_IMAGE_SIZE_CONFIG,
          },
          {
            key: "num_images",
            type: "integer",
            defaultValue: 1,
            description:
              "Number of separate model generations to be run with the prompt",
          },
          {
            key: "max_images",
            type: "integer",
            defaultValue: 1,
            description:
              "If set to a number greater than one, enables multi-image generation. The model will potentially return up to max_images images every generation",
          },
          {
            key: "seed",
            type: "integer",
            description:
              "Random seed to control the stochasticity of image generation",
          },
          {
            key: "sync_mode",
            type: "boolean",
            defaultValue: false,
            description:
              "If True, the media will be returned as a data URI and the output data won't be available in the request history",
          },
          {
            key: "enable_safety_checker",
            type: "boolean",
            defaultValue: true,
            description: "If set to true, the safety checker will be enabled",
          },
        ],
      },
    }),
  ],
  "image-to-image": [
    createModelEntry({
      label: "FAL Nano Banana Image Editor",
      provider: "fal",
      modality: "image-to-image",
      upstreamId: "fal-ai/nano-banana/edit",
      options: {
        modelFieldName: "path",
        endpointPath: "fal-ai/nano-banana/edit",
        parameters: [
          {
            key: "prompt",
            type: "string",
            required: true,
            description: "The prompt for image editing",
          },
          {
            key: "image_urls",
            type: "array",
            required: true,
            description: "List of URLs of input images for editing",
          },
          {
            key: "num_images",
            type: "integer",
            defaultValue: 1,
            description: "Number of images to generate",
          },
          {
            key: "output_format",
            type: "string",
            defaultValue: "jpeg",
            enum: ["jpeg", "png"],
            description: "Output format for the images",
          },
          {
            key: "sync_mode",
            type: "boolean",
            defaultValue: false,
            description:
              "If True, the media will be returned as a data URI and the output data won't be available in the request history",
          },
          {
            key: "aspect_ratio",
            type: "string",
            enum: [
              "21:9",
              "1:1",
              "4:3",
              "3:2",
              "2:3",
              "5:4",
              "4:5",
              "3:4",
              "16:9",
              "9:16",
            ],
            description:
              "Aspect ratio for generated images. Default is None, which takes one of the input images' aspect ratio",
          },
        ],
      },
    }),
  ],
  "text-to-video": [
    createModelEntry({
      label: "FAL Wan 2.5 Text to Video",
      provider: "fal",
      modality: "text-to-video",
      upstreamId: "fal-ai/wan-25-preview/text-to-video",
      options: {
        modelFieldName: "path",
        endpointPath: "fal-ai/wan-25-preview/text-to-video",
        parameters: [
          {
            key: "prompt",
            type: "string",
            required: true,
            description:
              "The text prompt for video generation. Supports Chinese and English, max 800 characters",
          },
          {
            key: "audio_url",
            type: "string",
            description:
              "URL of the audio to use as the background music. Must be publicly accessible",
          },
          {
            key: "aspect_ratio",
            type: "string",
            defaultValue: "16:9",
            enum: ["16:9", "9:16", "1:1"],
            description: "The aspect ratio of the generated video",
          },
          {
            key: "resolution",
            type: "string",
            defaultValue: "1080p",
            enum: ["480p", "720p", "1080p"],
            description: "Video resolution tier",
          },
          {
            key: "duration",
            type: "string",
            defaultValue: "5",
            enum: ["5", "10"],
            description:
              "Duration of the generated video in seconds. Choose between 5 or 10 seconds",
          },
          {
            key: "negative_prompt",
            type: "string",
            description:
              "Negative prompt to describe content to avoid. Max 500 characters",
          },
          {
            key: "enable_prompt_expansion",
            type: "boolean",
            defaultValue: true,
            description:
              "Whether to enable prompt rewriting using LLM. Improves results for short prompts but increases processing time",
          },
          {
            key: "seed",
            type: "integer",
            description:
              "Random seed for reproducibility. If None, a random seed is chosen",
          },
        ],
      },
    }),
    createModelEntry({
      label: "FAL Seedance Pro Text to Video",
      provider: "fal",
      modality: "text-to-video",
      upstreamId: "fal-ai/bytedance/seedance/v1/pro/text-to-video",
      options: {
        modelFieldName: "path",
        endpointPath: "fal-ai/bytedance/seedance/v1/pro/text-to-video",
        parameters: [
          {
            key: "prompt",
            type: "string",
            required: true,
            description: "Text prompt for video generation",
          },
          {
            key: "aspect_ratio",
            type: "string",
            defaultValue: "16:9",
            enum: ["16:9", "9:16", "1:1"],
            description: "Aspect ratio of the generated video",
          },
          {
            key: "resolution",
            type: "string",
            defaultValue: "1080p",
            enum: ["480p", "720p", "1080p"],
            description: "Video resolution",
          },
          {
            key: "duration",
            type: "string",
            defaultValue: "5",
            enum: ["3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
            description: "Duration of the video in seconds",
          },
          {
            key: "camera_fixed",
            type: "boolean",
            description: "Whether to fix the camera position",
          },
          {
            key: "seed",
            type: "integer",
            description:
              "Random seed to control video generation. Use -1 for random",
          },
          {
            key: "enable_safety_checker",
            type: "boolean",
            defaultValue: true,
            description: "If set to true, the safety checker will be enabled",
          },
        ],
      },
    }),
  ],
  "image-to-video": [
    createModelEntry({
      label: "FAL Seedance Pro Image to Video",
      provider: "fal",
      modality: "image-to-video",
      upstreamId: "fal-ai/bytedance/seedance/v1/pro/image-to-video",
      options: {
        modelFieldName: "path",
        endpointPath: "fal-ai/bytedance/seedance/v1/pro/image-to-video",
        parameters: [
          {
            key: "prompt",
            type: "string",
            required: true,
            description:
              "Text prompt for video generation based on the input image",
          },
          {
            key: "image_url",
            type: "string",
            required: true,
            description: "URL of the input image to animate",
          },
          {
            key: "aspect_ratio",
            type: "string",
            defaultValue: "16:9",
            enum: ["16:9", "9:16", "1:1"],
            description: "Aspect ratio of the generated video",
          },
          {
            key: "resolution",
            type: "string",
            defaultValue: "1080p",
            enum: ["480p", "720p", "1080p"],
            description: "Video resolution",
          },
          {
            key: "duration",
            type: "string",
            defaultValue: "5",
            enum: ["3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
            description: "Duration of the video in seconds",
          },
          {
            key: "camera_fixed",
            type: "boolean",
            description: "Whether to fix the camera position",
          },
          {
            key: "seed",
            type: "integer",
            description:
              "Random seed to control video generation. Use -1 for random",
          },
          {
            key: "enable_safety_checker",
            type: "boolean",
            defaultValue: true,
            description: "If set to true, the safety checker will be enabled",
          },
          {
            key: "keep_original_aspect_ratio",
            type: "boolean",
            description:
              "Whether to keep the original aspect ratio of the input image",
          },
        ],
      },
    }),
    createModelEntry({
      label: "FAL Wan 2.5 Image to Video",
      provider: "fal",
      modality: "image-to-video",
      upstreamId: "fal-ai/wan-25-preview/image-to-video",
      options: {
        modelFieldName: "path",
        endpointPath: "fal-ai/wan-25-preview/image-to-video",
        parameters: [
          {
            key: "prompt",
            type: "string",
            required: true,
            description:
              "The text prompt for video generation. Supports Chinese and English, max 800 characters",
          },
          {
            key: "image_url",
            type: "string",
            required: true,
            description:
              "URL of the input image to use as the first frame. Format: JPEG, JPG, PNG (no transparency), BMP, WEBP. Resolution: 360-2000 pixels. Max size: 10MB",
          },
          {
            key: "audio_url",
            type: "string",
            description:
              "URL of the audio to use as the background music. Must be publicly accessible",
          },
          {
            key: "aspect_ratio",
            type: "string",
            defaultValue: "16:9",
            enum: ["16:9", "9:16", "1:1"],
            description: "The aspect ratio of the generated video",
          },
          {
            key: "resolution",
            type: "string",
            defaultValue: "1080p",
            enum: ["480p", "720p", "1080p"],
            description: "Video resolution tier",
          },
          {
            key: "duration",
            type: "string",
            defaultValue: "5",
            enum: ["5", "10"],
            description:
              "Duration of the generated video in seconds. Choose between 5 or 10 seconds",
          },
          {
            key: "negative_prompt",
            type: "string",
            description:
              "Negative prompt to describe content to avoid. Max 500 characters",
          },
          {
            key: "enable_prompt_expansion",
            type: "boolean",
            defaultValue: true,
            description:
              "Whether to enable prompt rewriting using LLM. Improves results for short prompts but increases processing time",
          },
          {
            key: "seed",
            type: "integer",
            description:
              "Random seed for reproducibility. If None, a random seed is chosen",
          },
        ],
      },
    }),
  ],
};

export function findModelById(modelId: string): ModelCatalogEntry | undefined {
  return listAllModels().find((entry) => entry.id === modelId);
}

const MODALITY_TASK_MAP: Record<ModelModality, ModelTask> = {
  llm: "text",
  vlm: "text",
  "text-to-image": "image",
  "image-to-image": "image",
  "text-to-video": "video",
  "image-to-video": "video",
};

export function getModelTask(
  entryOrModality: ModelCatalogEntry | ModelModality
): ModelTask {
  const modality =
    typeof entryOrModality === "string"
      ? entryOrModality
      : entryOrModality.modality;
  return MODALITY_TASK_MAP[modality];
}

export function listAllModels(): ModelCatalogEntry[] {
  return Object.values(MODEL_CATALOG).flatMap((entries) => entries);
}

export function listModelsByModality(
  modality: ModelModality
): ModelCatalogEntry[] {
  return [...MODEL_CATALOG[modality]];
}

export function listModelsByTask(task: ModelTask): ModelCatalogEntry[] {
  return listAllModels().filter((entry) => getModelTask(entry) === task);
}

export function getModelParameters(
  modelId: string
): ModelParameterDefinition[] {
  return findModelById(modelId)?.options.parameters ?? [];
}

export function groupModelsByProvider(
  entries: ModelCatalogEntry[] = listAllModels()
): Record<string, ModelCatalogEntry[]> {
  return entries.reduce<Record<string, ModelCatalogEntry[]>>((acc, entry) => {
    if (!acc[entry.provider]) {
      acc[entry.provider] = [];
    }

    acc[entry.provider].push(entry);
    return acc;
  }, {});
}

export function groupModelsByProviderForModality(modality: ModelModality) {
  return groupModelsByProvider(listModelsByModality(modality));
}
