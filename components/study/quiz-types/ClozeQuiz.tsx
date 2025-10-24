import { FormEvent } from "react"
import type { SafeUserCardProgress } from "@/types/data"
import { CardRating } from "@prisma/client"

interface ClozeQuizProps {
  inputValue: string
  setInputValue: (value: string) => void
  handleSubmit: (value: string, rating: CardRating) => void
  cardProgress?: SafeUserCardProgress | null
}

const ClozeQuiz = ({ inputValue, setInputValue, handleSubmit }: ClozeQuizProps) => {
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    handleSubmit(inputValue, CardRating.Good)
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-xl flex-col items-stretch gap-3 rounded-xl border border-dashed border-border/60 bg-card/60 p-4"
    >
      <textarea
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        placeholder="输入你的答案…"
        className="h-24 resize-none rounded-md border border-border/60 bg-background/80 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex items-center justify-end gap-2">
        <button
          type="submit"
          className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          提交
        </button>
      </div>
    </form>
  )
}

export default ClozeQuiz
