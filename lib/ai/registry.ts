import { falAdapters } from "./fal"
import { openRouterAdapters } from "./openrouter"
import type { AnyModelAdapter, ModelTask } from "./types"

const adapters: AnyModelAdapter[] = [...openRouterAdapters, ...falAdapters]

const adapterMap = new Map<string, AnyModelAdapter>(adapters.map((adapter) => [adapter.id, adapter]))

export function listAdapters(task?: ModelTask): AnyModelAdapter[] {
  if (!task) {
    return [...adapters]
  }

  return adapters.filter((adapter) => adapter.task === task)
}

export function getAdapter(modelId: string): AnyModelAdapter {
  const adapter = adapterMap.get(modelId)

  if (!adapter) {
    throw new Error(`Unknown model identifier: ${modelId}`)
  }

  return adapter
}

