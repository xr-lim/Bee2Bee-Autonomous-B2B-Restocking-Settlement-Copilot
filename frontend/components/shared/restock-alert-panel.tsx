"use client"

import { ChevronDown, PackagePlus } from "lucide-react"
import { useState } from "react"

import { RestockOrderCard } from "@/components/shared/restock-order-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Card, CardContent } from "@/components/ui/card"
import type { RestockRecommendation } from "@/lib/types"
import { cn } from "@/lib/utils"

type RestockAlertPanelProps = {
  recommendations: RestockRecommendation[]
  defaultOpen?: boolean
}

export function RestockAlertPanel({
  recommendations,
  defaultOpen = false,
}: RestockAlertPanelProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(
    () => new Set()
  )
  const visibleRecommendations = recommendations.filter(
    (item) => !dismissedIds.has(item.id) && isActionableRestock(item)
  )

  if (visibleRecommendations.length === 0) {
    return null
  }

  const totalQuantity = visibleRecommendations.reduce(
    (sum, item) => sum + item.quantity,
    0
  )
  const totalSpend = visibleRecommendations.reduce(
    (sum, item) => sum + parseSpend(item.estimatedSpend),
    0
  )
  const uniqueSuppliers = Array.from(
    new Set(visibleRecommendations.map((item) => item.supplier))
  )

  function handleDismiss(id: string) {
    setDismissedIds((current) => new Set([...current, id]))
  }

  return (
    <Card className="rounded-[14px] border border-[#8B5CF6]/35 bg-[#111827] py-0 shadow-none ring-0">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-[#172033]/50"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[#8B5CF6]/15">
              <PackagePlus className="size-4 text-[#8B5CF6]" aria-hidden="true" />
            </div>
            <StatusBadge label="Restock detected" tone="ai" />
            <div className="min-w-0 truncate text-[14px] text-[#E5E7EB]">
              <span className="font-semibold">
                {visibleRecommendations.length} SKU
                {visibleRecommendations.length > 1 ? "s" : ""} going low
              </span>
              <span className="ml-2 text-[12px] text-[#9CA3AF]">
                across {uniqueSuppliers.length} supplier
                {uniqueSuppliers.length > 1 ? "s" : ""} ·{" "}
                {totalQuantity.toLocaleString("en-US")} units · est.{" "}
                {formatSpend(totalSpend)}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden items-center gap-1.5 md:flex">
              {visibleRecommendations.slice(0, 4).map((item) => (
                <StatusBadge
                  key={item.id}
                  label={item.sku}
                  tone="default"
                  className="h-6"
                />
              ))}
              {visibleRecommendations.length > 4 ? (
                <span className="text-[12px] text-[#9CA3AF]">
                  +{visibleRecommendations.length - 4}
                </span>
              ) : null}
            </div>

            <span className="text-[12px] text-[#C4B5FD]">
              {open ? "Hide" : "Review all"}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-4 text-[#C4B5FD] transition-transform",
                open && "rotate-180"
              )}
            />
          </div>
        </button>

        {open ? (
          <div className="space-y-3 border-t border-[#243047] bg-[#0B1220] p-4">
            {visibleRecommendations.map((recommendation) => (
              <RestockOrderCard
                key={recommendation.id}
                recommendation={recommendation}
                compact
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function isActionableRestock(item: RestockRecommendation) {
  if (
    [
      "po_sent",
      "waiting_supplier",
      "invoice_processing",
      "ready_for_approval",
      "completed",
    ].includes(item.workflowState ?? "")
  ) {
    return false
  }

  if (
    item.restockRequestStatus === "pending" ||
    item.restockRequestStatus === "reviewed"
  ) {
    return true
  }

  if (
    item.restockRequestStatus === "accepted" ||
    item.restockRequestStatus === "rejected" ||
    item.restockRequestStatus === "cancelled"
  ) {
    return false
  }

  return item.workflowState !== "blocked"
}

function parseSpend(value: string) {
  const cleaned = value.replace(/[^0-9.KMkm]/g, "")
  const match = cleaned.match(/^([0-9]+(?:\.[0-9]+)?)([KMkm]?)$/)
  if (!match) {
    return 0
  }
  const amount = Number(match[1])
  const unit = match[2].toUpperCase()
  if (unit === "M") {
    return amount * 1_000_000
  }
  if (unit === "K") {
    return amount * 1_000
  }
  return amount
}

function formatSpend(value: number) {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`
  }
  return `$${value.toFixed(0)}`
}
