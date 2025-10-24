import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import useKeyPress from "../../../hooks/useKeyPress"; // 导入 useKeyPress hook
import useFsrsAlgorithm from "../../../hooks/useFsrsAlgorithm";
import { CardRating } from "@prisma/client";
import { SafeUserCardProgress } from "@/types/data";

const BASIC_RATING_OPTIONS = [
  "🤨 Again",
  "🤔 Hard",
  "😏 Good",
  "😄 Easy",
  "Skip",
] as const;

type BasicRatingOption = (typeof BASIC_RATING_OPTIONS)[number];

const KEYBOARD_SHORTCUTS: Record<"1" | "2" | "3" | "4", BasicRatingOption> = {
  "1": "🤨 Again",
  "2": "🤔 Hard",
  "3": "😏 Good",
  "4": "😄 Easy",
};

const isBasicRatingOption = (
  value: string | null
): value is BasicRatingOption =>
  typeof value === "string" &&
  BASIC_RATING_OPTIONS.includes(value as BasicRatingOption);

interface BasicQuizProps {
  activeOption: string | null;
  hoveredOption: string | null;
  sliderPosition: { left: number; width: number };
  handleOptionClick: (option: string, rating: CardRating) => void;
  handleMouseEnter: (option: string) => void;
  optionsRef: React.MutableRefObject<HTMLButtonElement[]>;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
  userCardProgress: SafeUserCardProgress;
}

export const BasicQuiz: React.FC<BasicQuizProps> = ({
  activeOption,
  hoveredOption,
  sliderPosition,
  handleOptionClick,
  handleMouseEnter,
  optionsRef,
  containerRef,
  userCardProgress,
}) => {
  const { calculateAndUpdateNextReviewDate } = useFsrsAlgorithm();
  const [startTime, setStartTime] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // 开始计时
    setStartTime(Date.now());
    return () => {
      // 清理计时器
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [userCardProgress.id]);

  const getElapsedTime = useCallback(() => {
    if (startTime === null) return 0;
    return (Date.now() - startTime) / 1000; // 转换为秒
  }, [startTime]);

  const getBackgroundColor = (option: BasicRatingOption) => {
    switch (option) {
      case "🤨 Again":
        return "#EF4444";
      case "🤔 Hard":
        return "#F7C21B";
      case "😏 Good":
        return "#3C82F6";
      case "😄 Easy":
        return "#22C55D";
      case "Skip":
        return "#F7F8FA";
    }
  };

  const getTextColor = (
    option: BasicRatingOption,
    isActive: boolean,
    isHovered: boolean
  ) => {
    if (option === "Skip") {
      return "#797979";
    }
    if (isActive || isHovered) {
      return "white";
    }
    return "inherit";
  };

  const handleOptionSelection = useCallback(
    async (option: BasicRatingOption) => {
      let rating: CardRating;
      switch (option) {
        case "🤨 Again":
          rating = CardRating.Again;
          break;
        case "🤔 Hard":
          rating = CardRating.Hard;
          break;
        case "😏 Good":
          rating = CardRating.Good;
          break;
        case "😄 Easy":
          rating = CardRating.Easy;
          break;
        default:
          rating = CardRating.Good;
      }

      const elapsedTime = getElapsedTime();

      try {
        const result = await calculateAndUpdateNextReviewDate(
          userCardProgress,
          rating,
          elapsedTime
        );
        console.log("FSRS 结果：", result);

        handleOptionClick(option, rating);
      } catch (error) {
        console.error("更新用户卡片进度时出错:", error);
      }
    },
    [
      calculateAndUpdateNextReviewDate,
      userCardProgress,
      handleOptionClick,
      getElapsedTime,
    ]
  );

  // 添加键盘快捷键处理
  useKeyPress({
    keys: ["1", "2", "3", "4"],
    onKeyPress: (event) => {
      const option =
        KEYBOARD_SHORTCUTS[event.key as keyof typeof KEYBOARD_SHORTCUTS];
      if (option !== undefined) {
        handleOptionSelection(option);
      }
    },
    isActive: true,
  });

  const activeRatingOption = isBasicRatingOption(activeOption)
    ? activeOption
    : null;
  const hoveredRatingOption = isBasicRatingOption(hoveredOption)
    ? hoveredOption
    : null;

  return (
    <div ref={containerRef} className="basic-quiz-container">
      <motion.div
        className="slider"
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{
          left: sliderPosition.left,
          width: sliderPosition.width,
          opacity: hoveredRatingOption ? 1 : 0,
          scale: hoveredRatingOption ? 1 : 0.95,
        }}
        transition={{
          type: "tween",
          ease: "easeInOut",
          duration: 0.15,
        }}
        style={{
          backgroundColor: hoveredRatingOption
            ? getBackgroundColor(hoveredRatingOption)
            : "transparent",
          color: hoveredRatingOption
            ? getTextColor(hoveredRatingOption, false, true)
            : "inherit",
        }}
      />
      {BASIC_RATING_OPTIONS.map((option, index) => (
        <motion.button
          key={option}
          ref={(el) => {
            if (el) optionsRef.current[index] = el;
          }}
          data-value={option}
          onClick={() => handleOptionSelection(option)}
          onMouseEnter={() => handleMouseEnter(option)}
          whileTap={{ scale: 0.95 }}
          className={`option-button ${
            activeRatingOption === option ? "active" : ""
          } ${hoveredRatingOption === option ? "hovered" : ""}`}
          style={{
            backgroundColor:
              activeRatingOption === option
                ? getBackgroundColor(option)
                : "transparent",
            color: getTextColor(
              option,
              activeRatingOption === option,
              hoveredRatingOption === option
            ),
          }}
        >
          {option}
        </motion.button>
      ))}
    </div>
  );
};

export default BasicQuiz;
