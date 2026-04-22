"use server"

import { revalidatePath } from "next/cache"

import { getSupabaseServerClient } from "@/lib/supabase/server"

type ActionResult = {
  ok: boolean
  message?: string
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
  staticThreshold: number
  aiThreshold: number
  supplierId: string
  trackedSupplierIds: string[]
}

type SupplierPayload = {
  name: string
  region: string
  leadTimeDays: number
  reliabilityScore: number
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

function requireSupabase() {
  const supabase = getSupabaseServerClient()
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    )
  }
  return supabase
}

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`
}

function stockStatus(stock: number, threshold: number) {
  if (stock < threshold) return "below_threshold"
  if (stock < threshold * 1.15) return "near_threshold"
  return "healthy"
}

function cleanText(value: string) {
  return value.trim()
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
        static_threshold: payload.initialThreshold,
        ai_threshold: payload.initialThreshold,
        max_capacity: payload.maxCapacity,
        threshold_buffer: 0,
        status: "batch_candidate",
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
          ai_threshold: payload.aiThreshold,
          threshold_buffer: Math.max(
            0,
            payload.aiThreshold - payload.staticThreshold
          ),
          status: stockStatus(payload.stockOnHand, payload.aiThreshold),
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
        .select("id,sku,current_stock,static_threshold")
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
            ai_threshold: payload.proposedThreshold,
            threshold_buffer: Math.max(
              0,
              payload.proposedThreshold - product.static_threshold
            ),
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
        .select("id")
        .eq("product_id", payload.productId)
        .order("updated_at", { ascending: false })
        .limit(1)
    )
    const existingWorkflow = (existingWorkflows ?? [])[0]

    let workflowId = existingWorkflow?.id as string | undefined

    if (workflowId) {
      await throwIfSupabaseError(
        await supabase
          .from("workflows")
          .update({
            current_state: "supplier_prep",
            approval_state: "waiting_approval",
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
            current_state: "supplier_prep",
            approval_state: "waiting_approval",
          })
          .select("id")
          .single()
      )
      workflowId = workflow?.id as string | undefined
    }

    if (!workflowId) {
      throw new Error("Unable to start restock workflow.")
    }

    await throwIfSupabaseError(
      await supabase.from("workflow_events").insert({
        id: id("we"),
        workflow_id: workflowId,
        state: "supplier_prep",
        note: "AI Restock initiated from product detail page after threshold review accepted",
        actor_type: "merchant",
      })
    )

    revalidateProductPaths(payload.sku)
    return success("Restock workflow started.")
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
    return success(`Invoice ${invoice.invoice_number} updated.`)
  } catch (error) {
    return failure(error)
  }
}
