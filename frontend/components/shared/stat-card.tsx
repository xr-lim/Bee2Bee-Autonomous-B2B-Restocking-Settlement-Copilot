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
    <Card className="panel-surface min-h-[220px] rounded-3xl py-0 transition-transform duration-200 hover:-translate-y-0.5">
      <CardContent className="flex h-full flex-col justify-between p-6 sm:p-7">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#94A3B8]">
              {title}
            </p>
            <p className="mt-5 text-[2.5rem] font-semibold leading-none text-[#F8FAFC] sm:text-[3rem]">
              {value}
            </p>
          </div>
          {Icon ? (
            <div
              className={cn(
                "flex size-14 items-center justify-center rounded-[18px]",
                toneClassName[tone]
              )}
            >
              <Icon className="size-5.5" aria-hidden="true" />
            </div>
          ) : null}
        </div>
        {change ? (
          <div className="mt-6 rounded-2xl border border-[#243047] bg-[#172033] px-4 py-3.5">
            <p className="text-[13px] leading-6 text-[#94A3B8]">{change}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
