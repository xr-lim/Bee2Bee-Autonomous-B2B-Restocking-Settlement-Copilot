"use server"

import { revalidatePath } from "next/cache"

import { getSupabaseServerClient } from "@/lib/supabase/server"

type ActionResult = {
  ok: boolean
  message?: string
}

type ThresholdAnalysisActionResult = ActionResult & {
  analyzedCount?: number
  createdCount?: number
  results?: Array<{
    sku: string
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
  }>
}

type ProductPayload = {
  sku: string
  name: string
  category: string
  supplierId: string
  unitCost: number
  initialStock: number
  initialThreshold: number
  maxCapacity: number
}

type ProductUpdatePayload = {
  productId: string
  sku: string
  stockOnHand: number
  unitCost: number
  currentThreshold: number
  supplierId: string
  trackedSupplierIds: string[]
}

type SupplierPayload = {
  supplierId?: string
  name: string
  region: string
  leadTimeDays: number
  reliabilityScore: number
  status: "preferred" | "watchlist" | "inactive"
}

type ThresholdDecisionPayload = {
  requestId: string
  decision: "approved" | "rejected"
  proposedThreshold: number
  reason: string
}

type ThresholdUpdatePayload = {
  requestId: string
  proposedThreshold: number
  reason: string
}

type InvoiceDecisionPayload = {
  invoiceId: string
  decision: "approve" | "hold" | "block" | "complete"
}

type StartRestockWorkflowPayload = {
  productId: string
  sku: string
}

type CreateRestockRequestPayload = {
  productId: string
  sku: string
}

type CancelRestockRequestPayload = {
  requestId: string
  sku: string
}

type DeleteRestockRequestPayload = {
  requestId: string
  sku: string
}

type MarkRestockRequestReviewedPayload = {
  requestId: string
  sku: string
}

type UpdateRestockRequestPayload = {
  requestId: string
  sku: string
  targetPrice: string
  quantity: number
  reason: string
  supplierId?: string
}

function requireSupabase() {
  const supabase = getSupabaseServerClient()
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    )
  }
  return supabase
}

function backendApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_BACKEND_API_URL ??
    process.env.BACKEND_API_URL ??
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "")
}

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`
}

const NEAR_THRESHOLD_BUFFER = 20

function stockStatus(stock: number, threshold: number) {
  if (stock < threshold) return "below_threshold"
  if (stock - threshold <= NEAR_THRESHOLD_BUFFER) return "near_threshold"
  return "healthy"
}

function cleanText(value: string) {
  return value.trim()
}

function parseTargetPriceRange(input: string): {
  min: number | null
  max: number | null
} {
  const cleaned = cleanText(input)
  if (!cleaned || /pending/i.test(cleaned)) {
    return { min: null, max: null }
  }

  const matches = cleaned.match(/\d+(?:\.\d+)?/g) ?? []
  if (matches.length === 0) {
    throw new Error("Target price must contain a valid number or range.")
  }

  const values = matches.map((item) => Number(item))
  if (values.some((value) => Number.isNaN(value))) {
    throw new Error("Target price contains an invalid number.")
  }

  if (values.length === 1) {
    return { min: values[0], max: values[0] }
  }

  return {
    min: Math.min(values[0], values[1]),
    max: Math.max(values[0], values[1]),
  }
}

function success(message?: string): ActionResult {
  return { ok: true, message }
}

function failure(error: unknown): ActionResult {
  return {
    ok: false,
    message: error instanceof Error ? error.message : "Unexpected database error.",
  }
}

async function throwIfSupabaseError<T>(
  result: { data: T; error: { message: string } | null }
) {
  if (result.error) {
    throw new Error(result.error.message)
  }
  return result.data
}

function revalidateProductPaths(sku?: string) {
  revalidatePath("/")
  revalidatePath("/dashboard")
  revalidatePath("/inventory")
  revalidatePath("/suppliers")
  if (sku) revalidatePath(`/inventory/${sku}`)
}

export async function analyzeThresholdsAction(
  skus?: string[]
): Promise<ThresholdAnalysisActionResult> {
  try {
    const response = await fetch(
      `${backendApiBaseUrl()}/api/v1/ai/threshold-analysis/run`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          skus: skus && skus.length > 0 ? skus : undefined,
        }),
      }
    )

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const detail =
        payload && typeof payload === "object" && "detail" in payload
          ? String(payload.detail)
          : "Threshold analysis request failed."
      throw new Error(detail)
    }

    revalidatePath("/")
    revalidatePath("/dashboard")
    revalidatePath("/inventory")
    for (const result of payload?.results ?? []) {
      if (result?.sku) {
        revalidatePath(`/inventory/${result.sku}`)
      }
    }

    return {
      ok: true,
      message:
        payload?.created_count > 0
          ? `Created ${payload.created_count} threshold request${payload.created_count === 1 ? "" : "s"}.`
          : "Threshold analysis finished with no new requests.",
      analyzedCount: payload?.analyzed_count,
      createdCount: payload?.created_count,
      results: (payload?.results ?? []).map((item: { sku: string; status: string; detail?: string; current_threshold?: any; proposed_threshold?: any; confidence?: any; trace?: any[] }) => ({
        sku: item.sku,
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
      message: error instanceof Error ? error.message : "Threshold analysis failed.",
    }
  }
}

export async function analyzeRestockSuggestionsAction(): Promise<ThresholdAnalysisActionResult> {
  try {
    const response = await fetch(
      `${backendApiBaseUrl()}/api/v1/ai/restock-analysis/run`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    )

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      const detail =
        payload && typeof payload === "object" && "detail" in payload
          ? String(payload.detail)
          : "Restock analysis request failed."
      throw new Error(detail)
    }

    revalidatePath("/")
    revalidatePath("/dashboard")
    revalidatePath("/inventory")

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
      message: error instanceof Error ? error.message : "Restock analysis failed.",
    }
  }
}

export async function createProductAction(
  payload: ProductPayload
): Promise<ActionResult> {
  try {
    const supabase = requireSupabase()
    const sku = cleanText(payload.sku).toUpperCase()
    const productId = id("prd")

    if (!sku || !cleanText(payload.name) || !cleanText(payload.category)) {
      throw new Error("SKU, product name, and category are required.")
    }
    if (!payload.supplierId) {
      throw new Error("Choose a primary supplier.")
    }
    if (payload.maxCapacity < payload.initialThreshold) {
      throw new Error("Max capacity must be greater than or equal to the threshold.")
    }

    await throwIfSupabaseError(
      await supabase.from("products").insert({
        id: productId,
        sku,
        name: cleanText(payload.name),
        category: cleanText(payload.category),
        current_stock: payload.initialStock,
        unit_price: payload.unitCost,
        current_threshold: payload.initialThreshold,
        max_capacity: payload.maxCapacity,
        status: stockStatus(payload.initialStock, payload.initialThreshold),
        primary_supplier_id: payload.supplierId,
      })
    )

    await throwIfSupabaseError(
      await supabase.from("product_suppliers").insert({
        id: id("ps"),
        product_id: productId,
        supplier_id: payload.supplierId,
        is_primary: true,
      })
    )

    revalidateProductPaths(sku)
    return success("Product saved.")
  } catch (error) {
    return failure(error)
  }
}

export async function updateProductAction(
  payload: ProductUpdatePayload
): Promise<ActionResult> {
  try {
    const supabase = requireSupabase()
    const trackedSupplierIds = Array.from(
      new Set([payload.supplierId, ...payload.trackedSupplierIds].filter(Boolean))
    )

    if (!payload.productId || !payload.sku) {
      throw new Error("Missing product identifier.")
    }
    if (!payload.supplierId) {
      throw new Error("Choose an active supplier.")
    }

    await throwIfSupabaseError(
      await supabase
        .from("products")
        .update({
          current_stock: payload.stockOnHand,
          unit_price: payload.unitCost,
          current_threshold: payload.currentThreshold,
          status: stockStatus(payload.stockOnHand, payload.currentThreshold),
          primary_supplier_id: payload.supplierId,
        })
        .eq("id", payload.productId)
    )

    const existing = await throwIfSupabaseError(
      await supabase
        .from("product_suppliers")
        .select("id,supplier_id")
        .eq("product_id", payload.productId)
    )
    const existingBySupplier = new Map(
      (existing ?? []).map((row) => [row.supplier_id as string, row.id as string])
    )

    for (const supplierId of trackedSupplierIds) {
      const existingId = existingBySupplier.get(supplierId)
      if (existingId) {
        await throwIfSupabaseError(
          await supabase
            .from("product_suppliers")
            .update({ is_primary: supplierId === payload.supplierId })
            .eq("id", existingId)
        )
      } else {
        await throwIfSupabaseError(
          await supabase.from("product_suppliers").insert({
            id: id("ps"),
            product_id: payload.productId,
            supplier_id: supplierId,
            is_primary: supplierId === payload.supplierId,
          })
        )
      }
    }

    for (const row of existing ?? []) {
      if (!trackedSupplierIds.includes(row.supplier_id as string)) {
        await throwIfSupabaseError(
          await supabase.from("product_suppliers").delete().eq("id", row.id)
        )
      }
    }

    revalidateProductPaths(payload.sku)
    return success("Product updated.")
  } catch (error) {
    return failure(error)
  }
}

export async function createSupplierAction(
  payload: SupplierPayload
): Promise<ActionResult> {
  try {
    const supabase = requireSupabase()

    if (!cleanText(payload.name) || !cleanText(payload.region)) {
      throw new Error("Supplier name and region are required.")
    }
    if (payload.reliabilityScore < 0 || payload.reliabilityScore > 100) {
      throw new Error("Reliability must be between 0 and 100.")
    }

    await throwIfSupabaseError(
      await supabase.from("suppliers").insert({
        id: id("sup"),
        name: cleanText(payload.name),
        region: cleanText(payload.region),
        lead_time_days: payload.leadTimeDays,
        reliability_score: payload.reliabilityScore,
        status: payload.status,
        moq: null,
        notes: "Added from supplier registry.",
      })
    )

    revalidatePath("/suppliers")
    revalidatePath("/inventory")
    revalidatePath("/dashboard")
    return success("Supplier saved.")
  } catch (error) {
    return failure(error)
  }
}

export async function updateSupplierAction(
  payload: SupplierPayload
): Promise<ActionResult> {
  try {
    const supabase = requireSupabase()

    if (!payload.supplierId) {
      throw new Error("Missing supplier identifier.")
    }
    if (!cleanText(payload.name) || !cleanText(payload.region)) {
      throw new Error("Supplier name and region are required.")
    }
    if (payload.reliabilityScore < 0 || payload.reliabilityScore > 100) {
      throw new Error("Reliability must be between 0 and 100.")
    }

    await throwIfSupabaseError(
      await supabase
        .from("suppliers")
        .update({
          name: cleanText(payload.name),
          region: cleanText(payload.region),
          lead_time_days: payload.leadTimeDays,
          reliability_score: payload.reliabilityScore,
          status: payload.status,
        })
        .eq("id", payload.supplierId)
    )

    revalidatePath("/suppliers")
    revalidatePath("/inventory")
    revalidatePath("/dashboard")
    return success("Supplier updated.")
  } catch (error) {
    return failure(error)
  }
}

export async function deleteSupplierAction({
  supplierId,
}: {
  supplierId: string
}): Promise<ActionResult> {
  try {
    const supabase = requireSupabase()

    if (!supplierId) {
      throw new Error("Missing supplier identifier.")
    }

    await throwIfSupabaseError(
      await supabase
        .from("suppliers")
        .delete()
        .eq("id", supplierId)
    )

    revalidatePath("/suppliers")
    revalidatePath("/inventory")
    revalidatePath("/dashboard")
    return success("Supplier deleted.")
  } catch (error) {
    return failure(error)
  }
}

export async function setSupplierAssignmentAction({
  supplierId,
  sku,
  assigned,
}: {
  supplierId: string
  sku: string
  assigned: boolean
}): Promise<ActionResult> {
  try {
    const supabase = requireSupabase()
    const product = await throwIfSupabaseError(
      await supabase
        .from("products")
        .select("id,primary_supplier_id")
        .eq("sku", sku)
        .single()
    )
    if (!product) {
      throw new Error(`No product found for SKU ${sku}.`)
    }

    const existingLinks = await throwIfSupabaseError(
      await supabase
        .from("product_suppliers")
        .select("id,supplier_id,is_primary")
        .eq("product_id", product.id)
    )

    const existing = (existingLinks ?? []).find(
      (link) => link.supplier_id === supplierId
    )

    if (assigned) {
      const shouldBecomePrimary = !product.primary_supplier_id
      if (existing) {
        await throwIfSupabaseError(
          await supabase
            .from("product_suppliers")
            .update({ is_primary: shouldBecomePrimary || existing.is_primary })
            .eq("id", existing.id)
        )
      } else {
        await throwIfSupabaseError(
          await supabase.from("product_suppliers").insert({
            id: id("ps"),
            product_id: product.id,
            supplier_id: supplierId,
            is_primary: shouldBecomePrimary,
          })
        )
      }
      if (shouldBecomePrimary) {
        await throwIfSupabaseError(
          await supabase
            .from("products")
            .update({ primary_supplier_id: supplierId })
            .eq("id", product.id)
        )
      }
    } else if (existing) {
      await throwIfSupabaseError(
        await supabase.from("product_suppliers").delete().eq("id", existing.id)
      )

      if (product.primary_supplier_id === supplierId) {
        const replacement = (existingLinks ?? []).find(
          (link) => link.supplier_id !== supplierId
        )
        await throwIfSupabaseError(
          await supabase
            .from("products")
            .update({ primary_supplier_id: replacement?.supplier_id ?? null })
            .eq("id", product.id)
        )
        if (replacement) {
          await throwIfSupabaseError(
            await supabase
              .from("product_suppliers")
              .update({ is_primary: true })
              .eq("id", replacement.id)
          )
        }
      }
    }

    revalidateProductPaths(sku)
    return success("Supplier assignment updated.")
  } catch (error) {
    return failure(error)
  }
}

export async function decideThresholdRequestAction(
  payload: ThresholdDecisionPayload
): Promise<ActionResult> {
  try {
    const supabase = requireSupabase()

    const request = await throwIfSupabaseError(
      await supabase
        .from("threshold_change_requests")
        .select("id,product_id,proposed_threshold")
        .eq("id", payload.requestId)
        .single()
    )
    if (!request) {
      throw new Error("Threshold request no longer exists.")
    }

    const product = await throwIfSupabaseError(
      await supabase
        .from("products")
        .select("id,sku,current_stock")
        .eq("id", request.product_id)
        .single()
    )
    if (!product) {
      throw new Error("Product for this threshold request no longer exists.")
    }

    if (payload.decision === "approved") {
      await throwIfSupabaseError(
        await supabase
          .from("products")
          .update({
            current_threshold: payload.proposedThreshold,
            status: stockStatus(product.current_stock, payload.proposedThreshold),
          })
          .eq("id", product.id)
      )
    }

    await throwIfSupabaseError(
      await supabase
        .from("threshold_change_requests")
        .delete()
        .eq("id", payload.requestId)
    )

    revalidateProductPaths(product.sku)
    return success(
      payload.decision === "approved"
        ? "Threshold applied and request cleared."
        : "Threshold request rejected and cleared."
    )
  } catch (error) {
    return failure(error)
  }
}

export async function updateThresholdRequestAction(
  payload: ThresholdUpdatePayload
): Promise<ActionResult> {
  try {
    const supabase = requireSupabase()
    const request = await throwIfSupabaseError(
      await supabase
        .from("threshold_change_requests")
        .select("id,product_id")
        .eq("id", payload.requestId)
        .single()
    )
    if (!request) {
      throw new Error("Threshold request no longer exists.")
    }

    await throwIfSupabaseError(
      await supabase
        .from("threshold_change_requests")
        .update({
          proposed_threshold: payload.proposedThreshold,
          reason_summary: cleanText(payload.reason),
        })
        .eq("id", payload.requestId)
    )

    const product = await throwIfSupabaseError(
      await supabase
        .from("products")
        .select("sku")
        .eq("id", request.product_id)
        .single()
    )

    revalidateProductPaths(product?.sku)
    return success("Threshold request updated.")
  } catch (error) {
    return failure(error)
  }
}

export async function startRestockWorkflowAction(
  payload: StartRestockWorkflowPayload
): Promise<ActionResult> {
  try {
    const supabase = requireSupabase()

    if (!payload.productId || !payload.sku) {
      throw new Error("Missing product identifier.")
    }

    const existingWorkflows = await throwIfSupabaseError(
      await supabase
        .from("workflows")
        .select("id,quantity")
        .eq("product_id", payload.productId)
        .order("updated_at", { ascending: false })
        .limit(1)
    )
    const existingWorkflow = (existingWorkflows ?? [])[0]
    const product = await throwIfSupabaseError(
      await supabase
        .from("products")
        .select("id,current_stock,current_threshold")
        .eq("id", payload.productId)
        .single()
    )

    if (!product) {
      throw new Error("Product no longer exists.")
    }

    let workflowId = existingWorkflow?.id as string | undefined
    const requestedQuantity =
      (existingWorkflow?.quantity as number | null | undefined) ??
      Math.max(
        Number(product.current_threshold) - Number(product.current_stock),
        Number(product.current_threshold)
      )

    if (workflowId) {
      await throwIfSupabaseError(
        await supabase
          .from("workflows")
          .update({
            current_state: "po_sent",
            approval_state: "waiting_approval",
            quantity: requestedQuantity,
          })
          .eq("id", workflowId)
      )
    } else {
      const workflow = await throwIfSupabaseError(
        await supabase
          .from("workflows")
          .insert({
            id: id("wf"),
            product_id: payload.productId,
            current_state: "po_sent",
            approval_state: "waiting_approval",
            quantity: requestedQuantity,
          })
          .select("id")
          .single()
      )
      workflowId = workflow?.id as string | undefined
    }

    if (!workflowId) {
      throw new Error("Unable to start restock workflow.")
    }

    const activeRestockRequests = await throwIfSupabaseError(
      await supabase
        .from("restock_requests")
        .select("id,target_price_min,target_price_max")
        .eq("product_id", payload.productId)
        .in("status", ["pending", "reviewed", "accepted"])
        .order("updated_at", { ascending: false })
        .limit(1)
    )
    const activeRestockRequest = (activeRestockRequests ?? [])[0]

    if (activeRestockRequest?.id) {
      await throwIfSupabaseError(
        await supabase
          .from("restock_requests")
          .update({
            workflow_id: workflowId,
            target_price_min: activeRestockRequest.target_price_min ?? null,
            target_price_max: activeRestockRequest.target_price_max ?? null,
            requested_threshold: product.current_threshold,
            requested_quantity: requestedQuantity,
            status: "accepted",
          })
          .eq("id", activeRestockRequest.id)
      )

      await throwIfSupabaseError(
        await supabase
          .from("restock_requests")
          .update({ status: "cancelled" })
          .eq("product_id", payload.productId)
          .in("status", ["pending", "reviewed", "accepted"])
          .neq("id", activeRestockRequest.id)
      )
    } else {
      await throwIfSupabaseError(
        await supabase.from("restock_requests").insert({
          id: id("rr"),
          product_id: payload.productId,
          workflow_id: workflowId,
          target_price_min: null,
          target_price_max: null,
          requested_threshold: product.current_threshold,
          requested_quantity: requestedQuantity,
          reason_summary:
            "AI Restock accepted from product detail page after stock review.",
          status: "accepted",
          requested_by: "merchant",
        })
      )
    }

    await throwIfSupabaseError(
      await supabase.from("workflow_events").insert({
        id: id("we"),
        workflow_id: workflowId,
        state: "supplier_prep",
        note: "Supplier preparation completed automatically after merchant accepted AI Restock",
        actor_type: "system",
      })
    )

    await throwIfSupabaseError(
      await supabase.from("workflow_events").insert({
        id: id("we"),
        workflow_id: workflowId,
        state: "po_sent",
        note: "AI Restock initiated from product detail page and purchase order sent",
        actor_type: "merchant",
      })
    )

    revalidateProductPaths(payload.sku)
    return success("Restock workflow started.")
  } catch (error) {
    return failure(error)
  }
}

export async function createRestockRequestAction(
  payload: CreateRestockRequestPayload
): Promise<ActionResult> {
  try {
    const supabase = requireSupabase()

    if (!payload.productId || !payload.sku) {
      throw new Error("Missing product identifier.")
    }

    const product = await throwIfSupabaseError(
      await supabase
        .from("products")
        .select("id,name,current_stock,current_threshold")
        .eq("id", payload.productId)
        .single()
    )

    if (!product) {
      throw new Error("Product no longer exists.")
    }

    const activeRestockRequests = await throwIfSupabaseError(
      await supabase
        .from("restock_requests")
        .select("id,status")
        .eq("product_id", payload.productId)
        .in("status", ["pending", "reviewed", "accepted"])
        .order("updated_at", { ascending: false })
        .limit(1)
    )

    if ((activeRestockRequests ?? []).length > 0) {
      throw new Error("A restock request already exists for this product.")
    }

    const latestWorkflow = await throwIfSupabaseError(
      await supabase
        .from("workflows")
        .select("id,current_state")
        .eq("product_id", payload.productId)
        .order("updated_at", { ascending: false })
        .limit(1)
    )

    const workflowState = latestWorkflow?.[0]?.current_state as string | undefined
    if (workflowState && !["stock_healthy", "completed"].includes(workflowState)) {
      throw new Error("This product is already in a workflow.")
    }

    const requestedQuantity = Math.max(
      Number(product.current_threshold) - Number(product.current_stock),
      Number(product.current_threshold)
    )

    await throwIfSupabaseError(
      await supabase.from("restock_requests").insert({
        id: id("rr"),
        product_id: payload.productId,
        target_price_min: null,
        target_price_max: null,
        requested_threshold: product.current_threshold,
        requested_quantity: requestedQuantity,
        reason_summary:
          Number(product.current_stock) < Number(product.current_threshold)
            ? `${product.name} is below the current threshold and should be restocked.`
            : `${product.name} was manually flagged for restock review from the product detail page.`,
        status: "pending",
        requested_by: "merchant",
      })
    )

    revalidateProductPaths(payload.sku)
    return success("Restock request created.")
  } catch (error) {
    return failure(error)
  }
}

export async function updateRestockRequestAction(
  payload: UpdateRestockRequestPayload
): Promise<ActionResult> {
  try {
    const supabase = requireSupabase()

    if (!payload.requestId || !payload.sku) {
      throw new Error("Missing restock request identifier.")
    }
    if (payload.quantity < 0) {
      throw new Error("Quantity must be zero or greater.")
    }

    const targetPriceRange = parseTargetPriceRange(payload.targetPrice)
    const request = await throwIfSupabaseError(
      await supabase
        .from("restock_requests")
        .select("id,workflow_id,product_id")
        .eq("id", payload.requestId)
        .single()
    )

    if (!request) {
      throw new Error("Restock request no longer exists.")
    }

    await throwIfSupabaseError(
      await supabase
        .from("restock_requests")
        .update({
          target_price_min: targetPriceRange.min,
          target_price_max: targetPriceRange.max,
          requested_quantity: payload.quantity,
          reason_summary: cleanText(payload.reason),
        })
        .eq("id", payload.requestId)
    )

    if (request.workflow_id) {
      await throwIfSupabaseError(
        await supabase
          .from("workflows")
          .update({
            target_price_min: targetPriceRange.min,
            target_price_max: targetPriceRange.max,
            quantity: payload.quantity,
          })
          .eq("id", request.workflow_id)
      )
    }

    if (payload.supplierId) {
      await throwIfSupabaseError(
        await supabase
          .from("products")
          .update({
            primary_supplier_id: payload.supplierId,
          })
          .eq("id", request.product_id)
      )

      const existingSupplierLink = await throwIfSupabaseError(
        await supabase
          .from("product_suppliers")
          .select("id")
          .eq("product_id", request.product_id)
          .eq("supplier_id", payload.supplierId)
          .maybeSingle()
      )

      if (!existingSupplierLink) {
        await throwIfSupabaseError(
          await supabase.from("product_suppliers").insert({
            id: id("ps"),
            product_id: request.product_id,
            supplier_id: payload.supplierId,
            is_primary: true,
          })
        )
      }

      await throwIfSupabaseError(
        await supabase
          .from("product_suppliers")
          .update({
            is_primary: false,
          })
          .eq("product_id", request.product_id)
          .neq("supplier_id", payload.supplierId)
      )

      await throwIfSupabaseError(
        await supabase
          .from("product_suppliers")
          .update({
            is_primary: true,
          })
          .eq("product_id", request.product_id)
          .eq("supplier_id", payload.supplierId)
      )
    }

    revalidateProductPaths(payload.sku)
    return success("Restock request updated.")
  } catch (error) {
    return failure(error)
  }
}

export async function cancelRestockRequestAction(
  payload: CancelRestockRequestPayload
): Promise<ActionResult> {
  try {
    const supabase = requireSupabase()

    if (!payload.requestId || !payload.sku) {
      throw new Error("Missing restock request identifier.")
    }

    const request = await throwIfSupabaseError(
      await supabase
        .from("restock_requests")
        .select("id,workflow_id,status")
        .eq("id", payload.requestId)
        .single()
    )

    if (!request) {
      throw new Error("Restock request no longer exists.")
    }

    if (request.workflow_id) {
      const workflow = await throwIfSupabaseError(
        await supabase
          .from("workflows")
          .select("current_state")
          .eq("id", request.workflow_id)
          .single()
      )

      if (
        workflow?.current_state &&
        !["stock_healthy", "completed"].includes(workflow.current_state)
      ) {
        throw new Error("This restock request is already in workflow.")
      }
    }

    await throwIfSupabaseError(
      await supabase
        .from("restock_requests")
        .update({ status: "cancelled" })
        .eq("id", payload.requestId)
    )

    revalidateProductPaths(payload.sku)
    return success("Restock request cancelled.")
  } catch (error) {
    return failure(error)
  }
}

export async function deleteRestockRequestAction(
  payload: DeleteRestockRequestPayload
): Promise<ActionResult> {
  try {
    const supabase = requireSupabase()

    if (!payload.requestId || !payload.sku) {
      throw new Error("Missing restock request identifier.")
    }

    await throwIfSupabaseError(
      await supabase
        .from("restock_requests")
        .delete()
        .eq("id", payload.requestId)
    )

    revalidateProductPaths(payload.sku)
    return success("Restock request deleted.")
  } catch (error) {
    return failure(error)
  }
}

export async function markRestockRequestReviewedAction(
  payload: MarkRestockRequestReviewedPayload
): Promise<ActionResult> {
  try {
    const supabase = requireSupabase()

    if (!payload.requestId || !payload.sku) {
      throw new Error("Missing restock request identifier.")
    }

    const request = await throwIfSupabaseError(
      await supabase
        .from("restock_requests")
        .select("id,status")
        .eq("id", payload.requestId)
        .single()
    )

    if (!request) {
      throw new Error("Restock request no longer exists.")
    }

    if (request.status !== "pending") {
      return success()
    }

    await throwIfSupabaseError(
      await supabase
        .from("restock_requests")
        .update({ status: "reviewed" })
        .eq("id", payload.requestId)
    )

    revalidateProductPaths(payload.sku)
    return success("Restock request marked reviewed.")
  } catch (error) {
    return failure(error)
  }
}

export async function setInvoiceDecisionAction(
  payload: InvoiceDecisionPayload
): Promise<ActionResult> {
  try {
    const supabase = requireSupabase()
    const invoice = await throwIfSupabaseError(
      await supabase
        .from("invoices")
        .select("id,invoice_number,workflow_id,approval_state")
        .eq("id", payload.invoiceId)
        .single()
    )
    if (!invoice) {
      throw new Error("Invoice no longer exists.")
    }
    let workflowProductSku: string | undefined

    const stateByDecision = {
      approve: {
        invoiceApproval: "waiting_approval",
        workflowState: "ready_for_approval",
        workflowApproval: "waiting_approval",
        actionType: "approved_for_payment",
        note: "Finance approved this invoice for final payment review.",
      },
      hold: {
        invoiceApproval: "needs_review",
        workflowState: "invoice_processing",
        workflowApproval: "needs_review",
        actionType: "held_for_review",
        note: "Invoice was held for additional review.",
      },
      block: {
        invoiceApproval: "blocked",
        workflowState: "blocked",
        workflowApproval: "blocked",
        actionType: "blocked",
        note: "Invoice was rejected or blocked by finance.",
      },
      complete: {
        invoiceApproval: "completed",
        workflowState: "completed",
        workflowApproval: "completed",
        actionType: "completed",
        note: "Invoice settlement was marked completed.",
      },
    }[payload.decision]

    await throwIfSupabaseError(
      await supabase
        .from("invoices")
        .update({ approval_state: stateByDecision.invoiceApproval })
        .eq("id", invoice.id)
    )

    if (invoice.workflow_id) {
      const workflow = await throwIfSupabaseError(
        await supabase
          .from("workflows")
          .select("id,product_id")
          .eq("id", invoice.workflow_id)
          .single()
      )

      if (workflow?.product_id) {
        const workflowProduct = await throwIfSupabaseError(
          await supabase
            .from("products")
            .select("sku")
            .eq("id", workflow.product_id)
            .single()
        )
        workflowProductSku = workflowProduct?.sku as string | undefined
      }

      if (payload.decision === "complete") {
        await throwIfSupabaseError(
          await supabase
            .from("restock_requests")
            .delete()
            .eq("workflow_id", invoice.workflow_id)
        )

        await throwIfSupabaseError(
          await supabase
            .from("workflows")
            .delete()
            .eq("id", invoice.workflow_id)
        )
      } else {
        await throwIfSupabaseError(
          await supabase
            .from("workflows")
            .update({
              current_state: stateByDecision.workflowState,
              approval_state: stateByDecision.workflowApproval,
            })
            .eq("id", invoice.workflow_id)
        )
      }
    }

    await throwIfSupabaseError(
      await supabase.from("invoice_actions").insert({
        id: id("ia"),
        invoice_id: invoice.id,
        action_type: stateByDecision.actionType,
        note: stateByDecision.note,
        actor_type: "finance",
      })
    )

    revalidatePath("/dashboard")
    revalidatePath("/invoice-management")
    revalidatePath("/invoice-management/completed")
    revalidatePath(`/invoice-management/${invoice.id}`)
    if (workflowProductSku) {
      revalidatePath(`/inventory/${workflowProductSku}`)
    }
    return success(`Invoice ${invoice.invoice_number} updated.`)
  } catch (error) {
    return failure(error)
  }
}
