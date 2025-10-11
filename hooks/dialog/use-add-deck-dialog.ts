"use client"

import { create } from "zustand"

type AddDeckDialogState = {
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  onToggle: () => void
}

const useAddDeckDialog = create<AddDeckDialogState>((set, get) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
  onToggle: () => (get().isOpen ? set({ isOpen: false }) : set({ isOpen: true })),
}))

export default useAddDeckDialog
