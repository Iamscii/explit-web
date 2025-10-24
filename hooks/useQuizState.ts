import { CardRating } from "@prisma/client";
import { useState, useEffect, useRef } from "react";

export const useQuizState = (onComplete: (rating: CardRating) => void) => {
  const [activeOption, setActiveOption] = useState<string | null>(null);
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);
  const [sliderPosition, setSliderPosition] = useState({ left: 0, width: 0 });
  const [inputValue, setInputValue] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const optionsRef = useRef<HTMLButtonElement[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (hoveredOption !== null && containerRef.current) {
      const activeOptionRef = optionsRef.current.find(
        (ref) => ref && ref.dataset.value === hoveredOption
      );
      if (activeOptionRef) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const buttonRect = activeOptionRef.getBoundingClientRect();

        setSliderPosition({
          left: buttonRect.left - containerRect.left,
          width: buttonRect.width,
        });
      }
    }
  }, [hoveredOption]);

  const handleOptionClick = (option: string, rating: CardRating) => {
    setActiveOption(option);
    onComplete(rating);
  };

  const handleMouseEnter = (option: string) => {
    setHoveredOption(option);
  };

  const handleMouseLeave = () => {
    setHoveredOption(null);
  };

  const handleSubmit = (value: string, rating: CardRating) => {
    console.log("Submitted:", value);
    onComplete(rating);
  };

  const startVoiceRecording = () => {
    setIsRecording(true);
    // 添加开始录音的逻辑
  };

  const stopVoiceRecording = () => {
    setIsRecording(false);
    // 添加停止录音的逻辑
    onComplete(CardRating.Good); // 默认为 Good，您可以根据需要调整
  };

  return {
    activeOption,
    hoveredOption,
    sliderPosition,
    inputValue,
    showAnswer,
    isRecording,
    optionsRef,
    containerRef,
    handleOptionClick,
    handleMouseEnter,
    handleMouseLeave,
    handleSubmit,
    setInputValue,
    setShowAnswer,
    startVoiceRecording,
    stopVoiceRecording,
  };
};
