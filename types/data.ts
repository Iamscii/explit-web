import type { Card, Deck, ReviewRecord, UserCardProgress } from "@prisma/client"

export type SafeDeck = Omit<
  Deck,
  "createdAt" | "deletedAt" | "lastAccessedAt" | "lastModifiedAt" | "parentId"
> & {
  createdAt: string
  deletedAt: string | null
  lastAccessedAt: string | null
  lastModifiedAt: string
  parentId: string | null
  cardCount?: number
  children?: SafeDeck[]
}

export type SafeCard = Omit<
  Card,
  "createdAt" | "deletedAt" | "lastAccessedAt" | "lastModifiedAt" | "fieldValues"
> & {
  createdAt: string
  deletedAt: string | null
  lastAccessedAt: string | null
  lastModifiedAt: string
  fieldValues: Array<unknown>
}

export type SafeReviewRecord = Omit<ReviewRecord, "updatedAt"> & {
  updatedAt: string
}

export type SafeUserCardProgress = Omit<
  UserCardProgress,
  "lastModifiedAt" | "nextReviewDate" | "reviewRecords"
> & {
  lastModifiedAt: string
  nextReviewDate: string | null
  reviewRecords: Array<SafeReviewRecord>
}
