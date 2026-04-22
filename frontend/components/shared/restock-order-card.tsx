import Link from "next/link"
import { Bot, EyeOff, PackagePlus } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { RestockRecommendation } from "@/lib/types"

type RestockOrderCardProps = {
  recommendation: RestockRecommendation
  compact?: boolean
  onDismiss?: (id: string) => void
}

export function RestockOrderCard({
  recommendation,
  compact = false,
  onDismiss,
}: RestockOrderCardProps) {
  return (
    <Card className="rounded-[14px] border border-[#8B5CF6]/35 bg-[#111827] py-0 shadow-none ring-0">
      <CardContent className={compact ? "p-4" : "p-5"}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <PackagePlus className="size-4 text-[#8B5CF6]" aria-hidden="true" />
              <StatusBadge label="Restock detected" tone="ai" />
            </div>
            <h3 className="text-[16px] font-semibold text-[#E5E7EB]">
              {recommendation.productName} is going low. Start restock?
            </h3>
            <p className="mt-2 text-[14px] leading-6 text-[#9CA3AF]">
              {recommendation.reason}
            </p>
          </div>
          <Bot className="size-5 shrink-0 text-[#8B5CF6]" aria-hidden="true" />
        </div>

        <div className="mt-4 grid grid-cols-4 gap-3">
          <Metric label="SKU" value={recommendation.sku} />
          <Metric label="Target Price" value={recommendation.targetPrice} />
          <Metric label="Quantity" value={recommendation.quantity.toLocaleString("en-US")} />
          <Metric label="Est. Spend" value={recommendation.estimatedSpend} />
        </div>

        {!compact ? (
          <div className="mt-4 rounded-[12px] border border-[#243047] bg-[#172033] p-4">
            <p className="text-[12px] font-medium text-[#C4B5FD]">
              After approval Z.AI will automate:
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {recommendation.automationPlan.map((step) => (
                <div key={step} className="flex gap-2 text-[12px] leading-5 text-[#9CA3AF]">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#8B5CF6]" />
                  {step}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] text-[#9CA3AF]">
            User approves the restock once. Z.AI handles supplier negotiation,
            order creation, and invoice routing unless interrupted.
          </p>
          <div className="flex items-center gap-2">
            <Button
              asChild
              className="h-9 rounded-[10px] bg-[#3B82F6] px-4 text-white hover:bg-[#2563EB]"
            >
              <Link href={`/inventory/${recommendation.sku}`}>
                Review & restock
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onDismiss?.(recommendation.id)}
              className="h-9 rounded-[10px] border-[#EF4444]/35 bg-[#EF4444]/10 px-3 text-[#FCA5A5] hover:bg-[#EF4444]/20"
            >
              <EyeOff className="size-4" aria-hidden="true" />
              Dismiss
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] bg-[#172033] p-3">
      <p className="text-[12px] text-[#9CA3AF]">{label}</p>
      <p className="mt-1 truncate text-[14px] font-semibold text-[#E5E7EB]">
        {value}
      </p>
    </div>
  )
}
