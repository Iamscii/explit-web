"use client"

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"
import { CardRating } from "@prisma/client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { SafeUserCardProgress } from "@/types/data"

interface SpellingQuizProps {
  showAnswer: boolean
  setShowAnswer: (show: boolean) => void
  answer?: string
  cardProgress?: SafeUserCardProgress | null
  onComplete: (rating: CardRating) => void
}

type LetterState = "pending" | "incorrect" | "correct" | "space"

const normalizeForComparison = (value: string) =>
  value
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase()

const SpellingQuiz = ({
  showAnswer,
  setShowAnswer,
  answer,
  cardProgress,
  onComplete,
}: SpellingQuizProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [inputValue, setInputValue] = useState("")
  const [hasCompleted, setHasCompleted] = useState(false)
  const [hasShownAnswer, setHasShownAnswer] = useState(false)
  const inputId = useId()

  const { targetWord, hints } = useMemo(() => {
    if (!answer) {
      return { targetWord: "", hints: [] as string[] }
    }
    const segments = answer
      .split("/")
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0)

    if (segments.length === 0) {
      return { targetWord: "", hints: [] as string[] }
    }

    return {
      targetWord: segments[0],
      hints: segments.slice(1),
    }
  }, [answer])

  const normalizedTarget = useMemo(
    () => targetWord.normalize("NFC"),
    [targetWord],
  )
  const normalizedInput = useMemo(
    () => inputValue.normalize("NFC"),
    [inputValue],
  )

  const targetLetters = useMemo(
    () => Array.from(normalizedTarget),
    [normalizedTarget],
  )
  const inputLetters = useMemo(
    () => Array.from(normalizedInput),
    [normalizedInput],
  )

  const comparableTarget = useMemo(
    () => normalizeForComparison(targetWord),
    [targetWord],
  )
  const comparableInput = useMemo(
    () => normalizeForComparison(inputValue),
    [inputValue],
  )

  const isAnswerReady = comparableTarget.length > 0
  const isInputComplete =
    comparableInput.length > 0 &&
    comparableInput.length === comparableTarget.length
  const isCorrect = isAnswerReady && comparableInput === comparableTarget

  useEffect(() => {
    setInputValue("")
    setHasCompleted(false)
    setHasShownAnswer(false)
  }, [cardProgress?.id, comparableTarget])

  useEffect(() => {
    if (showAnswer) {
      setHasShownAnswer(true)
      setInputValue(targetWord)
    }
  }, [showAnswer, targetWord])

  useEffect(() => {
    if (!showAnswer && !hasShownAnswer && isCorrect && !hasCompleted) {
      setHasCompleted(true)
      onComplete(CardRating.Good)
    }
  }, [hasCompleted, hasShownAnswer, isCorrect, onComplete, showAnswer])

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setInputValue(event.target.value)
      setHasCompleted(false)
    },
    [],
  )

  const handleToggleAnswer = useCallback(() => {
    setShowAnswer(!showAnswer)
  }, [setShowAnswer, showAnswer])

  const handleReset = useCallback(() => {
    setShowAnswer(false)
    setInputValue("")
    setHasCompleted(false)
    setHasShownAnswer(false)
    inputRef.current?.focus()
  }, [setShowAnswer])

  const handleMarkAgain = useCallback(() => {
    if (!hasCompleted) {
      setHasCompleted(true)
    }
    onComplete(CardRating.Again)
  }, [hasCompleted, onComplete])

  const letterStates = useMemo(
    () =>
      targetLetters.map<LetterState>((letter, index) => {
        if (letter.trim().length === 0) {
          return "space"
        }
        const typed = inputLetters[index]
        if (!typed) {
          return showAnswer ? "correct" : "pending"
        }
        return typed.localeCompare(letter, undefined, {
          sensitivity: "accent",
          usage: "search",
        }) === 0
          ? "correct"
          : "incorrect"
      }),
    [inputLetters, targetLetters, showAnswer],
  )

  if (!isAnswerReady) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 bg-card/60 p-6 text-sm">
        <p className="text-center text-muted-foreground">
          当前卡片没有提供拼写答案，先切换到下一张吧。
        </p>
        <Button size="sm" variant="outline" onClick={handleMarkAgain}>
          跳过此卡片
        </Button>
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-xl flex-col items-stretch gap-4 rounded-xl border border-dashed border-border/60 bg-card/60 p-6 text-sm">
      <div className="flex flex-col items-center gap-3">
        <label
          htmlFor={inputId}
          className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
        >
          拼写回答
        </label>
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          autoComplete="off"
          spellCheck="false"
          value={inputValue}
          onChange={handleInputChange}
          className={cn(
            "w-full max-w-sm rounded-full border border-border/70 bg-background/90 px-5 py-2 text-center text-base font-semibold uppercase tracking-wider transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40",
            showAnswer && "border-primary/40 text-primary-foreground",
          )}
          placeholder="请输入答案"
        />
        <p className="text-[11px] text-muted-foreground">
          正确拼写后会自动进入下一张卡片。
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {letterStates.map((state, index) => {
          const expected = targetLetters[index] ?? ""
          const typed = inputLetters[index] ?? ""
          const isSpace = state === "space"
          const displayValue =
            showAnswer || state === "correct" ? expected : typed || " "

          return (
            <span
              key={`letter-${index}-${expected}`}
              className={cn(
                "flex h-12 min-w-[2.5rem] items-center justify-center rounded-xl border px-2 text-lg font-semibold uppercase transition-colors",
                isSpace && "h-12 min-w-[1rem] border-transparent bg-transparent",
                state === "pending" &&
                  "border-border/60 bg-muted/40 text-muted-foreground",
                state === "incorrect" &&
                  "border-destructive/40 bg-destructive/10 text-destructive",
                state === "correct" &&
                  "border-emerald-500/50 bg-emerald-500/90 text-white shadow-sm",
              )}
            >
              {isSpace ? "" : displayValue}
            </span>
          )
        })}
      </div>

      {hints.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-background/80 px-4 py-3 text-center text-sm text-muted-foreground">
          {hints.join(" / ")}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggleAnswer}
          className="rounded-full px-4 py-1.5"
        >
          {showAnswer ? "隐藏答案" : "显示答案"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          disabled={!inputValue.length && !showAnswer && !hasShownAnswer}
          className="rounded-full px-4 py-1.5"
        >
          重置输入
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleMarkAgain}
          className="rounded-full px-4 py-1.5"
        >
          标记再练
        </Button>
      </div>

      {!isCorrect && isInputComplete && !showAnswer && !hasShownAnswer && (
        <p className="text-center text-xs text-destructive">
          拼写还不正确，检查一下字母或空格吧。
        </p>
      )}
      {hasShownAnswer && !isCorrect && (
        <p className="text-center text-[11px] text-muted-foreground">
          已显示答案，可在确认会拼写后再次练习。
        </p>
      )}
    </div>
  )
}

export default SpellingQuiz
