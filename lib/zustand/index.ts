"use client"

import { useDebugValue, useSyncExternalStore } from "react"

type SetState<T> = (
  partial: Partial<T> | ((state: T) => Partial<T> | void),
) => void

type GetState<T> = () => T

type StateCreator<T> = (set: SetState<T>, get: GetState<T>) => T

export function create<T>(initializer: StateCreator<T>) {
  let state: T
  const listeners = new Set<() => void>()

  const setState: SetState<T> = (partial) => {
    const partialState =
      typeof partial === "function" ? partial(state) : partial

    if (partialState && Object.keys(partialState).length > 0) {
      state = { ...state, ...partialState }
      listeners.forEach((listener) => listener())
    }
  }

  const getState: GetState<T> = () => state

  state = initializer(setState, getState)

  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  const destroy = () => {
    listeners.clear()
  }

  function useStore<U>(selector: (state: T) => U = (state) => state as unknown as U) {
    const selectedState = useSyncExternalStore(
      subscribe,
      () => selector(state),
      () => selector(state),
    )

    useDebugValue(selectedState)

    return selectedState
  }

  useStore.getState = getState
  useStore.setState = setState
  useStore.subscribe = subscribe
  useStore.destroy = destroy

  return useStore as typeof useStore & {
    getState: GetState<T>
    setState: SetState<T>
    subscribe: (listener: () => void) => () => void
    destroy: () => void
  }
}
