import type { ProxyType } from "@frp-manager/shared"
import { cn } from "@/lib/utils"

const styles: Record<ProxyType, string> = {
  tcp: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  http: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  https: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
}

export function ProxyTypeBadge({ type }: { type: ProxyType }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold font-mono uppercase tracking-wider",
        styles[type],
      )}
    >
      {type}
    </span>
  )
}
