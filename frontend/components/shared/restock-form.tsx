"use client"

import {
  Bot,
  Check,
  Loader2,
  PackagePlus,
  Pencil,
  Save,
  X,
} from "lucide-react"
import { motion } from "motion/react"
import { Fragment, useEffect, useMemo, useState } from "react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { Product, RestockRecommendation, Supplier } from "@/lib/types"
import { cn } from "@/lib/utils"

const WORKFLOW_STEPS = [
  "Analyze trends",
  "Prepare supplier",
  "Send order",
  "Supplier reply",
  "Invoice",
  "Approval",
] as const

const STOP_INDEX = 3
const STEP_DELAY_MS = 1200

type RestockFormProps = {
  recommendation: RestockRecommendation
  product: Product
  supplier?: Supplier
}

export function RestockForm({
  recommendation,
  product,
  supplier,
}: RestockFormProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(() => ({
    targetPrice: recommendation.targetPrice,
    quantity: recommendation.quantity,
    estimatedSpend: recommendation.estimatedSpend,
    reason: recommendation.reason,
  }))
  const [committed, setCommitted] = useState(draft)

  const [workflowState, setWorkflowState] = useState<
    "idle" | "starting" | "running"
  >("idle")
  const [activeStep, setActiveStep] = useState(0)

  const thresholdDeficit = product.stockOnHand - product.aiThreshold
  const leadTime = supplier?.leadTimeDays ?? 0

  const fields = isEditing ? draft : committed

  const automationPlan = useMemo(() => recommendation.automationPlan, [
    recommendation.automationPlan,
  ])

  function handleSave() {
    setCommitted(draft)
    setIsEditing(false)
  }

  function handleCancel() {
    setDraft(committed)
    setIsEditing(false)
  }

  function handleEdit() {
    setDraft(committed)
    setIsEditing(true)
  }

  function handleStartRestock() {
    if (workflowState !== "idle") return
    setWorkflowState("starting")
    setActiveStep(0)
    const kickoff = window.setTimeout(() => {
      setWorkflowState("running")
    }, 600)
    return () => window.clearTimeout(kickoff)
  }

  useEffect(() => {
    if (workflowState !== "running") return
    if (activeStep >= STOP_INDEX) return

    const timer = window.setTimeout(() => {
      setActiveStep((current) => Math.min(current + 1, STOP_INDEX))
    }, STEP_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [workflowState, activeStep])

  const workflowStarted = workflowState !== "idle"
  const showCompactWorkflow = workflowState === "running"
  const buttonLabel =
    workflowState === "starting"
      ? "Starting…"
      : workflowState === "running"
        ? "Processing…"
        : "AI Restock"

  if (showCompactWorkflow) {
    return (
      <CompactWorkflowProgress
        steps={WORKFLOW_STEPS}
        activeStep={activeStep}
        stopIndex={STOP_INDEX}
        productName={recommendation.productName}
        conversationId={recommendation.conversationId}
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
            <StaticMetric label="AI Threshold" value={product.aiThreshold} />
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
            <ReadOnlyField
              label="Supplier"
              value={supplier?.name ?? recommendation.supplier}
            />

            <FieldRow label="Target Price" editing={isEditing}>
              {isEditing ? (
                <Input
                  value={draft.targetPrice}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      targetPrice: event.target.value,
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
                    setDraft((current) => ({
                      ...current,
                      quantity: Number(event.target.value),
                    }))
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
              {isEditing ? (
                <Input
                  value={draft.estimatedSpend}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      estimatedSpend: event.target.value,
                    }))
                  }
                  className="h-9 rounded-[10px] border-[#243047] bg-[#0B1220] text-[14px] text-[#E5E7EB]"
                />
              ) : (
                <FieldValue>{fields.estimatedSpend}</FieldValue>
              )}
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

        <section className="rounded-[12px] border border-[#243047] bg-[#172033] p-4">
          <p className="text-[12px] font-medium text-[#C4B5FD]">
            After approval Z.AI will automate:
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {automationPlan.map((step) => (
              <div
                key={step}
                className="flex gap-2 text-[12px] leading-5 text-[#9CA3AF]"
              >
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#8B5CF6]" />
                {step}
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-[520px] text-[12px] leading-5 text-[#9CA3AF]">
            On <span className="font-medium text-[#C4B5FD]">AI Restock</span>,
            Z.AI generates a purchase order PDF, sends it to the supplier, and
            opens a conversation to run the negotiation loop unless interrupted.
          </p>
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
                  className="h-9 rounded-[10px] bg-[#3B82F6] px-4 text-white hover:bg-[#2563EB]"
                >
                  <Save className="size-4" aria-hidden="true" />
                  Save changes
                </Button>
              </>
            ) : (
              <>
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
                  disabled={workflowStarted}
                  className="h-10 rounded-[10px] bg-[#3B82F6] px-4 text-white hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:bg-[#3B82F6]/60"
                >
                  {workflowStarted ? (
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

      </CardContent>
    </Card>
  )
}

type CompactWorkflowProgressProps = {
  steps: readonly string[]
  activeStep: number
  stopIndex: number
  productName?: string
  conversationId?: string
}

export function CompactWorkflowProgress({
  steps,
  activeStep,
  stopIndex,
  productName,
  conversationId,
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
              Restock in Progress
            </p>
            {productName ? (
              <p className="mt-0.5 truncate text-[12px] leading-4 text-[#9CA3AF]">
                {productName}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[11px] text-[#9CA3AF]">
          <Loader2
            className="size-3 animate-spin text-[#8B5CF6]"
            aria-hidden="true"
          />
          {conversationId ? `Conv · ${conversationId}` : "In progress"}
        </div>
      </div>

      <div className="mt-7 flex w-full items-start justify-between">
        {steps.map((label, index) => {
          const isCompleted = index < activeStep
          const isActive = index === activeStep
          const isWaitingStep = isActive && activeStep === stopIndex
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
                    Waiting for supplier response…
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
