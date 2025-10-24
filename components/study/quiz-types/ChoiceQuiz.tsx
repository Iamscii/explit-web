import type { SafeUserCardProgress } from "@/types/data"
import { CardRating } from "@prisma/client"

interface ChoiceQuizProps {
  cardProgress?: SafeUserCardProgress | null
  onComplete: (rating: CardRating) => void
}

const ChoiceQuiz = ({ onComplete }: ChoiceQuizProps) => {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border/60 bg-card/60 p-6 text-sm">
      <p className="text-muted-foreground">选择题互动暂未实现，先标记为已掌握吧。</p>
      <button
        type="button"
        className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        onClick={() => onComplete(CardRating.Good)}
      >
        标记完成
      </button>
    </div>
  )
}

export default ChoiceQuiz
