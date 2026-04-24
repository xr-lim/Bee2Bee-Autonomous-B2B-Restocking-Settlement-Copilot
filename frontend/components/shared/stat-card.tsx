import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import type { StatusTone } from "@/lib/types"
import { cn } from "@/lib/utils"

type StatCardProps = {
  title: string
  value: string
  change?: string
  icon?: LucideIcon
  tone?: StatusTone
}

const toneClassName: Record<StatusTone, string> = {
  default: "text-[#7DD3FC] bg-[#38BDF8]/12 ring-1 ring-[#38BDF8]/15",
  success: "text-[#6EE7B7] bg-[#10B981]/12 ring-1 ring-[#10B981]/15",
  warning: "text-[#FCD34D] bg-[#F59E0B]/12 ring-1 ring-[#F59E0B]/15",
  danger: "text-[#FDA4AF] bg-[#EF4444]/12 ring-1 ring-[#EF4444]/15",
  ai: "text-[#FCD34D] bg-[#FACC15]/12 ring-1 ring-[#FACC15]/18",
}

export function StatCard({
  title,
  value,
  change,
  icon: Icon,
  tone = "default",
}: StatCardProps) {
  return (
    <Card className="panel-surface rounded-3xl py-0 transition-transform duration-200 hover:-translate-y-0.5">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">
              {title}
            </p>
            <p className="mt-3 text-[2rem] font-semibold leading-none text-[#F8FAFC] sm:text-[2.4rem]">
              {value}
            </p>
          </div>
          {Icon ? (
            <div
              className={cn(
                "flex size-12 items-center justify-center rounded-2xl",
                toneClassName[tone]
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
            </div>
          ) : null}
        </div>
        {change ? (
          <p className="mt-4 text-[13px] leading-6 text-[#94A3B8]">{change}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
