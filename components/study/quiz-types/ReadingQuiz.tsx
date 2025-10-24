import type { SafeUserCardProgress } from "@/types/data"
import { CardRating } from "@prisma/client"

interface ReadingQuizProps {
  isRecording: boolean
  startVoiceRecording: () => void
  stopVoiceRecording: () => void
  cardProgress?: SafeUserCardProgress | null
  onComplete: (rating: CardRating) => void
}

const ReadingQuiz = ({ isRecording, startVoiceRecording, stopVoiceRecording, onComplete }: ReadingQuizProps) => {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border/60 bg-card/60 p-6 text-sm">
      <button
        type="button"
        className="rounded-full border border-border/80 px-4 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
        onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
      >
        {isRecording ? "停止录音" : "开始朗读"}
      </button>
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

export default ReadingQuiz
