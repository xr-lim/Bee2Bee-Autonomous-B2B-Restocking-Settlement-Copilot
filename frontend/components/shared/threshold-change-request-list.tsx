"use client"

import Link from "next/link"
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { AiReasoningTrail } from "@/components/shared/ai-reasoning-trail"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buildThresholdReasoning } from "@/lib/ai-reasoning"
import { decideThresholdRequestAction } from "@/lib/actions"
import type { Product, StatusTone, ThresholdChangeRequest } from "@/lib/types"
import { cn } from "@/lib/utils"

type ThresholdChangeRequestListProps = {
  requests: ThresholdChangeRequest[]
  products?: Product[]
  title?: string
  description?: string
  maxVisible?: number
  emptyLabel?: string
  defaultOpen?: boolean
  collapsible?: boolean
  variant?: "review" | "preview"
}

type LocalStatus = ThresholdChangeRequest["status"]

const triggerLabel: Record<ThresholdChangeRequest["trigger"], string> = {
  "demand-spike": "Demand spike",
  "demand-drop": "Demand drop",
  "lead-time-shift": "Lead time shift",
  "bundle-opportunity": "Bundle window",
  "new-product": "New product",
}

const triggerTone: Record<ThresholdChangeRequest["trigger"], StatusTone> = {
  "demand-spike": "warning",
  "demand-drop": "default",
  "lead-time-shift": "danger",
  "bundle-opportunity": "ai",
  "new-product": "ai",
}

export function ThresholdChangeRequestList({
  requests,
  products,
  title = "Threshold Change Requests",
  description = "Z.AI threshold updates awaiting approval.",
  maxVisible,
  emptyLabel = "No pending threshold changes.",
  defaultOpen = false,
  collapsible = true,
  variant = "review",
}: ThresholdChangeRequestListProps) {
  const router = useRouter()
  const isPreview = variant === "preview"
  const productLookup = new Map(
    (products ?? []).map((product) => [product.sku, product])
  )
  const [statusMap, setStatusMap] = useState<Record<string, LocalStatus>>({})
  const [open, setOpen] = useState(defaultOpen || !collapsible)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const pendingRequests = requests.filter(
    (request) => (statusMap[request.id] ?? request.status) === "pending"
  )
  const visibleRequests =
    typeof maxVisible === "number"
      ? pendingRequests.slice(0, maxVisible)
      : pendingRequests
  const hiddenCount = pendingRequests.length - visibleRequests.length

  function handleDecision(id: string, decision: LocalStatus) {
    const request = requests.find((item) => item.id === id)
    if (!request || decision === "pending") return
    setError(null)
    startTransition(async () => {
      const result = await decideThresholdRequestAction({
        requestId: id,
        decision,
        proposedThreshold: request.proposedThreshold,
        reason: request.reason,
      })
      if (!result.ok) {
        setError(result.message ?? "Could not save threshold decision.")
        return
      }
      setStatusMap((current) => ({ ...current, [id]: decision }))
      router.refresh()
    })
  }

  const expanded = collapsible ? open : true

  return (
    <Card className="rounded-[14px] border border-[#8B5CF6]/35 bg-[#111827] py-0 shadow-none ring-0">
      <CardHeader className="p-0">
        <button
          type="button"
          onClick={() => {
            if (collapsible) setOpen((value) => !value)
          }}
          aria-expanded={expanded}
          disabled={!collapsible}
          className={cn(
            "flex w-full items-start justify-between gap-3 p-4 text-left",
            collapsible &&
              "transition-colors hover:bg-[#172033]/50 cursor-pointer",
            !collapsible && "cursor-default"
          )}
        >
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#8B5CF6]/15">
              <Bot className="size-4 text-[#8B5CF6]" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-[18px] font-semibold text-[#E5E7EB]">
                  {title}
                </CardTitle>
                <StatusBadge
                  label={`${pendingRequests.length} pending`}
                  tone={pendingRequests.length > 0 ? "ai" : "default"}
                />
              </div>
              <p className="mt-1.5 text-[15px] leading-6 text-[#9CA3AF]">
                {description}
              </p>
            </div>
          </div>

          {collapsible ? (
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-[14px] text-[#C4B5FD]">
                {expanded ? "Hide" : "Review all"}
              </span>
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "size-4 text-[#C4B5FD] transition-transform",
                  expanded && "rotate-180"
                )}
              />
            </div>
          ) : null}
        </button>
      </CardHeader>

      {expanded ? (
        <CardContent className="border-t border-[#243047] p-0">
          {error ? (
            <div className="border-b border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-2.5 text-[13px] text-[#FCA5A5]">
              {error}
            </div>
          ) : null}
          {visibleRequests.length === 0 ? (
            <div className="p-5 text-[14px] text-[#6B7280]">{emptyLabel}</div>
          ) : (
            <ul className="divide-y divide-[#243047]">
              {visibleRequests.map((request) =>
                isPreview ? (
                  <ThresholdPreviewRow
                    key={request.id}
                    request={request}
                  />
                ) : (
                  <ThresholdRow
                    key={request.id}
                    request={request}
                    product={productLookup.get(request.productSku)}
                    onDecision={handleDecision}
                    pending={isPending}
                  />
                )
              )}
            </ul>
          )}
          {hiddenCount > 0 ? (
            <div className="border-t border-[#243047] px-4 py-2.5 text-[13px] text-[#6B7280]">
              +{hiddenCount} more pending request
              {hiddenCount > 1 ? "s" : ""}. Open inventory to review all.
            </div>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  )
}

export function ThresholdChangeBanner({
  request,
  product,
}: {
  request: ThresholdChangeRequest
  product?: Product
}) {
  const router = useRouter()
  const [decision, setDecision] = useState<LocalStatus>(request.status)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const positive = request.changePercent >= 0
  const DeltaIcon = positive ? ArrowUpRight : ArrowDownRight
  const reasoning = buildThresholdReasoning(request, product)

  function handleDecision(nextDecision: Exclude<LocalStatus, "pending">) {
    setError(null)
    startTransition(async () => {
      const result = await decideThresholdRequestAction({
        requestId: request.id,
        decision: nextDecision,
        proposedThreshold: request.proposedThreshold,
        reason: request.reason,
      })
      if (!result.ok) {
        setError(result.message ?? "Could not save threshold decision.")
        return
      }
      setDecision(nextDecision)
      router.refresh()
    })
  }

  return (
    <Card className="rounded-[14px] border border-[#8B5CF6]/35 bg-[#8B5CF6]/5 py-0 shadow-none ring-0">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#8B5CF6]/15">
              <Bot className="size-4 text-[#8B5CF6]" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label="AI Threshold Change Request" tone="ai" />
                <StatusBadge
                  label={triggerLabel[request.trigger]}
                  tone={triggerTone[request.trigger]}
                />
                {decision !== "pending" ? (
                  <StatusBadge
                    label={decision === "approved" ? "Approved" : "Rejected"}
                    tone={decision === "approved" ? "success" : "default"}
                  />
                ) : null}
              </div>
              <p className="mt-2 text-[15px] leading-6 text-[#E5E7EB]">
                Z.AI suggests moving the AI threshold from{" "}
                <span className="font-semibold">
                  {request.currentThreshold}
                </span>{" "}
                <ArrowRight
                  className="inline-block size-3 -mt-0.5 text-[#6B7280]"
                  aria-hidden="true"
                />{" "}
                <span className="font-semibold">
                  {request.proposedThreshold}
                </span>{" "}
                <span
                  className={
                    positive
                      ? "inline-flex items-center gap-0.5 text-[13px] text-[#F59E0B]"
                      : "inline-flex items-center gap-0.5 text-[13px] text-[#10B981]"
                  }
                >
                  <DeltaIcon className="size-3" aria-hidden="true" />
                  {positive ? "+" : ""}
                  {request.changePercent}%
                </span>
              </p>
              <p className="mt-1.5 text-[14px] leading-6 text-[#9CA3AF]">
                {request.reason}
              </p>
            </div>
          </div>
          {decision === "pending" ? (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => handleDecision("rejected")}
                className="h-9 rounded-[10px] border-[#243047] bg-[#172033] px-3 text-[#E5E7EB] hover:bg-[#243047]"
              >
                <X className="size-4" aria-hidden="true" />
                Keep current
              </Button>
              <Button
                type="button"
                disabled={isPending}
                onClick={() => handleDecision("approved")}
                className="h-9 rounded-[10px] bg-[#3B82F6] px-3 text-white hover:bg-[#2563EB]"
              >
                <Check className="size-4" aria-hidden="true" />
                Apply new threshold
              </Button>
            </div>
          ) : null}
        </div>
        {error ? <p className="text-[13px] text-[#FCA5A5]">{error}</p> : null}
        <AiReasoningTrail
          id={`threshold-banner-${request.id}`}
          signals={reasoning.signals}
          confidence={reasoning.confidence}
          decision={reasoning.decision}
        />
      </CardContent>
    </Card>
  )
}

function ThresholdRow({
  request,
  product,
  onDecision,
  pending,
}: {
  request: ThresholdChangeRequest
  product?: Product
  onDecision: (id: string, decision: LocalStatus) => void
  pending?: boolean
}) {
  const positive = request.changePercent >= 0
  const DeltaIcon = positive ? ArrowUpRight : ArrowDownRight
  const reasoning = buildThresholdReasoning(request, product)

  return (
    <li className="flex flex-col gap-3 px-4 py-4">
      <div className="grid grid-cols-[1.3fr_1.1fr_auto] items-center gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/inventory/${request.productSku}`}
              className="truncate text-[16px] font-semibold text-[#E5E7EB] hover:text-[#93C5FD]"
            >
              {request.productName}
            </Link>
            <StatusBadge
              label={triggerLabel[request.trigger]}
              tone={triggerTone[request.trigger]}
            />
          </div>
          <p className="mt-1 font-mono text-[13px] text-[#6B7280]">
            {request.productSku}
          </p>
          <p className="mt-1.5 line-clamp-2 text-[14px] leading-6 text-[#9CA3AF]">
            {request.reason}
          </p>
        </div>

        <div>
          <div className="flex items-center gap-2 text-[16px] text-[#E5E7EB]">
            <span className="text-[#9CA3AF]">{request.currentThreshold}</span>
            <ArrowRight
              className="size-3.5 text-[#6B7280]"
              aria-hidden="true"
            />
            <span className="font-semibold">{request.proposedThreshold}</span>
          </div>
          <div
            className={
              positive
                ? "mt-1 flex items-center gap-1 text-[13px] text-[#F59E0B]"
                : "mt-1 flex items-center gap-1 text-[13px] text-[#10B981]"
            }
          >
            <DeltaIcon className="size-3" aria-hidden="true" />
            <span>
              {positive ? "+" : ""}
              {request.changePercent}% vs current
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onDecision(request.id, "rejected")}
            className="h-9 rounded-[10px] border-[#243047] bg-[#172033] px-3.5 text-[14px] text-[#E5E7EB] hover:bg-[#243047]"
          >
            <X className="size-3.5" aria-hidden="true" />
            Reject
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => onDecision(request.id, "approved")}
            className="h-9 rounded-[10px] bg-[#3B82F6] px-3.5 text-[14px] text-white hover:bg-[#2563EB]"
          >
            <Check className="size-3.5" aria-hidden="true" />
            Approve
          </Button>
        </div>
      </div>
      <AiReasoningTrail
        id={`threshold-row-${request.id}`}
        signals={reasoning.signals}
        confidence={reasoning.confidence}
        decision={reasoning.decision}
        density="compact"
      />
    </li>
  )
}

function ThresholdPreviewRow({
  request,
}: {
  request: ThresholdChangeRequest
}) {
  const positive = request.changePercent >= 0
  const DeltaIcon = positive ? ArrowUpRight : ArrowDownRight

  return (
    <li className="grid grid-cols-[1.4fr_1fr_auto] items-center gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Link
            href={`/inventory/${request.productSku}`}
            className="truncate text-[15px] font-semibold text-[#E5E7EB] hover:text-[#93C5FD]"
          >
            {request.productName}
          </Link>
          <StatusBadge
            label={triggerLabel[request.trigger]}
            tone={triggerTone[request.trigger]}
          />
        </div>
        <p className="mt-0.5 font-mono text-[12px] text-[#6B7280]">
          {request.productSku}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-[14px] text-[#9CA3AF]">
          <span>{request.currentThreshold}</span>
          <ArrowRight className="size-3 text-[#6B7280]" aria-hidden="true" />
          <span className="font-semibold text-[#E5E7EB]">
            {request.proposedThreshold}
          </span>
        </div>
        <div
          className={
            positive
              ? "flex items-center gap-0.5 text-[12px] text-[#F59E0B]"
              : "flex items-center gap-0.5 text-[12px] text-[#10B981]"
          }
        >
          <DeltaIcon className="size-3" aria-hidden="true" />
          {positive ? "+" : ""}
          {request.changePercent}%
        </div>
      </div>

      <Button
        asChild
        variant="outline"
        className="h-9 rounded-[10px] border-[#243047] bg-[#172033] px-3 text-[13px] text-[#E5E7EB] hover:bg-[#243047]"
      >
        <Link href={`/inventory/${request.productSku}`}>
          Review
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </Button>
    </li>
  )
}
