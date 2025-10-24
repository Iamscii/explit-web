import type { SafeUserCardProgress } from "@/types/data"
import { TemplateType, CardRating } from "@prisma/client"

import { useQuizState } from "@/hooks/useQuizState"
import BasicQuiz from "./quiz-types/BasicQuiz"
import ChoiceQuiz from "./quiz-types/ChoiceQuiz"
import ClozeQuiz from "./quiz-types/ClozeQuiz"
import SpellingQuiz from "./quiz-types/SpellingQuiz"
import ReadingQuiz from "./quiz-types/ReadingQuiz"

interface QuizComponentProps {
  type: TemplateType
  onComplete: (rating: CardRating) => void
  cardData: {
    userCardProgress?: SafeUserCardProgress | null
    answer?: string
  }
}

const QuizComponent = ({ type, onComplete, cardData }: QuizComponentProps) => {
  const {
    activeOption,
    hoveredOption,
    sliderPosition,
    inputValue,
    showAnswer,
    isRecording,
    handleOptionClick,
    handleMouseEnter,
    handleMouseLeave,
    handleSubmit,
    setInputValue,
    setShowAnswer,
    startVoiceRecording,
    stopVoiceRecording,
    optionsRef,
    containerRef,
  } = useQuizState(onComplete)

  const progress = cardData.userCardProgress ?? null

  const renderComponent = () => {
    switch (type) {
      case TemplateType.CHOICE:
        return <ChoiceQuiz onComplete={onComplete} cardProgress={progress} />
      case TemplateType.BASIC:
        return progress ? (
          <BasicQuiz
            activeOption={activeOption}
            hoveredOption={hoveredOption}
            sliderPosition={sliderPosition}
            handleOptionClick={handleOptionClick}
            handleMouseEnter={handleMouseEnter}
            optionsRef={optionsRef}
            containerRef={containerRef}
            userCardProgress={progress}
          />
        ) : null
      case TemplateType.CLOZE:
        return (
          <ClozeQuiz
            inputValue={inputValue}
            setInputValue={setInputValue}
            handleSubmit={handleSubmit}
            cardProgress={progress}
          />
        )
      case TemplateType.SPELLING:
        return (
          <SpellingQuiz
            showAnswer={showAnswer}
            setShowAnswer={setShowAnswer}
            answer={cardData.answer}
            cardProgress={progress}
            onComplete={onComplete}
          />
        )
      case TemplateType.READING:
        return (
          <ReadingQuiz
            isRecording={isRecording}
            startVoiceRecording={startVoiceRecording}
            stopVoiceRecording={stopVoiceRecording}
            cardProgress={progress}
            onComplete={onComplete}
          />
        )
      default:
        return null
    }
  }

  return (
    <div
      className="w-full"
      onMouseLeave={type === TemplateType.BASIC ? handleMouseLeave : undefined}
    >
      {renderComponent()}
    </div>
  )
}

export default QuizComponent
