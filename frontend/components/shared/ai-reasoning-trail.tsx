"use client"

import {
  Activity,
  AlertTriangle,
  Bot,
  ChevronDown,
  Clock,
  DollarSign,
  FileSearch,
  History,
  Languages,
  Package,
  Sparkles,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useId, useState } from "react"

import { cn } from "@/lib/utils"

export type ReasoningSignalKind =
  | "promotion"
  | "lead-time"
  | "stockout"
  | "price"
  | "bundle"
  | "velocity-up"
  | "velocity-down"
  | "language"
  | "history"
  | "field"
  | "signal"

export type ReasoningSignalTone = "positive" | "neutral" | "risk" | "ai"

export type ReasoningSignal = {
  kind: ReasoningSignalKind
  label: string
  detail: string
  tone?: ReasoningSignalTone
}

type AiReasoningTrailProps = {
  signals: ReasoningSignal[]
  confidence?: number
  decision?: string
  prompt?: string
  emptyHint?: string
  density?: "cozy" | "compact"
  defaultOpen?: boolean
  className?: string
  id?: string
}

const iconMap: Record<ReasoningSignalKind, LucideIcon> = {
  promotion: Sparkles,
  "lead-time": Clock,
  stockout: AlertTriangle,
  price: DollarSign,
  bundle: Package,
  "velocity-up": TrendingUp,
  "velocity-down": TrendingDown,
  language: Languages,
  history: History,
  field: FileSearch,
  signal: Activity,
}

const toneClassName: Record<ReasoningSignalTone, string> = {
  positive: "bg-[#10B981]/15 text-[#34D399] border-[#10B981]/30",
  neutral: "bg-[#243047] text-[#CBD5E1] border-[#2E3B55]",
  risk: "bg-[#EF4444]/15 text-[#F87171] border-[#EF4444]/30",
  ai: "bg-[#8B5CF6]/15 text-[#C4B5FD] border-[#8B5CF6]/30",
}

export function AiReasoningTrail({
  signals,
  confidence,
  decision,
  prompt = "Why did AI decide this?",
  emptyHint = "Z.AI did not record any input signals for this decision.",
  density = "cozy",
  defaultOpen = false,
  className,
  id,
}: AiReasoningTrailProps) {
  const [open, setOpen] = useState(defaultOpen)
  const generatedId = useId()
  const panelId = `reasoning-${id ?? generatedId}`

  const isCompact = density === "compact"
  const buttonPadding = isCompact ? "px-3 py-2" : "px-3.5 py-2.5"
  const panelPadding = isCompact ? "p-3" : "p-4"
  const gapY = isCompact ? "gap-y-2.5" : "gap-y-3"

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[12px] border border-[#8B5CF6]/25 bg-[#8B5CF6]/5",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "flex w-full items-center justify-between gap-3 text-left transition-colors hover:bg-[#8B5CF6]/10",
          buttonPadding
        )}
      >
        <div className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-[8px] bg-[#8B5CF6]/15">
            <Bot className="size-3.5 text-[#C4B5FD]" aria-hidden="true" />
          </span>
          <span className="text-[13px] font-medium text-[#C4B5FD]">
            {prompt}
          </span>
          {typeof confidence === "number" ? (
            <span className="ml-1 rounded-[6px] border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 px-1.5 py-0.5 font-mono text-[11px] text-[#C4B5FD]">
              {confidence}% conf
            </span>
          ) : null}
        </div>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-[#C4B5FD] transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
              opacity: { duration: 0.15 },
            }}
            style={{ overflow: "hidden" }}
          >
            <div
              className={cn(
                "border-t border-[#8B5CF6]/20 bg-[#0B1220]/60",
                panelPadding
              )}
            >
              {decision ? (
                <div className="mb-3 rounded-[10px] border border-[#243047] bg-[#111827] px-3 py-2">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#6B7280]">
                    Decision
                  </p>
                  <p className="mt-1 text-[13px] leading-5 text-[#E5E7EB]">
                    {decision}
                  </p>
                </div>
              ) : null}

              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[#6B7280]">
                Input signals used ({signals.length})
              </p>

              {signals.length === 0 ? (
                <p className="text-[12px] text-[#6B7280]">{emptyHint}</p>
              ) : (
                <ul className={cn("grid grid-cols-1", gapY)}>
                  {signals.map((signal, index) => {
                    const Icon = iconMap[signal.kind] ?? Activity
                    const tone = signal.tone ?? "neutral"
                    return (
                      <motion.li
                        key={`${signal.kind}-${index}-${signal.label}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: 0.04 + index * 0.035,
                          duration: 0.2,
                        }}
                        className="flex items-start gap-2.5"
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-[6px] border",
                            toneClassName[tone]
                          )}
                        >
                          <Icon className="size-3.5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium leading-5 text-[#E5E7EB]">
                            {signal.label}
                          </p>
                          <p className="mt-0.5 text-[12px] leading-5 text-[#9CA3AF]">
                            {signal.detail}
                          </p>
                        </div>
                      </motion.li>
                    )
                  })}
                </ul>
              )}

              {typeof confidence === "number" ? (
                <div className="mt-4 border-t border-[#243047] pt-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-[#6B7280]">
                      Confidence
                    </span>
                    <span className="font-mono text-[12px] font-semibold text-[#E5E7EB]">
                      {confidence}%
                    </span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-[#172033]"
                    role="progressbar"
                    aria-valuenow={confidence}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <motion.div
                      className="h-full bg-[#8B5CF6]"
                      initial={{ width: 0 }}
                      animate={{ width: `${confidence}%` }}
                      transition={{
                        delay: 0.08,
                        duration: 0.4,
                        ease: "easeOut",
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
