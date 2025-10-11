"use client"

import { create } from "zustand"

type RegisterDialogState = {
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
}

const useRegisterDialog = create<RegisterDialogState>((set) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
}))

export default useRegisterDialog

