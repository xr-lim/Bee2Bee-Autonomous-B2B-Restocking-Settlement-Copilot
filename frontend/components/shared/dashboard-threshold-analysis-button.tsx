"use client"

import { Bot, Loader2, PackagePlus, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { DashboardThresholdReasoningTerminal } from "@/components/shared/dashboard-threshold-reasoning-terminal"
import { Button } from "@/components/ui/button"
import {
  type ThresholdReasoningItem,
} from "@/lib/threshold-analysis"
import {
  analyzeRestockSuggestionsAction,
  analyzeThresholdsAction,
} from "@/lib/actions"


export function DashboardThresholdAnalysisButton() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRestockSubmitting, setIsRestockSubmitting] = useState(false)
  const [analysisType, setAnalysisType] = useState<"threshold" | "restock">("threshold")
  const [message, setMessage] = useState<string>()
  const [error, setError] = useState<string>()
  const [reasoningItems, setReasoningItems] = useState<ThresholdReasoningItem[]>([])

  async function handleClick() {
    if (isSubmitting) return

    setIsSubmitting(true)
    setAnalysisType("threshold")
    setMessage(undefined)
    setError(undefined)

    const result = await analyzeThresholdsAction()

    if (!result.ok) {
      setReasoningItems([])
      setError(result.message ?? "Unable to analyze thresholds.")
      setIsSubmitting(false)
      return
    }

    setReasoningItems(result.results ?? [])

    setMessage(
      result.createdCount && result.createdCount > 0
        ? `Analyzed ${result.analyzedCount ?? 0} SKU${result.analyzedCount === 1 ? "" : "s"} and created ${result.createdCount} request${result.createdCount === 1 ? "" : "s"}.`
        : `Analyzed ${result.analyzedCount ?? 0} SKU${result.analyzedCount === 1 ? "" : "s"} with no new threshold request.`
    )
    router.refresh()
    setIsSubmitting(false)
  }

  async function handleRestockClick() {
    if (isRestockSubmitting || isSubmitting) return

    setIsRestockSubmitting(true)
    setAnalysisType("restock")
    setMessage(undefined)
    setError(undefined)

    const result = await analyzeRestockSuggestionsAction()

    if (!result.ok) {
      setReasoningItems([])
      setError(result.message ?? "Unable to analyze restock suggestions.")
      setIsRestockSubmitting(false)
      return
    }

    setReasoningItems(result.results ?? [])

    setMessage(
      result.createdCount && result.createdCount > 0
        ? `Analyzed ${result.analyzedCount ?? 0} SKU${result.analyzedCount === 1 ? "" : "s"} and created ${result.createdCount} restock request${result.createdCount === 1 ? "" : "s"}.`
        : `Analyzed ${result.analyzedCount ?? 0} SKU${result.analyzedCount === 1 ? "" : "s"} with no new restock suggestion.`
    )
    router.refresh()
    setIsRestockSubmitting(false)
  }

  return (
    <div className="flex flex-col items-stretch gap-4">
      <div className="panel-surface-muted rounded-3xl p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#7DD3FC]">
              AI Workflow Controls
            </p>
            <h3 className="mt-2 text-[18px] font-semibold text-[#F8FAFC]">
              Launch agent actions
            </h3>
            <p className="mt-1 text-[14px] leading-6 text-[#94A3B8]">
              Run analysis jobs without leaving the command center.
            </p>
          </div>
          <div className="rounded-2xl border border-[#FACC15]/20 bg-[#FACC15]/10 p-2 text-[#FCD34D]">
            <Sparkles className="size-4" aria-hidden="true" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            onClick={handleClick}
            disabled={isSubmitting}
            variant="outline"
            className="h-12 justify-center rounded-2xl border-[#38BDF8]/30 bg-[#0F2740] px-4 text-[14px] font-semibold text-[#E0F2FE] hover:border-[#38BDF8]/60 hover:bg-[#143252] disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Bot className="size-4" aria-hidden="true" />
            )}
            {isSubmitting ? "Analyzing..." : "Analyze"}
          </Button>
          <Button
            type="button"
            onClick={handleRestockClick}
            disabled={isRestockSubmitting || isSubmitting}
            variant="outline"
            className="h-12 justify-center rounded-2xl border-[#FACC15]/30 bg-[#2A2109] px-4 text-[14px] font-semibold text-[#FEF3C7] hover:border-[#FACC15]/60 hover:bg-[#3A2D08] disabled:cursor-not-allowed"
          >
            {isRestockSubmitting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <PackagePlus className="size-4" aria-hidden="true" />
            )}
            {isRestockSubmitting ? "Analyzing..." : "Suggest"}
          </Button>
        </div>
      </div>
      {message ? (
        <p className="rounded-2xl border border-[#38BDF8]/15 bg-[#38BDF8]/8 px-4 py-3 text-center text-[12px] leading-5 text-[#93C5FD]">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-2xl border border-[#EF4444]/15 bg-[#EF4444]/8 px-4 py-3 text-center text-[12px] leading-5 text-[#FCA5A5]">
          {error}
        </p>
      ) : null}
      <DashboardThresholdReasoningTerminal
        items={reasoningItems}
        isRunning={isSubmitting || isRestockSubmitting}
        message={message}
        error={error}
        title={analysisType === "threshold" ? "Threshold Agent Panel" : "Restock Agent Panel"}
        analysisType={analysisType}
      />
    </div>
  )
}
