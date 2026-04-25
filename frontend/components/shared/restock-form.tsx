"use client"

import {
  AlertTriangle,
  Bot,
  Check,
  Loader2,
  PackagePlus,
  Pencil,
  Save,
  X,
} from "lucide-react"
import { motion } from "motion/react"
import { useRouter } from "next/navigation"
import { Fragment, useEffect, useMemo, useState } from "react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  cancelRestockRequestAction,
  markRestockRequestReviewedAction,
  startRestockWorkflowAction,
  updateRestockRequestAction,
} from "@/lib/actions"
import type {
  Product,
  RestockRecommendation,
  RestockRequest,
  Supplier,
  WorkflowState,
} from "@/lib/types"
import { cn } from "@/lib/utils"

const WORKFLOW_STEPS = [
  "Read stock",
  "Prepare supplier",
  "Send order",
  "Negotiation process",
  "Invoice",
  "Approval",
] as const

const WORKFLOW_STATE_TO_STEP_INDEX: Partial<Record<WorkflowState, number>> = {
  threshold_review: 0,
  supplier_prep: 1,
  po_sent: 2,
  waiting_supplier: 3,
  invoice_processing: 4,
  ready_for_approval: 5,
  completed: WORKFLOW_STEPS.length,
}

const START_ANIMATION_DELAY_MS = 850

type RestockFormProps = {
  recommendation: RestockRecommendation
  product: Product
  supplier?: Supplier
  suppliers: Supplier[]
}

export function RestockForm({
  recommendation,
  product,
  supplier,
  suppliers,
}: RestockFormProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(() => ({
    supplierId: product.supplierId,
    targetPrice: recommendation.targetPrice,
    quantity: recommendation.quantity,
    estimatedSpend: recommendation.estimatedSpend,
    reason: recommendation.reason,
  }))
  const [committed, setCommitted] = useState(draft)
  const [optimisticWorkflowState, setOptimisticWorkflowState] =
    useState<WorkflowState>()
  const [animatedActiveStep, setAnimatedActiveStep] = useState<number>()
  const [isStartingWorkflow, setIsStartingWorkflow] = useState(false)
  const [isCancellingRequest, setIsCancellingRequest] = useState(false)
  const [isSavingRequest, setIsSavingRequest] = useState(false)
  const [actionError, setActionError] = useState<string>()
  const [optimisticRequestStatus, setOptimisticRequestStatus] = useState<
    RestockRequest["status"] | undefined
  >(recommendation.restockRequestStatus)
  const supplierLookup = useMemo(
    () => new Map(suppliers.map((item) => [item.id, item])),
    [suppliers]
  )
  const supplierOptions = useMemo(() => {
    const trackedIds = Array.from(
      new Set([
        product.supplierId,
        ...(product.suppliers?.map((item) => item.supplierId) ?? []),
      ])
    )

    return trackedIds
      .map((supplierId) => supplierLookup.get(supplierId))
      .filter((item): item is Supplier => Boolean(item))
      .sort((first, second) => first.name.localeCompare(second.name))
  }, [product.supplierId, product.suppliers, supplierLookup])

  const fields = isEditing ? draft : committed
  const displaySupplier = supplierLookup.get(fields.supplierId) ?? supplier
  const thresholdDeficit = product.stockOnHand - product.currentThreshold
  const leadTime = displaySupplier?.leadTimeDays ?? 0
  const displayRequestStatus =
    optimisticRequestStatus ?? recommendation.restockRequestStatus
  const displayWorkflowState =
    optimisticWorkflowState ?? recommendation.workflowState
  const isBlockedWorkflow = displayWorkflowState === "blocked"
  const mappedActiveStep =
    isBlockedWorkflow
      ? recommendation.workflowBlockedStepIndex ?? 0
      : displayWorkflowState == null
      ? undefined
      : WORKFLOW_STATE_TO_STEP_INDEX[displayWorkflowState]
  const activeStep = animatedActiveStep ?? mappedActiveStep
  const workflowStarted =
    displayWorkflowState != null &&
    displayWorkflowState !== "threshold_review" &&
    displayWorkflowState !== "blocked" &&
    mappedActiveStep != null
  const waitingStepIndex =
    displayWorkflowState === "waiting_supplier"
      ? WORKFLOW_STATE_TO_STEP_INDEX.waiting_supplier
      : undefined

  const automationPlan = useMemo(() => recommendation.automationPlan, [
    recommendation.automationPlan,
  ])

  useEffect(() => {
    if (animatedActiveStep == null) return

    const timer = window.setTimeout(() => {
      if (animatedActiveStep < 2) {
        setAnimatedActiveStep((current) =>
          current == null ? current : Math.min(current + 1, 2)
        )
      } else {
        setAnimatedActiveStep(undefined)
        router.refresh()
      }
    }, START_ANIMATION_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [animatedActiveStep, router])

  useEffect(() => {
    const requestId = recommendation.restockRequestId

    if (workflowStarted || !requestId || displayRequestStatus !== "pending") {
      return
    }

    let cancelled = false

    void (async () => {
      const result = await markRestockRequestReviewedAction({
        requestId,
        sku: product.sku,
      })

      if (!cancelled && result.ok) {
        setOptimisticRequestStatus("reviewed")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    workflowStarted,
    recommendation.restockRequestId,
    displayRequestStatus,
    product.sku,
  ])

  function handleSave() {
    void saveDraft()
  }

  function handleCancel() {
    setDraft(committed)
    setIsEditing(false)
  }

  function handleEdit() {
    setDraft(committed)
    setIsEditing(true)
  }

  async function handleStartRestock() {
    if (workflowStarted || isStartingWorkflow) return

    setIsStartingWorkflow(true)
    setActionError(undefined)
    const result = await startRestockWorkflowAction({
      productId: product.id,
      sku: product.sku,
    })

    if (result.ok) {
      setOptimisticWorkflowState("po_sent")
      setAnimatedActiveStep(0)
    } else {
      setActionError(result.message ?? "Unable to start restock workflow.")
    }

    setIsStartingWorkflow(false)
  }

  async function handleCancelRequest() {
    if (!recommendation.restockRequestId || isCancellingRequest) return

    setIsCancellingRequest(true)
    setActionError(undefined)
    const result = await cancelRestockRequestAction({
      requestId: recommendation.restockRequestId,
      sku: product.sku,
    })

    if (result.ok) {
      router.refresh()
      return
    }

    setActionError(result.message ?? "Unable to cancel restock request.")
    setIsCancellingRequest(false)
  }

  async function saveDraft() {
    if (!recommendation.restockRequestId || isSavingRequest) return

    setIsSavingRequest(true)
    setActionError(undefined)
    const result = await updateRestockRequestAction({
      requestId: recommendation.restockRequestId,
      sku: product.sku,
      targetPrice: draft.targetPrice,
      quantity: draft.quantity,
      reason: draft.reason,
      supplierId: draft.supplierId,
    })

    if (result.ok) {
      const nextCommitted = {
        ...draft,
        estimatedSpend: deriveEstimatedSpend(draft.targetPrice, draft.quantity),
      }
      setDraft(nextCommitted)
      setCommitted(nextCommitted)
      setIsEditing(false)
      setIsSavingRequest(false)
      router.refresh()
      return
    }

    setActionError(result.message ?? "Unable to save restock request.")
    setIsSavingRequest(false)
  }

  const showCompactWorkflow = workflowStarted || isBlockedWorkflow
  const buttonLabel = isStartingWorkflow ? "Starting…" : "AI Restock"

  if (showCompactWorkflow) {
    return (
      <CompactWorkflowProgress
        steps={WORKFLOW_STEPS}
        activeStep={activeStep ?? 0}
        waitingStepIndex={waitingStepIndex}
        productName={recommendation.productName}
        conversationId={recommendation.conversationId}
        blocked={isBlockedWorkflow}
      />
    )
  }

  return (
    <Card className="rounded-[14px] border border-[#8B5CF6]/35 bg-[#111827] py-0 shadow-none ring-0">
      <CardHeader className="border-b border-[#243047] p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#8B5CF6]/15">
              <PackagePlus className="size-4 text-[#8B5CF6]" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <StatusBadge label="Restock detected" tone="ai" />
                {displayRequestStatus ? (
                  <StatusBadge
                    label={`Request ${displayRequestStatus}`}
                    tone="default"
                  />
                ) : null}
                <span className="text-[12px] text-[#9CA3AF]">
                  Conversation ID · {recommendation.conversationId}
                </span>
              </div>
              <CardTitle className="mt-2 text-[16px] font-semibold text-[#E5E7EB]">
                Restock order for {recommendation.productName}
              </CardTitle>
              <p className="mt-1 text-[12px] text-[#9CA3AF]">
                Review stock context and adjust terms before Z.AI starts the
                autonomous negotiation.
              </p>
            </div>
          </div>

          <Bot
            className="size-5 shrink-0 text-[#8B5CF6]"
            aria-hidden="true"
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        <section>
          <SectionLabel>Stock context</SectionLabel>
          <div className="mt-2 grid grid-cols-4 gap-3">
            <StaticMetric label="Current Stock" value={product.stockOnHand} />
            <StaticMetric
              label="Current Threshold"
              value={product.currentThreshold}
            />
            <StaticMetric
              label="Deficit vs. Threshold"
              value={`${thresholdDeficit > 0 ? "+" : ""}${thresholdDeficit}`}
              valueClassName={
                thresholdDeficit < 0
                  ? "text-[#F87171]"
                  : "text-[#34D399]"
              }
            />
            <StaticMetric
              label="Lead Time"
              value={leadTime ? `${leadTime} days` : "—"}
            />
          </div>
        </section>

        <section>
          <SectionLabel>Order terms</SectionLabel>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <ReadOnlyField label="SKU" value={recommendation.sku} />
            <FieldRow label="Supplier" editing={isEditing}>
              {isEditing ? (
                <select
                  value={draft.supplierId}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      supplierId: event.target.value,
                    }))
                  }
                  className="h-9 w-full rounded-[10px] border border-[#243047] bg-[#0B1220] px-3 text-[14px] text-[#E5E7EB] outline-none"
                >
                  {supplierOptions.map((option) => (
                    <option
                      key={option.id}
                      value={option.id}
                      className="bg-[#111827] text-[#E5E7EB]"
                    >
                      {option.name}
                    </option>
                  ))}
                </select>
              ) : (
                <FieldValue>
                  {displaySupplier?.name ??
                    supplier?.name ??
                    recommendation.supplier}
                </FieldValue>
              )}
            </FieldRow>

            <FieldRow label="Target Price" editing={isEditing}>
              {isEditing ? (
                <Input
                  value={draft.targetPrice}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      targetPrice: event.target.value,
                      estimatedSpend: deriveEstimatedSpend(
                        event.target.value,
                        current.quantity
                      ),
                    }))
                  }
                  className="h-9 rounded-[10px] border-[#243047] bg-[#0B1220] text-[14px] text-[#E5E7EB] placeholder:text-[#6B7280]"
                />
              ) : (
                <FieldValue>{fields.targetPrice}</FieldValue>
              )}
            </FieldRow>

            <FieldRow label="Quantity" editing={isEditing}>
              {isEditing ? (
                <Input
                  type="number"
                  min={0}
                  value={draft.quantity}
                  onChange={(event) =>
                    setDraft((current) => {
                      const quantity = Number(event.target.value)
                      return {
                        ...current,
                        quantity,
                        estimatedSpend: deriveEstimatedSpend(
                          current.targetPrice,
                          quantity
                        ),
                      }
                    })
                  }
                  className="h-9 rounded-[10px] border-[#243047] bg-[#0B1220] text-[14px] text-[#E5E7EB]"
                />
              ) : (
                <FieldValue>
                  {fields.quantity.toLocaleString("en-US")} units
                </FieldValue>
              )}
            </FieldRow>

            <FieldRow label="Est. Spend" editing={isEditing}>
              <FieldValue>{fields.estimatedSpend}</FieldValue>
            </FieldRow>
          </div>
        </section>

        <section>
          <SectionLabel>Reason</SectionLabel>
          <div className="mt-2">
            {isEditing ? (
              <Textarea
                value={draft.reason}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
                rows={3}
                className="rounded-[10px] border-[#243047] bg-[#0B1220] text-[14px] leading-6 text-[#E5E7EB]"
              />
            ) : (
              <p className="rounded-[10px] border border-[#243047] bg-[#172033] p-3 text-[14px] leading-6 text-[#9CA3AF]">
                {fields.reason}
              </p>
            )}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex items-center gap-2">
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
                  disabled={isSavingRequest}
                  className="h-9 rounded-[10px] bg-[#3B82F6] px-4 text-white hover:bg-[#2563EB]"
                >
                  {isSavingRequest ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="size-4" aria-hidden="true" />
                  )}
                  Save changes
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  onClick={handleCancelRequest}
                  variant="outline"
                  disabled={isCancellingRequest || isStartingWorkflow}
                  className="h-9 rounded-[10px] border-[#7F1D1D] bg-[#1F151A] px-3 text-[#FCA5A5] hover:bg-[#301F26] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCancellingRequest ? (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <X className="size-4" aria-hidden="true" />
                  )}
                  Cancel request
                </Button>
                <Button
                  type="button"
                  onClick={handleEdit}
                  variant="outline"
                  disabled={workflowStarted}
                  className="h-9 rounded-[10px] border-[#243047] bg-[#172033] px-3 text-[#E5E7EB] hover:bg-[#243047]"
                >
                  <Pencil className="size-4" aria-hidden="true" />
                  Edit
                </Button>
                <Button
                  type="button"
                  onClick={handleStartRestock}
                  disabled={workflowStarted || isStartingWorkflow}
                  className="h-10 rounded-[10px] bg-[#3B82F6] px-4 text-white hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:bg-[#3B82F6]/60"
                >
                  {isStartingWorkflow ? (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Bot className="size-4" aria-hidden="true" />
                  )}
                  {buttonLabel}
                </Button>
              </>
            )}
          </div>
        </div>
        {actionError ? (
          <p className="text-right text-[12px] leading-5 text-[#FCA5A5]">
            {actionError}
          </p>
        ) : null}

      </CardContent>
    </Card>
  )
}

type CompactWorkflowProgressProps = {
  steps: readonly string[]
  activeStep: number
  waitingStepIndex?: number
  productName?: string
  conversationId?: string
  blocked?: boolean
}

export function CompactWorkflowProgress({
  steps,
  activeStep,
  waitingStepIndex,
  productName,
  conversationId,
  blocked = false,
}: CompactWorkflowProgressProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="rounded-[16px] border border-[#243047] bg-[#111827]/80 px-6 py-8"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Bot
            className="mt-0.5 size-4 text-[#8B5CF6]"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold leading-5 text-[#E5E7EB]">
              {blocked ? "Restock Blocked" : "Restock in Progress"}
            </p>
            {productName ? (
              <p className="mt-0.5 truncate text-[12px] leading-4 text-[#9CA3AF]">
                {productName}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[11px] text-[#9CA3AF]">
          {blocked ? (
            <>
              <AlertTriangle
                className="size-3 text-[#F59E0B]"
                aria-hidden="true"
              />
              Blocked
            </>
          ) : (
            <>
              <Loader2
                className="size-3 animate-spin text-[#8B5CF6]"
                aria-hidden="true"
              />
              {conversationId ? `Conv · ${conversationId}` : "In progress"}
            </>
          )}
        </div>
      </div>

      <div className="mt-7 flex w-full items-start justify-between">
        {steps.map((label, index) => {
          const isCompleted = index < activeStep
          const isActive = index === activeStep && activeStep < steps.length
          const isWaitingStep = isActive && index === waitingStepIndex
          const connectorActive = index < activeStep

          return (
            <Fragment key={label}>
              <div className="flex min-w-0 flex-col items-center">
                <CompactStepIndicator
                  index={index}
                  isCompleted={isCompleted}
                  isActive={isActive}
                />
                <p
                  className={cn(
                    "mt-3 whitespace-nowrap text-center text-[14px] font-medium leading-5",
                    isActive
                      ? "text-[#F3F4F6]"
                      : isCompleted
                        ? "text-[#C7CCD6]"
                        : "text-[#9CA3AF]",
                  )}
                >
                  {label}
                </p>
                {isWaitingStep ? (
                  <p className="mt-1.5 flex items-center justify-center gap-1.5 whitespace-nowrap text-[12px] leading-4 text-[#DDD6FE]">
                    <motion.span
                      className="size-1.5 rounded-full bg-[#A78BFA]"
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{
                        duration: 1.4,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                    Negotiation in progress…
                  </p>
                ) : blocked && isActive ? (
                  <p className="mt-1.5 flex items-center justify-center gap-1.5 whitespace-nowrap text-[12px] leading-4 text-[#FCD34D]">
                    <AlertTriangle
                      className="size-3 text-[#F59E0B]"
                      aria-hidden="true"
                    />
                    Waiting for manual unblock
                  </p>
                ) : null}
              </div>

              {index < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-[12px] h-[3px] flex-1 shrink rounded-full transition-colors",
                    connectorActive ? "bg-[#34D399]" : "bg-[#243047]",
                  )}
                />
              ) : null}
            </Fragment>
          )
        })}
      </div>
    </motion.section>
  )
}

function CompactStepIndicator({
  index,
  isCompleted,
  isActive,
}: {
  index: number
  isCompleted: boolean
  isActive: boolean
}) {
  if (isCompleted) {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#10B981]/20 text-[#34D399] ring-1 ring-[#10B981]/40">
        <Check className="size-4" aria-hidden="true" />
      </span>
    )
  }

  if (isActive) {
    return (
      <span className="relative flex size-7 shrink-0 scale-110 items-center justify-center rounded-full bg-[#8B5CF6] shadow-[0_0_0_6px_rgba(139,92,246,0.18)] ring-2 ring-[#C4B5FD]/60">
        <motion.span
          className="absolute inset-0 rounded-full bg-[#8B5CF6]"
          animate={{ scale: [1, 1.55, 1], opacity: [0.55, 0, 0.55] }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <span className="relative size-2.5 rounded-full bg-white" />
      </span>
    )
  }

  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[#243047] bg-[#0B1220] text-[12px] font-medium text-[#6B7280]">
      {index + 1}
    </span>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-medium uppercase tracking-wider text-[#9CA3AF]">
      {children}
    </p>
  )
}

function StaticMetric({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: number | string
  valueClassName?: string
}) {
  return (
    <div className="rounded-[10px] border border-[#243047] bg-[#172033] p-3">
      <p className="text-[12px] text-[#9CA3AF]">{label}</p>
      <p
        className={
          "mt-1 text-[16px] font-semibold text-[#E5E7EB] " +
          (valueClassName ?? "")
        }
      >
        {value}
      </p>
    </div>
  )
}

function FieldRow({
  label,
  editing,
  children,
}: {
  label: string
  editing: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={
        "rounded-[10px] border p-3 " +
        (editing
          ? "border-[#8B5CF6]/35 bg-[#0B1220]"
          : "border-[#243047] bg-[#172033]")
      }
    >
      <p className="text-[12px] text-[#9CA3AF]">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function ReadOnlyField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-[10px] border border-[#243047] bg-[#172033] p-3">
      <p className="text-[12px] text-[#9CA3AF]">{label}</p>
      <p className="mt-1 truncate text-[14px] font-semibold text-[#E5E7EB]">
        {value}
      </p>
    </div>
  )
}

function FieldValue({ children }: { children: React.ReactNode }) {
  return (
    <p className="truncate text-[14px] font-semibold text-[#E5E7EB]">
      {children}
    </p>
  )
}

function deriveEstimatedSpend(targetPrice: string, quantity: number) {
  const matches = targetPrice.match(/\d+(?:\.\d+)?/g) ?? []
  if (matches.length === 0 || quantity <= 0) {
    return "Target pending"
  }

  const numericValues = matches.map((value) => Number(value))
  const unitPrice = Math.max(...numericValues)
  const total = unitPrice * quantity

  if (total >= 1_000_000) return `$${(total / 1_000_000).toFixed(1)}M`
  if (total >= 1_000) return `$${(total / 1_000).toFixed(1)}K`
  return `$${total.toFixed(0)}`
}
