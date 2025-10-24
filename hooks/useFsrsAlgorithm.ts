import { useCallback } from "react"

import { CardRating, LearningStatus } from "@prisma/client"
import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  type Card,
  type FSRSParameters,
} from "ts-fsrs"
import { formatISO } from "date-fns"

import type { SafeReviewRecord, SafeUserCardProgress } from "@/types/data"
import useSyncOperations from "@/hooks/use-sync-operations"
import { useAppDispatch } from "@/redux/hooks"
import { upsertUserCardProgress } from "@/redux/slices/userCardProgressSlice"

const params: FSRSParameters = generatorParameters({
  request_retention: 0.9,
  maximum_interval: 36500,
  w: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61],
})

const f = fsrs(params)

const ratingToFsrsRating: Partial<Record<CardRating, Rating>> = {
  [CardRating.Again]: Rating.Again,
  [CardRating.Hard]: Rating.Hard,
  [CardRating.Good]: Rating.Good,
  [CardRating.Easy]: Rating.Easy,
}

const useFsrsAlgorithm = () => {
  const dispatch = useAppDispatch()
  const { enqueueProgressUpdate } = useSyncOperations()

  const calculateAndUpdateNextReviewDate = useCallback(
    async (
      userCardProgress: SafeUserCardProgress,
      rating: CardRating,
      elapsedTime: number,
    ): Promise<{
      nextReviewDate: string | null
      state: LearningStatus
      updatedProgress: SafeUserCardProgress
      reviewLog: unknown
      durationSpent: number
    }> => {
      const fsrsRating = ratingToFsrsRating[rating]

      if (!fsrsRating) {
        return {
          nextReviewDate: userCardProgress.nextReviewDate ?? null,
          state: userCardProgress.learningStatus,
          updatedProgress: userCardProgress,
          reviewLog: null,
          durationSpent: elapsedTime,
        }
      }

      const card: Card = createEmptyCard()
      card.stability = userCardProgress.stability
      card.difficulty = userCardProgress.difficulty
      card.elapsed_days = userCardProgress.elapsedDays
      card.scheduled_days = userCardProgress.scheduledDays
      card.reps = userCardProgress.reps
      card.lapses = userCardProgress.lapses

      const now = new Date()
      const schedulingResult = f.repeat(card, now)
      const outcome = schedulingResult[fsrsRating]

      const updatedCard = outcome.card
      const dueISOString = formatISO(updatedCard.due)
      const stateString = updatedCard.state as unknown as LearningStatus

      const reviewRecord: SafeReviewRecord = {
        updatedAt: new Date().toISOString(),
        rating,
        answer: "",
        durationSpent: elapsedTime,
      }

      const updatedProgress: SafeUserCardProgress = {
        ...userCardProgress,
        nextReviewDate: dueISOString,
        stability: updatedCard.stability,
        difficulty: updatedCard.difficulty,
        elapsedDays: updatedCard.elapsed_days,
        scheduledDays: updatedCard.scheduled_days,
        reps: updatedCard.reps,
        lapses: updatedCard.lapses,
        learningStatus: stateString,
        totalStudyTime: userCardProgress.totalStudyTime + elapsedTime,
        reviewRecords: [...(userCardProgress.reviewRecords ?? []), reviewRecord],
        lastModifiedAt: new Date().toISOString(),
      }

      await enqueueProgressUpdate(updatedProgress)
      dispatch(upsertUserCardProgress(updatedProgress))

      return {
        nextReviewDate: dueISOString,
        state: stateString,
        updatedProgress,
        reviewLog: outcome.log,
        durationSpent: elapsedTime,
      }
    },
    [dispatch, enqueueProgressUpdate],
  )

  return { calculateAndUpdateNextReviewDate }
}

export default useFsrsAlgorithm
