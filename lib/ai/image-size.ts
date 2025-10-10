export interface ImageSizePreset {
  /**
   * Stable identifier used in forms and overrides (e.g. "16:9").
   */
  id: string;
  /**
   * Human-readable label shown to users.
   */
  label: string;
  /**
   * Ratio tuple expressed as [width, height].
   */
  ratio: [number, number];
  /**
   * Optional legacy aliases that should resolve to the preset.
   */
  aliases?: string[];
  /**
   * Optional hint shown alongside the label.
   */
  description?: string;
}

export interface ImageSizeConstraints {
  /**
   * Maximum size the provider accepts for either dimension.
   */
  max: number;
  /**
   * Optional minimum size (defaults to 0 when omitted).
   */
  min?: number;
  /**
   * Optional requirement for dimensions to be multiples of a specific value.
   * Defaults to 8 to satisfy most diffusion/image backends.
   */
  multiple?: number;
}

export interface ImageSizeConfig {
  presets: ImageSizePreset[];
  constraints: ImageSizeConstraints;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

const DEFAULT_MULTIPLE = 8;

function roundToMultiple(value: number, multiple: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("Cannot round a non-finite value");
  }
  const base = Math.max(1, Math.round(value));
  const safeMultiple = multiple > 0 ? multiple : DEFAULT_MULTIPLE;
  return Math.max(
    safeMultiple,
    Math.round(base / safeMultiple) * safeMultiple,
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function computeImageDimensions(
  ratio: [number, number],
  constraints: ImageSizeConstraints,
): ImageDimensions {
  const [wRatio, hRatio] = ratio;

  if (wRatio <= 0 || hRatio <= 0) {
    throw new Error("Image ratio segments must be positive numbers");
  }

  const multiple = constraints.multiple ?? DEFAULT_MULTIPLE;
  const min = constraints.min ?? multiple;
  const { max } = constraints;

  const majorRatio = Math.max(wRatio, hRatio);
  const minorRatio = Math.min(wRatio, hRatio);

  // First attempt: scale so that the larger dimension hits the max constraint.
  const maxScale = max / majorRatio;
  let candidateWidth = wRatio * maxScale;
  let candidateHeight = hRatio * maxScale;

  candidateWidth = clamp(
    roundToMultiple(candidateWidth, multiple),
    min,
    max,
  );
  candidateHeight = clamp(
    roundToMultiple(candidateHeight, multiple),
    min,
    max,
  );

  const respectsMin = candidateWidth >= min && candidateHeight >= min;

  if (respectsMin) {
    return { width: candidateWidth, height: candidateHeight };
  }

  // Second attempt: scale so that the smaller dimension reaches the minimum.
  const minScale = min / minorRatio;
  let minWidth = wRatio * minScale;
  let minHeight = hRatio * minScale;

  minWidth = clamp(roundToMultiple(minWidth, multiple), min, max);
  minHeight = clamp(roundToMultiple(minHeight, multiple), min, max);

  return { width: minWidth, height: minHeight };
}

function normaliseRatioString(value: string) {
  return value.trim().toLowerCase();
}

export function parseAspectRatio(value: string): [number, number] | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }

  const left = Number(match[1]);
  const right = Number(match[2]);

  if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0) {
    return null;
  }

  // Normalise to integers.
  const precision = 1000;
  const leftInt = Math.round(left * precision);
  const rightInt = Math.round(right * precision);

  const divisor = gcd(leftInt, rightInt);

  return [leftInt / divisor, rightInt / divisor];
}

export function findImageSizePreset(
  config: ImageSizeConfig,
  value: string,
): ImageSizePreset | null {
  const search = normaliseRatioString(value);

  for (const preset of config.presets) {
    if (normaliseRatioString(preset.id) === search) {
      return preset;
    }
    if (normaliseRatioString(preset.label) === search) {
      return preset;
    }
    if (preset.aliases?.some((alias) => normaliseRatioString(alias) === search)) {
      return preset;
    }
  }

  return null;
}

export function resolveImageSizeValue(
  value: unknown,
  config: ImageSizeConfig,
): ImageDimensions | null {
  if (isImageDimensions(value)) {
    return sanitiseDimensions(value, config.constraints);
  }

  if (typeof value === "string") {
    const preset = findImageSizePreset(config, value);
    if (preset) {
      return computeImageDimensions(preset.ratio, config.constraints);
    }

    const ratio = parseAspectRatio(value);
    if (ratio) {
      return computeImageDimensions(ratio, config.constraints);
    }
  }

  return null;
}

export function sanitiseDimensions(
  raw: ImageDimensions,
  constraints: ImageSizeConstraints,
): ImageDimensions {
  const multiple = constraints.multiple ?? DEFAULT_MULTIPLE;
  const min = constraints.min ?? multiple;

  const width = clamp(
    roundToMultiple(raw.width, multiple),
    min,
    constraints.max,
  );
  const height = clamp(
    roundToMultiple(raw.height, multiple),
    min,
    constraints.max,
  );

  return { width, height };
}

export function isImageDimensions(value: unknown): value is ImageDimensions {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.width === "number" &&
    Number.isFinite(record.width) &&
    typeof record.height === "number" &&
    Number.isFinite(record.height)
  );
}

export function describePresetDimensions(
  preset: ImageSizePreset,
  config: ImageSizeConfig,
): ImageDimensions {
  return computeImageDimensions(preset.ratio, config.constraints);
}

export function formatPresetLabel(
  preset: ImageSizePreset,
  config: ImageSizeConfig,
): string {
  const { width, height } = describePresetDimensions(preset, config);
  return `${preset.label} (${width}×${height})`;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const remainder = x % y;
    x = y;
    y = remainder;
  }
  return x || 1;
}
