"use client"

import { useEffect, useState } from "react"
import {
  Bot,
  CheckCircle2,
  Loader2,
  TerminalSquare,
  TriangleAlert,
} from "lucide-react"

type ThresholdReasoningItem = {
  sku: string
  productName?: string
  status: string
  detail?: string
  currentThreshold?: number | null
  proposedThreshold?: number | null
  confidence?: number | null
  trace?: Array<{
    kind: string
    message: string
    toolName?: string
    toolInput?: unknown
    toolSummary?: string
    decision?: unknown
    proposedThreshold?: number
    requestId?: string
  }>
}

type DashboardThresholdReasoningTerminalProps = {
  items: ThresholdReasoningItem[]
  isRunning?: boolean
  message?: string
  error?: string
  title?: string
  analysisType?: "threshold" | "restock"
}

function formatStatus(status: string) {
  switch (status) {
    case "request_created":
      return "REQUEST_CREATED"
    case "no_change_recommended":
      return "NO_CHANGE"
    case "skipped_existing_pending_request":
      return "SKIPPED_PENDING"
    case "skipped_existing":
      return "SKIPPED_EXISTING"
    case "analysis_failed":
      return "ANALYSIS_FAILED"
    default:
      return status.toUpperCase()
  }
}

export function DashboardThresholdReasoningTerminal({
  items,
  isRunning = false,
  message,
  error,
  title = "Reasoning Terminal",
  analysisType = "threshold",
}: DashboardThresholdReasoningTerminalProps) {
  const [renderedAt, setRenderedAt] = useState("SYNC PENDING")

  useEffect(() => {
    setRenderedAt(
      new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    )
  }, [items, isRunning, message, error, analysisType])

  return (
    <div className="panel-surface-muted rounded-3xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#22304A] pb-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl border border-[#38BDF8]/20 bg-[#38BDF8]/10 text-[#7DD3FC]">
            <TerminalSquare className="size-4.5" aria-hidden="true" />
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#7DD3FC]">
              {title}
            </p>
            <p className="mt-1 text-[12px] text-[#94A3B8]">
              {isRunning
                ? `Agent is currently performing ${analysisType} analysis...`
                : `Results for ${analysisType === "threshold" ? "threshold review" : "restock suggestion"} steps.`}
            </p>
          </div>
        </div>
        <p className="font-mono text-[11px] text-[#64748B]">{renderedAt}</p>
      </div>

      <div className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1 font-mono text-[12px] leading-5 text-[#D1D5DB]">
        {isRunning ? (
          <div className="rounded-2xl border border-[#38BDF8]/20 bg-[#0F172A] px-4 py-3">
            <p className="flex items-center gap-2 text-[#7DD3FC]">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              {">"} starting {analysisType} analysis...
            </p>
            <p className="mt-1 text-[#94A3B8]">
              {analysisType === "threshold"
                ? "scanning all eligible SKUs, reading demand history, and checking current thresholds"
                : "scanning all low-stock SKUs, checking demand trends and supplier lead times"}
            </p>
          </div>
        ) : null}

        {!isRunning && error ? (
          <div className="rounded-2xl border border-[#EF4444]/20 bg-[#1A1220] px-4 py-3">
            <p className="flex items-center gap-2 text-[#FCA5A5]">
              <TriangleAlert className="size-3.5" aria-hidden="true" />
              {">"} analysis failed
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[#FECACA]">{error}</p>
          </div>
        ) : null}

        {!isRunning && !error && items.length === 0 ? (
          <div className="rounded-2xl border border-[#22304A] bg-[#0F172A] px-4 py-3">
            <p className="flex items-center gap-2 text-[#7DD3FC]">
              <Bot className="size-3.5" aria-hidden="true" />
              {">"} terminal ready
            </p>
            <p className="mt-1 text-[#94A3B8]">
              click {analysisType === "threshold" ? "Analyze" : "Suggest"} to show the model reasoning
            </p>
          </div>
        ) : null}

        {!isRunning && items.some((item) => item.status === "request_created") && (
          <div className="rounded-2xl border border-[#10B981]/20 bg-[#0F172A] px-4 py-3">
            <p className="flex items-center gap-2 text-[#86EFAC]">
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              {">"} Stock request created for:
            </p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-[#E5E7EB]">
              {items
                .filter((item) => item.status === "request_created")
                .map((item) => (
                  <li key={item.sku} className="text-[13px]">
                    <span className="font-semibold text-[#F8FAFC]">
                      {item.productName || "Unknown Product"}
                    </span>{" "}
                    <span className="text-[#94A3B8]">({item.sku})</span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {!isRunning &&
          items
            .filter((item) => item.status !== "request_created")
            .map((item) => (
              <div
                key={`${item.sku}-${item.status}`}
                className="rounded-2xl border border-[#22304A] bg-[#0F172A] px-4 py-3"
              >
                <p className="text-[#7DD3FC]">
                  {">"} {item.sku} [{formatStatus(item.status)}]
                </p>
                {item.detail ? (
                  <p className="mt-1 whitespace-pre-wrap text-[#94A3B8]">
                    {item.detail}
                  </p>
                ) : null}
              </div>
            ))}

        {!isRunning && !error && message ? (
          <div className="rounded-2xl border border-[#10B981]/20 bg-[#0F172A] px-4 py-3">
            <p className="flex items-center gap-2 text-[#86EFAC]">
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              {">"} run summary
            </p>
            <p className="mt-1 text-[#E5E7EB]">{message}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
