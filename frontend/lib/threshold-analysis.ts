export type ThresholdReasoningTraceItem = {
  kind: string
  message: string
  toolName?: string
  toolInput?: unknown
  toolSummary?: string
  decision?: unknown
  proposedThreshold?: number
  requestId?: string
}

export type ThresholdReasoningItem = {
  sku: string
  productName?: string
  status: string
  detail?: string
  currentThreshold?: number | null
  proposedThreshold?: number | null
  confidence?: number | null
  trace?: ThresholdReasoningTraceItem[]
}

export type ThresholdAnalysisResult = {
  ok: boolean
  message?: string
  analyzedCount?: number
  createdCount?: number
  results?: ThresholdReasoningItem[]
}

function backendApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_BACKEND_API_URL ??
    process.env.BACKEND_API_URL ??
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "")
}

function describeFetchFailure(url: string, error: unknown) {
  if (!(error instanceof Error)) {
    return `Unable to reach the threshold analysis backend at ${url}.`
  }

  if (/fetch failed/i.test(error.message)) {
    return `Unable to reach the threshold analysis backend at ${url}. Check that the backend is running and NEXT_PUBLIC_BACKEND_API_URL points to it.`
  }

  return error.message
}

export async function analyzeThresholds(
  skus?: string[]
): Promise<ThresholdAnalysisResult> {
  const url = `${backendApiBaseUrl()}/api/v1/ai/threshold-analysis/run`

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        skus: skus && skus.length > 0 ? skus : undefined,
      }),
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const detail =
        payload && typeof payload === "object" && "detail" in payload
          ? String(payload.detail)
          : "Threshold analysis request failed."
      throw new Error(detail)
    }

    return {
      ok: true,
      message:
        payload?.created_count > 0
          ? `Created ${payload.created_count} threshold request${payload.created_count === 1 ? "" : "s"}.`
          : "Threshold analysis finished with no new requests.",
      analyzedCount: payload?.analyzed_count,
      createdCount: payload?.created_count,
      results: (payload?.results ?? []).map((item: any) => ({
        sku: item.sku,
        productName: item.product_name,
        status: item.status,
        detail: item.detail,
        currentThreshold:
          typeof item.current_threshold === "number" ? item.current_threshold : null,
        proposedThreshold:
          typeof item.proposed_threshold === "number" ? item.proposed_threshold : null,
        confidence: typeof item.confidence === "number" ? item.confidence : null,
        trace: Array.isArray(item.trace)
          ? item.trace.map((event) => ({
              kind: typeof event?.kind === "string" ? event.kind : "event",
              message: typeof event?.message === "string" ? event.message : "",
              toolName:
                typeof event?.tool_name === "string" ? event.tool_name : undefined,
              toolInput: event?.tool_input,
              toolSummary:
                typeof event?.tool_summary === "string"
                  ? event.tool_summary
                  : undefined,
              decision: event?.decision,
              proposedThreshold:
                typeof event?.proposed_threshold === "number"
                  ? event.proposed_threshold
                  : undefined,
              requestId:
                typeof event?.request_id === "string" ? event.request_id : undefined,
            }))
          : [],
      })),
    }
  } catch (error) {
    return {
      ok: false,
      message: describeFetchFailure(url, error),
    }
  }
}

export async function analyzeRestockSuggestions(): Promise<ThresholdAnalysisResult> {
  const url = `${backendApiBaseUrl()}/api/v1/ai/restock-analysis/run`

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    })

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const detail =
        payload && typeof payload === "object" && "detail" in payload
          ? String(payload.detail)
          : "Restock analysis request failed."
      throw new Error(detail)
    }

    return {
      ok: true,
      message:
        payload?.created_count > 0
          ? `Created ${payload.created_count} restock request${payload.created_count === 1 ? "" : "s"}.`
          : "Restock analysis finished with no new requests.",
      analyzedCount: payload?.analyzed_count,
      createdCount: payload?.created_count,
      results: (payload?.results ?? []).map((item: any) => ({
        sku: item.sku,
        productName: item.product_name,
        status: item.status,
        detail: item.detail,
        trace: Array.isArray(item.trace)
          ? item.trace.map((event: any) => ({
              kind: typeof event?.kind === "string" ? event.kind : "event",
              message: typeof event?.message === "string" ? event.message : "",
              toolName:
                typeof event?.tool_name === "string" ? event.tool_name : undefined,
              toolInput: event?.tool_input,
              toolSummary:
                typeof event?.tool_summary === "string"
                  ? event.tool_summary
                  : undefined,
              decision: event?.decision,
              requestId:
                typeof event?.request_id === "string" ? event.request_id : undefined,
            }))
          : [],
      })),
    }
  } catch (error) {
    return {
      ok: false,
      message: describeFetchFailure(url, error),
    }
  }
}
