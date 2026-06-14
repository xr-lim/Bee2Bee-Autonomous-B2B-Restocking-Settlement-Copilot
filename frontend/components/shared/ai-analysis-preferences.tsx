"use client"

import { CalendarClock, Clock3, LogIn, Settings2 } from "lucide-react"
import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  type AiAnalysisCadence,
  type AiAnalysisMode,
  type AiAnalysisPreferences as AiAnalysisPreferencesState,
  type AiAnalysisScope,
  analyzeRestockSuggestionsAction,
  analyzeThresholdsAction,
  getAiAnalysisPreferencesAction,
  markAiAnalysisRunAction,
  saveAiAnalysisPreferencesAction,
} from "@/lib/actions"
import { cn } from "@/lib/utils"

const LOGIN_RUN_KEY = "bee2bee.aiAnalysisLoginRun"

const defaultPreferences: AiAnalysisPreferencesState = {
  mode: "manual",
  cadence: "daily",
  scope: "both",
  lastRunAt: null,
}

const cadenceMs: Record<AiAnalysisCadence, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
}

const modeOptions: Array<{
  value: AiAnalysisMode
  label: string
  description: string
  icon: typeof Settings2
}> = [
  {
    value: "manual",
    label: "Manual only",
    description: "The user starts threshold or stock analysis from Settings.",
    icon: Settings2,
  },
  {
    value: "on-login",
    label: "Once on login",
    description: "Run one analysis pass when the workspace opens for the session.",
    icon: LogIn,
  },
  {
    value: "scheduled",
    label: "Auto by period",
    description: "Run when the chosen period has elapsed and the workspace is open.",
    icon: CalendarClock,
  },
]

async function runConfiguredAnalysis(scope: AiAnalysisScope) {
  if (scope === "threshold") {
    const result = await analyzeThresholdsAction()
    if (!result.ok) throw new Error(result.message ?? "Threshold analysis failed.")
    return
  }

  if (scope === "restock") {
    const result = await analyzeRestockSuggestionsAction()
    if (!result.ok) throw new Error(result.message ?? "Restock analysis failed.")
    return
  }

  const thresholdResult = await analyzeThresholdsAction()
  if (!thresholdResult.ok) {
    throw new Error(thresholdResult.message ?? "Threshold analysis failed.")
  }

  const restockResult = await analyzeRestockSuggestionsAction()
  if (!restockResult.ok) {
    throw new Error(restockResult.message ?? "Restock analysis failed.")
  }
}

export function AiAnalysisPreferences({
  initialPreferences = defaultPreferences,
}: {
  initialPreferences?: AiAnalysisPreferencesState
}) {
  const router = useRouter()
  const [preferences, setPreferences] =
    useState<AiAnalysisPreferencesState>(initialPreferences)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const activeMode = useMemo(
    () => modeOptions.find((option) => option.value === preferences.mode),
    [preferences.mode]
  )

  function updatePreferences(next: Partial<AiAnalysisPreferencesState>) {
    setStatusMessage(null)
    setError(null)
    setPreferences((current) => ({ ...current, ...next }))
  }

  function handleSave() {
    setStatusMessage(null)
    setError(null)
    startTransition(async () => {
      const result = await saveAiAnalysisPreferencesAction({
        mode: preferences.mode,
        cadence: preferences.cadence,
        scope: preferences.scope,
      })
      if (!result.ok) {
        setError(result.message ?? "Could not save preferences.")
        return
      }
      setStatusMessage(result.message ?? "Saved.")
      window.dispatchEvent(new Event("bee2bee-ai-analysis-preferences-updated"))
      router.refresh()
    })
  }

  function handleRunNow() {
    setStatusMessage(null)
    setError(null)
    startTransition(async () => {
      try {
        await runConfiguredAnalysis(preferences.scope)
        await markAiAnalysisRunAction()
        setPreferences((current) => ({
          ...current,
          lastRunAt: new Date().toISOString(),
        }))
        setStatusMessage("Analysis completed.")
        router.refresh()
      } catch (analysisError) {
        setError(
          analysisError instanceof Error
            ? analysisError.message
            : "Analysis failed."
        )
      }
    })
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        {modeOptions.map((option) => {
          const Icon = option.icon
          const selected = preferences.mode === option.value

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => updatePreferences({ mode: option.value })}
              className={cn(
                "rounded-[14px] border p-4 text-left transition-colors",
                selected
                  ? "border-[#3B82F6]/70 bg-[#3B82F6]/10"
                  : "border-[#243047] bg-[#172033] hover:border-[#3B82F6]/40"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-[10px] bg-[#0B1220] text-[#93C5FD]">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="text-[14px] font-semibold text-[#E5E7EB]">
                  {option.label}
                </span>
              </div>
              <p className="mt-3 text-[12px] leading-5 text-[#9CA3AF]">
                {option.description}
              </p>
            </button>
          )
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-[12px] font-medium uppercase tracking-wider text-[#9CA3AF]">
            Analysis scope
          </span>
          <select
            value={preferences.scope}
            onChange={(event) =>
              updatePreferences({
                scope: event.target.value as AiAnalysisScope,
              })
            }
            className="mt-2 h-10 w-full rounded-[10px] border border-[#243047] bg-[#0B1220] px-3 text-[14px] text-[#E5E7EB] outline-none"
          >
            <option value="both">Threshold + stock restock</option>
            <option value="threshold">Threshold only</option>
            <option value="restock">Stock restock only</option>
          </select>
        </label>

        <label className="block">
          <span className="text-[12px] font-medium uppercase tracking-wider text-[#9CA3AF]">
            Period
          </span>
          <select
            value={preferences.cadence}
            onChange={(event) =>
              updatePreferences({
                cadence: event.target.value as AiAnalysisCadence,
              })
            }
            disabled={preferences.mode !== "scheduled"}
            className="mt-2 h-10 w-full rounded-[10px] border border-[#243047] bg-[#0B1220] px-3 text-[14px] text-[#E5E7EB] outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#243047] bg-[#0B1220] p-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#38BDF8]/10 text-[#7DD3FC]">
            <Clock3 className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[14px] font-semibold text-[#E5E7EB]">
              Current preference: {activeMode?.label ?? "Manual only"}
            </p>
            <p className="mt-1 text-[12px] leading-5 text-[#9CA3AF]">
              {preferences.mode === "scheduled"
                ? `Runs ${preferences.cadence} when due.`
                : preferences.mode === "on-login"
                  ? "Runs once when the workspace opens for this browser session."
                  : "Runs only when the user starts it."}
              {preferences.lastRunAt ? (
                <> Last run: {new Date(preferences.lastRunAt).toLocaleString()}.</>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {statusMessage ? (
            <span className="text-[12px] text-[#86EFAC]">{statusMessage}</span>
          ) : null}
          {error ? (
            <span className="max-w-[220px] text-[12px] text-[#FCA5A5]">
              {error}
            </span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={handleRunNow}
            className="h-9 rounded-[10px] border-[#243047] bg-[#172033] px-3 text-[#E5E7EB] hover:bg-[#243047]"
          >
            {isPending ? "Running..." : "Run now"}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="h-9 rounded-[10px] bg-[#3B82F6] px-3 text-white hover:bg-[#2563EB]"
          >
            Save preference
          </Button>
        </div>
      </div>
    </div>
  )
}

export function AutoAiAnalysisRunner() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false

    async function maybeRun() {
      const preferences = await getAiAnalysisPreferencesAction()
      if (preferences.mode === "manual") return

      const now = Date.now()

      if (preferences.mode === "on-login") {
        if (window.sessionStorage.getItem(LOGIN_RUN_KEY)) return
        window.sessionStorage.setItem(LOGIN_RUN_KEY, "true")
      }

      if (preferences.mode === "scheduled") {
        const lastRunAt = preferences.lastRunAt
          ? new Date(preferences.lastRunAt).getTime()
          : 0
        if (
          Number.isFinite(lastRunAt) &&
          lastRunAt > 0 &&
          now - lastRunAt < cadenceMs[preferences.cadence]
        ) {
          return
        }
      }

      try {
        await runConfiguredAnalysis(preferences.scope)
        if (cancelled) return
        await markAiAnalysisRunAction()
        router.refresh()
      } catch {
        // Keep the run due so the operator can fix configuration and try again.
      }
    }

    void maybeRun()

    const handlePreferenceUpdate = () => {
      void maybeRun()
    }
    window.addEventListener(
      "bee2bee-ai-analysis-preferences-updated",
      handlePreferenceUpdate
    )

    return () => {
      cancelled = true
      window.removeEventListener(
        "bee2bee-ai-analysis-preferences-updated",
        handlePreferenceUpdate
      )
    }
  }, [router])

  return null
}
