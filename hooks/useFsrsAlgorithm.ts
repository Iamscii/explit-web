import { useCallback } from "react";

import { CardRating, LearningStatus } from "@prisma/client";
import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  Card,
  FSRSParameters,
} from "ts-fsrs";

import { format } from "date-fns";
import { SafeUserCardProgress } from "@/types/data";

// Initialize FSRS with custom parameters
const params: FSRSParameters = generatorParameters({
  request_retention: 0.9,
  maximum_interval: 36500,
  w: [
    0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05,
    0.34, 1.26, 0.29, 2.61,
  ],
});
const f = fsrs(params);

const useFsrsAlgorithm = () => {
  const { updateUserCardProgress, addReviewRecord } =
    userCardProgressServices();

  // 添加一个辅助函数来转换 Rating 到 CardRating
  const convertRatingToCardRating = (rating: Rating): CardRating => {
    switch (rating) {
      case Rating.Again:
        return CardRating.Again;
      case Rating.Hard:
        return CardRating.Hard;
      case Rating.Good:
        return CardRating.Good;
      case Rating.Easy:
        return CardRating.Easy;
      default:
        return CardRating.Manual; // 或者根据你的需求设置一个默认值
    }
  };

  const calculateAndUpdateNextReviewDate = useCallback(
    async (
      userCardProgress: SafeUserCardProgress,
      reviewOutcome: keyof typeof Rating,
      elapsedTime: number
    ): Promise<{
      nextReviewDate: string;
      state: LearningStatus;
      reviewLog: any;
      cardDetails: {
        stability: number;
        difficulty: number;
        elapsedDays: number;
        scheduledDays: number;
        reps: number;
        lapses: number;
      };
      durationSpent: number;
    }> => {
      console.log("cardProgress123", userCardProgress);
      // Create a new card and set its attributes
      let card: Card = createEmptyCard();
      card.stability = userCardProgress.stability;
      card.difficulty = userCardProgress.difficulty;
      card.elapsed_days = userCardProgress.elapsedDays;
      card.scheduled_days = userCardProgress.scheduledDays;
      card.reps = userCardProgress.reps;
      card.lapses = userCardProgress.lapses;

      console.log("card before update", card);

      // Update card based on the review outcome
      const outcome = Rating[reviewOutcome as keyof typeof Rating];
      const now = new Date();
      const schedulingResult = f.repeat(card, now);
      console.log("schedulingResult", schedulingResult);
      const updatedCard =
        schedulingResult[outcome as keyof typeof schedulingResult].card;
      const nextReviewDate = updatedCard.due;
      // 使用 date-fns 格式化日期
      const dueISOString = format(
        nextReviewDate,
        "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"
      );

      // Get the state string
      const stateString: LearningStatus =
        updatedCard.state as unknown as LearningStatus;

      // Get review log
      const reviewLog =
        schedulingResult[outcome as keyof typeof schedulingResult].log;

      // Extract card details
      const cardDetails = {
        stability: updatedCard.stability,
        difficulty: updatedCard.difficulty,
        elapsedDays: updatedCard.elapsed_days,
        scheduledDays: updatedCard.scheduled_days,
        reps: updatedCard.reps,
        lapses: updatedCard.lapses,
      };

      // Update database's userCardProgress
      try {
        await updateUserCardProgress(userCardProgress.id, {
          nextReviewDate: dueISOString,
          learningStatus: stateString,
          ...cardDetails,
        });

        // 使用转换函数来获取正确的 CardRating
        const cardRating = convertRatingToCardRating(
          Rating[reviewOutcome as keyof typeof Rating]
        );

        // 添加复习记录
        await addReviewRecord(
          userCardProgress.id,
          cardRating,
          "", // 这里可以添加用户的答案，如果有的话
          elapsedTime
        );

        console.log("用户卡片进度和复习记录已成功更新");
      } catch (error) {
        console.error("更新用户卡片进度或添加复习记录时出错:", error);
      }

      return {
        nextReviewDate: dueISOString,
        state: stateString,
        reviewLog,
        cardDetails,
        durationSpent: elapsedTime,
      };
    },
    [updateUserCardProgress, addReviewRecord]
  );

  return { calculateAndUpdateNextReviewDate };
};

export default useFsrsAlgorithm;
