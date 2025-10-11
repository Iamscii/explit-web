"use client"

import { create } from "zustand"

type LoginDialogState = {
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
}

const useLoginDialog = create<LoginDialogState>((set) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
}))

export default useLoginDialog

