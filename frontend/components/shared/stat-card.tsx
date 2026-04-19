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
  default: "text-[#3B82F6] bg-[#3B82F6]/10",
  success: "text-[#10B981] bg-[#10B981]/10",
  warning: "text-[#F59E0B] bg-[#F59E0B]/10",
  danger: "text-[#EF4444] bg-[#EF4444]/10",
  ai: "text-[#8B5CF6] bg-[#8B5CF6]/10",
}

export function StatCard({
  title,
  value,
  change,
  icon: Icon,
  tone = "default",
}: StatCardProps) {
  return (
    <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium text-[#9CA3AF]">{title}</p>
            <p className="mt-3 text-[32px] font-semibold leading-none text-[#E5E7EB]">
              {value}
            </p>
          </div>
          {Icon ? (
            <div
              className={cn(
                "flex size-11 items-center justify-center rounded-[10px]",
                toneClassName[tone]
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
            </div>
          ) : null}
        </div>
        {change ? (
          <p className="mt-4 text-[13px] text-[#9CA3AF]">{change}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
