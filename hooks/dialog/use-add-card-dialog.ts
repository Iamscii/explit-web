"use client"

import { create } from "zustand"

type AddCardDialogState = {
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  onToggle: () => void
}

const useAddCardDialog = create<AddCardDialogState>((set, get) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
  onToggle: () => (get().isOpen ? set({ isOpen: false }) : set({ isOpen: true })),
}))

export default useAddCardDialog
