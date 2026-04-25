import { Badge } from "@/components/ui/badge"
import type { StatusTone } from "@/lib/types"
import { cn } from "@/lib/utils"

type StatusBadgeProps = {
  label: string
  tone?: StatusTone
  className?: string
}

const toneClassName: Record<StatusTone, string> = {
  default: "border-[#334155] bg-[#172033] text-[#CBD5E1]",
  success: "border-[#10B981]/25 bg-[#10B981]/12 text-[#6EE7B7]",
  warning: "border-[#F59E0B]/25 bg-[#F59E0B]/12 text-[#FCD34D]",
  danger: "border-[#EF4444]/25 bg-[#EF4444]/12 text-[#FDA4AF]",
  ai: "border-[#38BDF8]/25 bg-[#38BDF8]/12 text-[#7DD3FC]",
}

export function StatusBadge({
  label,
  tone = "default",
  className,
}: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-7 rounded-full border px-2.5 text-[12px] font-semibold tracking-[0.01em]",
        toneClassName[tone],
        className
      )}
    >
      {label}
    </Badge>
  )
}
