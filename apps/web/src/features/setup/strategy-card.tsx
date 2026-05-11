import { Check } from "lucide-react"
import type { ReloadStrategyType } from "@frp-manager/shared"
import { cn } from "@/lib/utils"

interface StrategyCardProps {
  type: ReloadStrategyType
  title: string
  description: string
  icon: React.ReactNode
  recommended?: boolean
  selected: boolean
  onClick: () => void
}

export function StrategyCard({
  title,
  description,
  icon,
  recommended,
  selected,
  onClick,
}: StrategyCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative text-left p-4 rounded-xl transition-all ring-1",
        selected
          ? "bg-gradient-to-br from-primary/10 to-primary/5 ring-primary/40 shadow-sm"
          : "bg-card/60 ring-border/40 hover:ring-border hover:bg-card",
      )}
    >
      {selected && (
        <span className="absolute top-3 right-3 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
          <Check className="h-3 w-3" />
        </span>
      )}
      {recommended && !selected && (
        <span className="absolute top-3 right-3 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
          推荐
        </span>
      )}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
            selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold">{title}</h4>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
        </div>
      </div>
    </button>
  )
}
