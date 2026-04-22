"use client"

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  Pencil,
  Save,
  X,
} from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { AiReasoningTrail } from "@/components/shared/ai-reasoning-trail"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { buildThresholdReasoning } from "@/lib/ai-reasoning"
import {
  decideThresholdRequestAction,
  updateThresholdRequestAction,
} from "@/lib/actions"
import type {
  Product,
  StatusTone,
  ThresholdChangeRequest,
} from "@/lib/types"

type Decision = ThresholdChangeRequest["status"]

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

export function ThresholdChangeReviewPanel({
  request,
  product,
}: {
  request: ThresholdChangeRequest
  product?: Product
}) {
  const router = useRouter()
  const reasoning = useMemo(
    () => buildThresholdReasoning(request, product),
    [request, product]
  )

  const [isEditing, setIsEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [committed, setCommitted] = useState({
    proposedThreshold: request.proposedThreshold,
    reason: request.reason,
  })
  const [draft, setDraft] = useState(committed)
  const [decision, setDecision] = useState<Decision>(request.status)

  const state = isEditing ? draft : committed
  const positive = state.proposedThreshold >= request.currentThreshold
  const DeltaIcon = positive ? ArrowUpRight : ArrowDownRight
  const changePercent =
    request.currentThreshold === 0
      ? 0
      : Math.round(
          ((state.proposedThreshold - request.currentThreshold) /
            request.currentThreshold) *
            100
        )

  function handleEdit() {
    setDraft(committed)
    setIsEditing(true)
  }

  function handleCancel() {
    setDraft(committed)
    setIsEditing(false)
  }

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await updateThresholdRequestAction({
        requestId: request.id,
        proposedThreshold: draft.proposedThreshold,
        reason: draft.reason,
      })

      if (!result.ok) {
        setError(result.message ?? "Could not update threshold request.")
        return
      }

      setCommitted(draft)
      setIsEditing(false)
      router.refresh()
    })
  }

  function handleDecision(nextDecision: Exclude<Decision, "pending">) {
    setError(null)
    startTransition(async () => {
      const result = await decideThresholdRequestAction({
        requestId: request.id,
        decision: nextDecision,
        proposedThreshold: state.proposedThreshold,
        reason: state.reason,
      })

      if (!result.ok) {
        setError(result.message ?? "Could not save threshold decision.")
        return
      }

      setDecision(nextDecision)
      router.refresh()
    })
  }

  const showActions = decision === "pending"

  return (
    <Card className="rounded-[14px] border border-[#8B5CF6]/35 bg-[#8B5CF6]/5 py-0 shadow-none ring-0">
      <CardHeader className="border-b border-[#8B5CF6]/25 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[#8B5CF6]/15">
              <Bot className="size-5 text-[#8B5CF6]" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-[17px] font-semibold text-[#E5E7EB]">
                  Threshold Change Review
                </CardTitle>
                <StatusBadge label="AI proposal" tone="ai" />
                <StatusBadge
                  label={triggerLabel[request.trigger]}
                  tone={triggerTone[request.trigger]}
                />
                {decision !== "pending" ? (
                  <StatusBadge
                    label={decision === "approved" ? "Applied" : "Rejected"}
                    tone={decision === "approved" ? "success" : "default"}
                  />
                ) : null}
              </div>
              <p className="mt-1.5 text-[13px] leading-5 text-[#9CA3AF]">
                Adjust the proposed threshold or reasoning before confirming.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showActions && !isEditing ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleEdit}
                className="h-9 rounded-[10px] border-[#243047] bg-[#111827] px-3 text-[#E5E7EB] hover:bg-[#243047]"
              >
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </Button>
            ) : null}
            {isEditing ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  className="h-9 rounded-[10px] border-[#243047] bg-[#111827] px-3 text-[#E5E7EB] hover:bg-[#243047]"
                >
                  <X className="size-4" aria-hidden="true" />
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={isPending}
                  className="h-9 rounded-[10px] bg-[#3B82F6] px-3 text-white hover:bg-[#2563EB]"
                >
                  <Save className="size-4" aria-hidden="true" />
                  {isPending ? "Saving..." : "Save"}
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        <div className="grid grid-cols-3 gap-3">
          <ValueBlock label="Current Threshold" value={request.currentThreshold} />
          <ValueBlock
            label="Proposed Threshold"
            editing={isEditing}
            value={state.proposedThreshold}
          >
            {isEditing ? (
              <Input
                type="number"
                min={0}
                value={draft.proposedThreshold}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    proposedThreshold: Number(event.target.value),
                  }))
                }
                className="h-10 rounded-[10px] border-[#8B5CF6]/40 bg-[#0B1220] text-[18px] font-semibold text-[#E5E7EB]"
              />
            ) : null}
          </ValueBlock>
          <div className="rounded-[10px] border border-[#243047] bg-[#172033] p-3.5">
            <p className="text-[12px] font-medium uppercase tracking-wider text-[#9CA3AF]">
              Change vs Current
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-[18px] font-semibold text-[#E5E7EB]">
                {request.currentThreshold}
              </span>
              <ArrowRight
                className="size-4 text-[#6B7280]"
                aria-hidden="true"
              />
              <span className="text-[18px] font-semibold text-[#E5E7EB]">
                {state.proposedThreshold}
              </span>
              <span
                className={
                  positive
                    ? "ml-1 inline-flex items-center gap-0.5 text-[13px] text-[#F59E0B]"
                    : "ml-1 inline-flex items-center gap-0.5 text-[13px] text-[#10B981]"
                }
              >
                <DeltaIcon className="size-3.5" aria-hidden="true" />
                {positive ? "+" : ""}
                {changePercent}%
              </span>
            </div>
          </div>
        </div>

        <div>
          <p className="text-[12px] font-medium uppercase tracking-wider text-[#9CA3AF]">
            Reason / rationale
          </p>
          <div className="mt-2">
            {isEditing ? (
              <Textarea
                rows={3}
                value={draft.reason}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
                className="rounded-[10px] border-[#8B5CF6]/30 bg-[#0B1220] text-[14px] leading-6 text-[#E5E7EB]"
              />
            ) : (
              <p className="rounded-[10px] border border-[#243047] bg-[#172033] p-4 text-[14px] leading-6 text-[#9CA3AF]">
                {state.reason}
              </p>
            )}
          </div>
        </div>

        <AiReasoningTrail
          id={`threshold-review-${request.id}`}
          signals={reasoning.signals}
          confidence={reasoning.confidence}
          decision={reasoning.decision}
        />

        {showActions ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#243047] pt-4">
            {error ? (
              <p className="mr-auto text-[13px] text-[#FCA5A5]">{error}</p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => handleDecision("rejected")}
              className="h-10 rounded-[10px] border-[#243047] bg-[#172033] px-4 text-[#E5E7EB] hover:bg-[#243047]"
            >
              <X className="size-4" aria-hidden="true" />
              {isPending ? "Saving..." : "Keep current threshold"}
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={() => handleDecision("approved")}
              className="h-10 rounded-[10px] bg-[#3B82F6] px-4 text-white hover:bg-[#2563EB]"
            >
              <Check className="size-4" aria-hidden="true" />
              {isPending ? "Saving..." : "Confirm new threshold"}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-end border-t border-[#243047] pt-4">
            <p className="text-[13px] text-[#9CA3AF]">
              Decision saved. The request will disappear after refresh.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ValueBlock({
  label,
  value,
  editing,
  children,
}: {
  label: string
  value: number | string
  editing?: boolean
  children?: React.ReactNode
}) {
  return (
    <div
      className={
        editing
          ? "rounded-[10px] border border-[#8B5CF6]/35 bg-[#0B1220] p-3.5"
          : "rounded-[10px] border border-[#243047] bg-[#172033] p-3.5"
      }
    >
      <p className="text-[12px] font-medium uppercase tracking-wider text-[#9CA3AF]">
        {label}
      </p>
      <div className="mt-1.5">
        {children ? (
          children
        ) : (
          <p className="text-[18px] font-semibold text-[#E5E7EB]">{value}</p>
        )}
      </div>
    </div>
  )
}
