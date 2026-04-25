"use server"

import path from "node:path"

import { revalidatePath } from "next/cache"

import {
  applyParsedFieldsToInvoiceData,
  analyzeInvoiceWithAI,
  analyzeInvoiceWithFallback,
  type InvoiceAnalysisExpectedData,
  type InvoiceAnalysisInvoiceData,
  type InvoiceAnalysisIssue,
  type InvoiceAnalysisParsedFields,
  type InvoiceAnalysisParsedLineItem,
} from "@/lib/invoice-analysis"
import {
  buildExtractedTextSnippet,
  deriveInvoiceFieldsFromExtractedText,
  extractInvoiceDocumentText,
} from "@/lib/invoice-extraction"
import {
  getSupabaseAdminClient,
  getSupabaseServerClient,
} from "@/lib/supabase/server"

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

type AnalyzeInvoicePayload = {
  invoiceId: string
}

type ProcessInvoicePipelinePayload = {
  invoiceId: string
}

type CompleteMockPaymentPayload = {
  invoiceId: string
  paymentMethod: string
}

type TestInvoiceMode = "normal" | "suspicious"

type CreateTestInvoicePayload = {
  mode?: TestInvoiceMode
}

type CreateTestInvoiceActionResult = ActionResult & {
  invoiceId?: string
}

type CreateUploadedInvoiceActionResult = ActionResult & {
  invoiceId?: string
}

type InvoiceProcessingStatus = "idle" | "extracting" | "analyzing"
type RepairParsedFieldsOptions = {
  allowFieldRepair?: boolean
  parserReliability?: "low" | "medium" | "high"
  rejectedValues?: string[]
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

function requireSupabaseAdmin() {
  const supabase = getSupabaseAdminClient()
  if (!supabase) {
    throw new Error(
      "Supabase admin client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function randomIntBetween(min: number, max: number) {
  const lower = Math.ceil(Math.min(min, max))
  const upper = Math.floor(Math.max(min, max))
  return Math.floor(Math.random() * (upper - lower + 1)) + lower
}

function randomNumberBetween(min: number, max: number) {
  const lower = Math.min(min, max)
  const upper = Math.max(min, max)
  return Math.random() * (upper - lower) + lower
}

function pickRandom<T>(items: T[]) {
  if (items.length === 0) {
    throw new Error("No records are available for this test action.")
  }

  return items[randomIntBetween(0, items.length - 1)]
}

function sanitizeFileName(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "invoice-file"
}

function invoiceSourceTypeForFile(file: File): "pdf" | "image" {
  const mimeType = file.type.toLowerCase()
  const extension = path.extname(file.name).toLowerCase()

  if (mimeType === "application/pdf" || extension === ".pdf") {
    return "pdf"
  }

  if (
    mimeType === "image/png" ||
    mimeType === "image/jpeg" ||
    mimeType === "image/jpg" ||
    mimeType === "image/webp" ||
    [".png", ".jpg", ".jpeg", ".webp"].includes(extension)
  ) {
    return "image"
  }

  throw new Error("Unsupported file type. Upload a PDF, PNG, JPG, JPEG, or WEBP invoice.")
}

async function ensureInvoiceFilesBucket(supabase: ReturnType<typeof requireSupabaseAdmin>) {
  const bucketName = "invoice-files"
  const buckets = (await throwIfSupabaseError(await supabase.storage.listBuckets())) ?? []
  const existingBucket = buckets.find((bucket) => bucket.name === bucketName)

  if (!existingBucket) {
    await throwIfSupabaseError(
      await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: 10 * 1024 * 1024,
        allowedMimeTypes: [
          "application/pdf",
          "image/png",
          "image/jpeg",
          "image/webp",
        ],
      })
    )
  }

  return bucketName
}

async function selectInvoiceCreationContext(supabase: ReturnType<typeof requireSupabaseAdmin>) {
  const workflow =
    await throwIfSupabaseError(
      await supabase
        .from("workflows")
        .select("id,product_id,created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    )

  const firstSupplier =
    await throwIfSupabaseError(
      await supabase
        .from("suppliers")
        .select("id,name,created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    )

  let supplier = firstSupplier
  if (workflow?.product_id) {
    const product =
      await throwIfSupabaseError(
        await supabase
          .from("products")
          .select("id,primary_supplier_id")
          .eq("id", workflow.product_id)
          .maybeSingle()
      )

    if (product?.primary_supplier_id) {
      const productSupplier =
        await throwIfSupabaseError(
          await supabase
            .from("suppliers")
            .select("id,name,created_at")
            .eq("id", product.primary_supplier_id)
            .maybeSingle()
        )

      if (productSupplier) {
        supplier = productSupplier
      }
    }
  }

  if (!workflow) {
    throw new Error("No workflow is available to attach this uploaded invoice.")
  }

  if (!supplier) {
    throw new Error("No supplier is available to attach this uploaded invoice.")
  }

  return {
    workflow,
    supplier,
  }
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

function debugSerialize(value: unknown) {
  try {
    return JSON.stringify(value)
  } catch {
    return "[unserializable]"
  }
}

function isMissingSupabaseColumnError(
  error: unknown,
  tableName: string,
  columnName: string
) {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return (
    message.includes(`could not find the '${columnName.toLowerCase()}' column of '${tableName.toLowerCase()}'`) ||
    message.includes(`column ${columnName.toLowerCase()}`) ||
    message.includes(`${tableName.toLowerCase()}.${columnName.toLowerCase()}`)
  )
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

function revalidateInvoicePaths(invoiceId: string, sku?: string) {
  revalidatePath("/dashboard")
  revalidatePath("/invoice-management")
  revalidatePath("/invoice-management/completed")
  revalidatePath(`/invoice-management/${invoiceId}`)
  revalidatePath(`/invoice-management/${invoiceId}/payment`)
  if (sku) {
    revalidatePath(`/inventory/${sku}`)
  }
}

type AppSupabaseClient = NonNullable<ReturnType<typeof getSupabaseServerClient>>

async function updateInvoiceProcessingStatus(
  supabase: AppSupabaseClient,
  invoiceId: string,
  nextStatus: InvoiceProcessingStatus,
  expectedCurrentStatus?: InvoiceProcessingStatus
) {
  try {
    console.info(
      "[Invoice Pipeline] Processing status transition requested",
      debugSerialize({
        invoiceId,
        nextStatus,
        expectedCurrentStatus: expectedCurrentStatus ?? null,
      })
    )
    let query = supabase
      .from("invoices")
      .update({ processing_status: nextStatus })
      .eq("id", invoiceId)

    if (expectedCurrentStatus) {
      query = query.eq("processing_status", expectedCurrentStatus)
    }

    const result = await throwIfSupabaseError(
      await query.select("id,processing_status").maybeSingle()
    )
    console.info(
      "[Invoice Pipeline] Processing status transition result",
      debugSerialize({
        invoiceId,
        nextStatus,
        applied: Boolean(result),
      })
    )
    return result
  } catch (error) {
    if (isMissingSupabaseColumnError(error, "invoices", "processing_status")) {
      return { id: invoiceId, processing_status: "idle" as const }
    }

    throw error
  }
}

function normalizeAiConfidencePercent(value: number) {
  const normalized = value > 1 ? value / 100 : value
  return Math.max(0, Math.min(100, Math.round(normalized * 100)))
}

function slugifyIssueFragment(value: string) {
  return cleanText(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48)
}

function formatExpectedAmountLabel(expectedData: InvoiceAnalysisExpectedData, currency: string) {
  if (
    expectedData.expectedAmountMin != null &&
    expectedData.expectedAmountMax != null
  ) {
    if (expectedData.expectedAmountMin === expectedData.expectedAmountMax) {
      return `${currency} ${expectedData.expectedAmountMin.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    }

    return `${currency} ${expectedData.expectedAmountMin.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} - ${currency} ${expectedData.expectedAmountMax.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  return "System reference unavailable"
}

function validationStatusFromIssues(issues: InvoiceAnalysisIssue[]) {
  if (issues.some((issue) => issue.type === "missing_field")) {
    return "missing_information"
  }

  return issues.length > 0 ? "mismatch_detected" : "validated"
}

function checkNameForIssue(issue: InvoiceAnalysisIssue) {
  const description = issue.description.toLowerCase()

  if (issue.type === "amount_mismatch") return "ai_amount_mismatch"
  if (issue.type === "bank_mismatch") return "ai_bank_mismatch"
  if (issue.type === "suspicious_value") return "ai_suspicious_value"

  if (issue.type === "missing_field") {
    if (description.includes("bank")) return "ai_missing_bank_details"
    if (description.includes("payment")) return "ai_missing_payment_terms"
    if (description.includes("supplier")) return "ai_missing_supplier"
    if (description.includes("quantity")) return "ai_missing_quantity"
    return "ai_missing_field"
  }

  if (description.includes("quantity mismatch")) return "ai_quantity_mismatch"
  if (description.includes("supplier mismatch")) return "ai_supplier_mismatch"
  if (description.includes("payment terms")) return "ai_payment_terms_inconsistency"

  const fragment = slugifyIssueFragment(issue.description)
  return fragment ? `ai_other_${fragment}` : "ai_other_issue"
}

function expectedActualValuesForIssue(
  issue: InvoiceAnalysisIssue,
  invoiceData: InvoiceAnalysisInvoiceData,
  expectedData: InvoiceAnalysisExpectedData
) {
  const quantity =
    typeof invoiceData.quantity === "number"
      ? invoiceData.quantity
      : invoiceData.lineItems.reduce((total, line) => total + line.quantity, 0)
  const amountLabel = `${invoiceData.currency} ${invoiceData.amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
  const description = issue.description.toLowerCase()

  if (issue.type === "amount_mismatch") {
    return {
      expectedValue: formatExpectedAmountLabel(expectedData, invoiceData.currency),
      actualValue: amountLabel,
    }
  }

  if (issue.type === "bank_mismatch") {
    return {
      expectedValue: expectedData.expectedBankDetails ?? "Supplier reference unavailable",
      actualValue: invoiceData.bankDetails?.trim() || "Missing",
    }
  }

  if (description.includes("quantity mismatch")) {
    return {
      expectedValue:
        expectedData.expectedQuantity != null
          ? String(expectedData.expectedQuantity)
          : "System reference unavailable",
      actualValue: quantity ? String(quantity) : "Missing",
    }
  }

  if (description.includes("supplier mismatch")) {
    return {
      expectedValue:
        expectedData.expectedSupplierName ??
        expectedData.expectedSupplierId ??
        "System reference unavailable",
      actualValue:
        invoiceData.supplierName?.trim() ||
        invoiceData.supplierId?.trim() ||
        "Missing",
    }
  }

  if (description.includes("payment terms")) {
    return {
      expectedValue:
        expectedData.expectedPaymentTerms ?? "System reference unavailable",
      actualValue: invoiceData.paymentTerms?.trim() || "Missing",
    }
  }

  if (issue.type === "missing_field") {
    return {
      expectedValue: "Field should be present",
      actualValue: issue.description,
    }
  }

  if (issue.type === "suspicious_value") {
    return {
      expectedValue:
        expectedData.targetUnitPriceMin != null ||
        expectedData.targetUnitPriceMax != null
          ? `Target unit price ${expectedData.targetUnitPriceMin ?? expectedData.targetUnitPriceMax ?? 0} - ${expectedData.targetUnitPriceMax ?? expectedData.targetUnitPriceMin ?? 0}`
          : "Expected range on file",
      actualValue: issue.description,
    }
  }

  return {
    expectedValue: null,
    actualValue: issue.description,
  }
}

async function buildInvoiceAnalysisContext(
  supabase: AppSupabaseClient,
  invoiceId: string
) {
    const invoice = await throwIfSupabaseError(
      await supabase
        .from("invoices")
        .select(
          "id,invoice_number,supplier_id,workflow_id,source_type,file_url,extracted_text,amount,currency,quantity,payment_terms,bank_details,ai_last_analyzed_at"
        )
        .eq("id", invoiceId)
        .single()
    )

  if (!invoice) {
    throw new Error("Invoice no longer exists.")
  }

  const [invoiceLinesResult, workflow] = await Promise.all([
    throwIfSupabaseError(
      await supabase
        .from("invoice_products")
        .select("id,product_id,quantity,unit_price,subtotal")
        .eq("invoice_id", invoice.id)
    ),
    invoice.workflow_id
      ? throwIfSupabaseError(
          await supabase
            .from("workflows")
            .select(
              "id,product_id,current_state,quantity,target_price_min,target_price_max,conversation_id"
            )
            .eq("id", invoice.workflow_id)
            .maybeSingle()
        )
      : Promise.resolve(null),
  ])
  const invoiceLines = invoiceLinesResult ?? []

  const productIds = Array.from(
    new Set(
      invoiceLines
        .map((line) => line.product_id as string | null | undefined)
        .filter((value): value is string => Boolean(value))
    )
  )

  const products =
    productIds.length > 0
      ? (await throwIfSupabaseError(
          await supabase
            .from("products")
            .select("id,sku,unit_price,primary_supplier_id")
            .in("id", productIds)
        )) ?? []
      : []

  const supplierIds = Array.from(
    new Set(
      [
        invoice.supplier_id,
        ...products.map((product) => product.primary_supplier_id),
      ].filter((value): value is string => Boolean(value))
    )
  )

  const suppliers =
    supplierIds.length > 0
      ? (await throwIfSupabaseError(
          await supabase
            .from("suppliers")
            .select("id,name,reliability_score")
            .in("id", supplierIds)
        )) ?? []
      : []

  const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]))
  const productById = new Map(products.map((product) => [product.id, product]))
  const invoiceSupplier = invoice.supplier_id
    ? supplierById.get(invoice.supplier_id)
    : undefined

  const uniquePrimarySupplierIds = Array.from(
    new Set(
      products
        .map((product) => product.primary_supplier_id as string | null | undefined)
        .filter((value): value is string => Boolean(value))
    )
  )
  const expectedSupplierId =
    uniquePrimarySupplierIds.length === 1
      ? uniquePrimarySupplierIds[0]
      : (invoice.supplier_id ?? null)
  const expectedSupplier = expectedSupplierId
    ? supplierById.get(expectedSupplierId)
    : invoiceSupplier

  const [conversation, conversationMessagesResult, referenceInvoice] = await Promise.all([
    workflow?.conversation_id
      ? throwIfSupabaseError(
          await supabase
            .from("conversations")
            .select("id,state")
            .eq("id", workflow.conversation_id)
            .maybeSingle()
        )
      : Promise.resolve(null),
    workflow?.conversation_id
      ? throwIfSupabaseError(
          await supabase
            .from("conversation_messages")
            .select("sender_type,extracted_price,extracted_quantity,missing_fields,created_at")
            .eq("conversation_id", workflow.conversation_id)
            .order("created_at", { ascending: false })
            .limit(5)
        )
      : Promise.resolve([]),
    invoice.supplier_id
      ? throwIfSupabaseError(
          await supabase
            .from("invoices")
            .select("invoice_number,payment_terms,bank_details")
            .eq("supplier_id", invoice.supplier_id)
            .neq("id", invoice.id)
            .eq("validation_status", "validated")
            .eq("risk_level", "low")
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        )
      : Promise.resolve(null),
  ])
  const conversationMessages = conversationMessagesResult ?? []

  const latestQuotedMessage = conversationMessages.find(
    (message) =>
      typeof message.extracted_price === "number" ||
      typeof message.extracted_quantity === "number"
  )
  const unresolvedFields = Array.from(
    new Set(
      conversationMessages.flatMap((message) =>
        Array.isArray(message.missing_fields) ? message.missing_fields : []
      )
    )
  )

  const quantity =
    typeof invoice.quantity === "number"
      ? invoice.quantity
      : invoiceLines.reduce((total, line) => total + Number(line.quantity), 0)
  const expectedQuantity = workflow?.quantity ?? quantity ?? null
  const priceMin =
    workflow?.target_price_min == null ? null : Number(workflow.target_price_min)
  const priceMax =
    workflow?.target_price_max == null ? null : Number(workflow.target_price_max)

  const invoiceData: InvoiceAnalysisInvoiceData = {
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    workflowId: invoice.workflow_id,
    supplierId: invoice.supplier_id,
    supplierName: invoiceSupplier?.name ?? null,
    sourceType: invoice.source_type,
    currency: invoice.currency,
    amount: Number(invoice.amount),
    quantity,
    paymentTerms: invoice.payment_terms ?? null,
    bankDetails: invoice.bank_details ?? null,
    extractedTextSnippet: buildExtractedTextSnippet(invoice.extracted_text ?? null),
    lineItems: invoiceLines.map((line) => {
      const product = productById.get(line.product_id)
      return {
        productId: line.product_id,
        sku: product?.sku ?? line.product_id,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unit_price),
        subtotal: Number(line.subtotal),
        baselineUnitPrice:
          product?.unit_price == null ? null : Number(product.unit_price),
      }
    }),
  }

  const expectedData: InvoiceAnalysisExpectedData = {
    workflowState: workflow?.current_state ?? null,
    conversationState: conversation?.state ?? null,
    expectedSupplierId: expectedSupplierId ?? null,
    expectedSupplierName: expectedSupplier?.name ?? null,
    expectedQuantity,
    targetUnitPriceMin: priceMin,
    targetUnitPriceMax: priceMax,
    expectedAmountMin:
      expectedQuantity != null && priceMin != null
        ? Number((expectedQuantity * priceMin).toFixed(2))
        : null,
    expectedAmountMax:
      expectedQuantity != null && priceMax != null
        ? Number((expectedQuantity * priceMax).toFixed(2))
        : null,
    expectedBankDetails: referenceInvoice?.bank_details ?? null,
    expectedPaymentTerms: referenceInvoice?.payment_terms ?? null,
    referenceInvoiceNumber: referenceInvoice?.invoice_number ?? null,
    latestQuotedUnitPrice:
      typeof latestQuotedMessage?.extracted_price === "number"
        ? Number(latestQuotedMessage.extracted_price)
        : null,
    latestQuotedQuantity:
      typeof latestQuotedMessage?.extracted_quantity === "number"
        ? Number(latestQuotedMessage.extracted_quantity)
        : null,
    unresolvedFields,
    supplierReliabilityScore:
      invoiceSupplier?.reliability_score == null
        ? null
        : Number(invoiceSupplier.reliability_score),
  }

  return {
    invoice,
    invoiceData,
    expectedData,
    workflow,
    invoiceLinesRaw: invoiceLines,
    conversationId: workflow?.conversation_id ?? null,
    inventorySkus: invoiceData.lineItems.map((line) => line.sku),
  }
}

function isReplaceableTextField(value?: string | null) {
  const normalized = cleanText(value ?? "")
  return !normalized || normalized === "not provided"
}

function isReplaceableNumericField(value?: number | null) {
  return value == null || value <= 0
}

function isAutoGeneratedInvoiceNumber(value?: string | null) {
  const normalized = (value ?? "").trim().toUpperCase()
  return !normalized || normalized.startsWith("UPL-") || normalized.startsWith("TEST-")
}

function normalizeStoredInvoiceCurrency(value?: string | null): string | null {
  const normalized = (value ?? "").trim().toUpperCase()
  if (!normalized) {
    return null
  }

  const codeMatch = normalized.match(/\b([A-Z]{3})\b/)
  if (codeMatch) {
    return codeMatch[1]
  }

  if (normalized === "RM") return "MYR"
  if (normalized === "$") return "USD"
  if (normalized === "S$") return "SGD"
  if (normalized === "£") return "GBP"
  if (normalized === "€") return "EUR"
  if (normalized === "RMB" || normalized === "CNH") return "CNY"

  return null
}

function isRetryableAiAnalysisError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return (
    message.includes("readtimeout") ||
    message.includes("timeout") ||
    message.includes("unable to reach ai gateway") ||
    message.includes("502") ||
    message.includes("bad gateway")
  )
}

async function analyzeInvoiceWithAIRetries(
  invoiceData: InvoiceAnalysisInvoiceData,
  expectedData: InvoiceAnalysisExpectedData
) {
  let lastError: unknown

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      console.info(
        "[Invoice AI] Live AI attempt",
        debugSerialize({
          invoiceId: invoiceData.id,
          attempt,
        })
      )
      return await analyzeInvoiceWithAI(invoiceData, expectedData)
    } catch (error) {
      lastError = error
      const retryable = isRetryableAiAnalysisError(error)
      console.error(
        "[Invoice AI] Live AI attempt failed",
        debugSerialize({
          invoiceId: invoiceData.id,
          attempt,
          retryable,
          error: error instanceof Error ? error.message : String(error),
        })
      )

      if (!retryable || attempt === 3) {
        throw error
      }

      await sleep(750 * attempt)
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Invoice AI call failed.")
}

function normalizeSupplierMatchKey(value?: string | null) {
  return compactTextForMatch(value)
}

function compactTextForMatch(value?: string | null) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function meaningfulParsedLineItems(lineItems: InvoiceAnalysisParsedLineItem[]) {
  return lineItems.filter(
    (item) =>
      item.description ||
      item.quantity != null ||
      item.unitPrice != null ||
      item.lineTotal != null
  )
}

function summarizeParsedLineItems(lineItems: InvoiceAnalysisParsedLineItem[]) {
  return meaningfulParsedLineItems(lineItems)
    .slice(0, 4)
    .map((item, index) => {
      const parts = [
        item.description ?? `Line ${index + 1}`,
        item.quantity != null ? `qty ${item.quantity}` : null,
        item.unitPrice != null ? `unit ${item.unitPrice}` : null,
        item.lineTotal != null ? `total ${item.lineTotal}` : null,
      ].filter(Boolean)

      return parts.join(", ")
    })
    .join(" | ")
}

function aggregateParsedLineItems(lineItems: InvoiceAnalysisParsedLineItem[]) {
  const meaningfulItems = meaningfulParsedLineItems(lineItems)
  const quantity = meaningfulItems.reduce((total, item) => total + (item.quantity ?? 0), 0)
  const lineTotal = meaningfulItems.reduce((total, item) => total + (item.lineTotal ?? 0), 0)
  const unitPrice =
    meaningfulItems.find((item) => item.unitPrice != null)?.unitPrice ??
    (quantity > 0 && lineTotal > 0 ? Number((lineTotal / quantity).toFixed(2)) : null)

  return {
    description:
      meaningfulItems.length === 1
        ? meaningfulItems[0].description
        : "Aggregated parsed invoice line items",
    quantity: quantity > 0 ? quantity : null,
    unitPrice,
    lineTotal: lineTotal > 0 ? Number(lineTotal.toFixed(2)) : null,
  } satisfies InvoiceAnalysisParsedLineItem
}

async function repairInvoiceFieldsFromParsedData(
  supabase: AppSupabaseClient,
  context: Awaited<ReturnType<typeof buildInvoiceAnalysisContext>>,
  parsedFields: InvoiceAnalysisParsedFields,
  options: RepairParsedFieldsOptions = {}
) {
  if (options.rejectedValues && options.rejectedValues.length > 0) {
    console.info(
      "[Invoice AI] Rejected parsed values due to sanity checks",
      debugSerialize({
        invoiceId: context.invoice.id,
        parserReliability: options.parserReliability ?? null,
        rejectedValues: options.rejectedValues,
      })
    )
  }

  if (options.allowFieldRepair === false) {
    console.info(
      "[Invoice AI] Skipping invoice field repair because parsed fallback confidence is low",
      debugSerialize({
        invoiceId: context.invoice.id,
        parserReliability: options.parserReliability ?? null,
      })
    )
    return {
      updatedFields: [] as string[],
      parsedLineItemsNote: null,
    }
  }

  const invoiceUpdatePayload: Record<string, unknown> = {}
  const updatedFields: string[] = []
  const parsedLineItems = meaningfulParsedLineItems(parsedFields.lineItems)
  const candidateInvoiceNumber =
    parsedFields.invoiceNumber &&
    isAutoGeneratedInvoiceNumber(context.invoice.invoice_number)
      ? parsedFields.invoiceNumber.trim()
      : null

  if (parsedFields.amount != null && isReplaceableNumericField(Number(context.invoice.amount))) {
    invoiceUpdatePayload.amount = parsedFields.amount
    updatedFields.push("amount")
  }

  const supportedParsedCurrency = normalizeStoredInvoiceCurrency(parsedFields.currency)
  if (
    supportedParsedCurrency &&
    (isReplaceableNumericField(Number(context.invoice.amount)) ||
      !context.invoice.currency ||
      (normalizeStoredInvoiceCurrency(context.invoice.currency) === "USD" &&
        supportedParsedCurrency !== context.invoice.currency &&
        isReplaceableNumericField(Number(context.invoice.amount))))
  ) {
    invoiceUpdatePayload.currency = supportedParsedCurrency
    updatedFields.push("currency")
  }

  if (
    parsedFields.quantity != null &&
    isReplaceableNumericField(
      context.invoice.quantity == null ? null : Number(context.invoice.quantity)
    )
  ) {
    invoiceUpdatePayload.quantity = Math.round(parsedFields.quantity)
    updatedFields.push("quantity")
  }

  if (
    parsedFields.paymentTerms &&
    isReplaceableTextField(context.invoice.payment_terms)
  ) {
    invoiceUpdatePayload.payment_terms = parsedFields.paymentTerms
    updatedFields.push("payment_terms")
  }

  if (
    parsedFields.bankDetails &&
    isReplaceableTextField(context.invoice.bank_details)
  ) {
    invoiceUpdatePayload.bank_details = parsedFields.bankDetails
    updatedFields.push("bank_details")
  }

  if (parsedFields.supplierName && !context.invoice.supplier_id) {
    const suppliers =
      (await throwIfSupabaseError(
        await supabase.from("suppliers").select("id,name")
      )) ?? []
    const parsedSupplierKey = normalizeSupplierMatchKey(parsedFields.supplierName)
    const matchedSupplier = suppliers.find(
      (supplier) => normalizeSupplierMatchKey(supplier.name) === parsedSupplierKey
    )
    if (matchedSupplier) {
      invoiceUpdatePayload.supplier_id = matchedSupplier.id
      updatedFields.push("supplier_id")
    }
  }

  if (Object.keys(invoiceUpdatePayload).length > 0) {
    await throwIfSupabaseError(
      await supabase
        .from("invoices")
        .update(invoiceUpdatePayload)
        .eq("id", context.invoice.id)
    )
  }

  if (candidateInvoiceNumber) {
    const conflictingInvoice = await throwIfSupabaseError(
      await supabase
        .from("invoices")
        .select("id")
        .eq("invoice_number", candidateInvoiceNumber)
        .neq("id", context.invoice.id)
        .maybeSingle()
    )

    if (!conflictingInvoice) {
      await throwIfSupabaseError(
        await supabase
          .from("invoices")
          .update({ invoice_number: candidateInvoiceNumber })
          .eq("id", context.invoice.id)
      )
      updatedFields.push("invoice_number")
    } else {
      console.info(
        "[Invoice AI] Skipping invoice_number repair because the parsed number already exists on another invoice",
        debugSerialize({
          invoiceId: context.invoice.id,
          parsedInvoiceNumber: candidateInvoiceNumber,
          conflictingInvoiceId: conflictingInvoice.id,
        })
      )
    }
  }

  if (parsedLineItems.length > 0) {
    const targetLineItems =
      context.invoiceLinesRaw.length === 1 && parsedLineItems.length > 1
        ? [aggregateParsedLineItems(parsedLineItems)]
        : parsedLineItems

    if (context.invoiceLinesRaw.length > 0) {
      for (let index = 0; index < context.invoiceLinesRaw.length; index += 1) {
        const currentLine = context.invoiceLinesRaw[index]
        const parsedLine = targetLineItems[index]
        if (!parsedLine) continue

        const updatePayload: Record<string, unknown> = {}
        if (
          parsedLine.quantity != null &&
          isReplaceableNumericField(Number(currentLine.quantity))
        ) {
          updatePayload.quantity = Math.round(parsedLine.quantity)
        }
        if (
          parsedLine.unitPrice != null &&
          isReplaceableNumericField(Number(currentLine.unit_price))
        ) {
          updatePayload.unit_price = parsedLine.unitPrice
        }
        const parsedSubtotal =
          parsedLine.lineTotal ??
          (parsedLine.quantity != null && parsedLine.unitPrice != null
            ? Number((parsedLine.quantity * parsedLine.unitPrice).toFixed(2))
            : null)
        if (
          parsedSubtotal != null &&
          isReplaceableNumericField(Number(currentLine.subtotal))
        ) {
          updatePayload.subtotal = parsedSubtotal
        }

        if (Object.keys(updatePayload).length > 0) {
          await throwIfSupabaseError(
            await supabase
              .from("invoice_products")
              .update(updatePayload)
              .eq("id", currentLine.id)
          )
          updatedFields.push(`invoice_product:${currentLine.id}`)
        }
      }
    } else if (context.workflow?.product_id) {
      const aggregateLine = aggregateParsedLineItems(parsedLineItems)
      const insertQuantity = aggregateLine.quantity ?? parsedFields.quantity ?? 1
      const insertUnitPrice =
        aggregateLine.unitPrice ??
        parsedFields.unitPrice ??
        (aggregateLine.lineTotal != null && insertQuantity > 0
          ? Number((aggregateLine.lineTotal / insertQuantity).toFixed(2))
          : 0)
      const insertSubtotal =
        aggregateLine.lineTotal ??
        parsedFields.subtotal ??
        (insertQuantity > 0 && insertUnitPrice > 0
          ? Number((insertQuantity * insertUnitPrice).toFixed(2))
          : 0)

      if (insertQuantity > 0 && insertSubtotal > 0) {
        await throwIfSupabaseError(
          await supabase.from("invoice_products").insert({
            id: id("ivp"),
            invoice_id: context.invoice.id,
            product_id: context.workflow.product_id,
            quantity: Math.round(insertQuantity),
            unit_price: insertUnitPrice,
            subtotal: insertSubtotal,
          })
        )
        updatedFields.push("invoice_products_inserted")
      }
    }
  }

  if (updatedFields.length === 0) {
    console.info(
      "[Invoice AI] No invoice fields were updated after parsed-field safety checks",
      debugSerialize({
        invoiceId: context.invoice.id,
        parserReliability: options.parserReliability ?? null,
      })
    )
  }

  return {
    updatedFields,
    parsedLineItemsNote:
      parsedLineItems.length > 0 ? summarizeParsedLineItems(parsedLineItems) : null,
  }
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
      results: (payload?.results ?? []).map((item: {
        sku: string
        status: string
        detail?: string
        current_threshold?: number | null
        proposed_threshold?: number | null
        confidence?: number | null
        trace?: Array<Record<string, unknown>>
      }) => ({
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

export async function createTestInvoiceAction(
  payload: CreateTestInvoicePayload = {}
): Promise<CreateTestInvoiceActionResult> {
  try {
    const supabase = requireSupabase()
    const mode: TestInvoiceMode =
      payload.mode === "suspicious" ? "suspicious" : "normal"

    const workflows =
      (await throwIfSupabaseError(
        await supabase
          .from("workflows")
          .select("id,product_id,quantity,target_price_min,target_price_max")
          .not("product_id", "is", null)
          .limit(50)
      )) ?? []

    const workflow = pickRandom(
      workflows.filter(
        (item) => typeof item.product_id === "string" && item.product_id.length > 0
      )
    )

    const product = await throwIfSupabaseError(
      await supabase
        .from("products")
        .select("id,sku,name,unit_price,primary_supplier_id")
        .eq("id", workflow.product_id)
        .single()
    )

    if (!product) {
      throw new Error("The selected workflow is missing its product context.")
    }

    let supplierId = product.primary_supplier_id as string | null

    if (!supplierId) {
      const productSupplier = await throwIfSupabaseError(
        await supabase
          .from("product_suppliers")
          .select("supplier_id")
          .eq("product_id", product.id)
          .order("is_primary", { ascending: false })
          .limit(1)
          .maybeSingle()
      )

      supplierId = productSupplier?.supplier_id ?? null
    }

    let supplier =
      supplierId != null
        ? await throwIfSupabaseError(
            await supabase
              .from("suppliers")
              .select("id,name,region")
              .eq("id", supplierId)
              .maybeSingle()
          )
        : null

    if (!supplier) {
      const suppliers =
        (await throwIfSupabaseError(
          await supabase.from("suppliers").select("id,name,region").limit(50)
        )) ?? []
      supplier = pickRandom(suppliers)
      supplierId = supplier.id
    }

    const baselineQuantity =
      workflow.quantity != null && Number(workflow.quantity) > 0
        ? Number(workflow.quantity)
        : randomIntBetween(500, 2000)

    const workflowPriceFloor =
      workflow.target_price_min != null ? Number(workflow.target_price_min) : null
    const workflowPriceCeiling =
      workflow.target_price_max != null ? Number(workflow.target_price_max) : null
    const baselineUnitPrice = roundCurrency(
      workflowPriceFloor != null && workflowPriceCeiling != null
        ? (workflowPriceFloor + workflowPriceCeiling) / 2
        : workflowPriceCeiling ??
            workflowPriceFloor ??
            Number(product.unit_price) ??
            randomNumberBetween(18, 45)
    )

    const currency = pickRandom(["USD", "MYR"] as const)
    const quantityVariance = Math.max(12, Math.round(baselineQuantity * 0.05))
    const suspiciousVarianceFloor = Math.max(80, Math.round(baselineQuantity * 0.18))
    const suspiciousVarianceCeiling = Math.max(180, Math.round(baselineQuantity * 0.42))

    const quantity =
      mode === "suspicious"
        ? baselineQuantity + randomIntBetween(suspiciousVarianceFloor, suspiciousVarianceCeiling)
        : Math.max(
            1,
            baselineQuantity + randomIntBetween(-quantityVariance, quantityVariance)
          )

    const unitPrice = roundCurrency(
      mode === "suspicious"
        ? baselineUnitPrice * randomNumberBetween(1.18, 1.42)
        : baselineUnitPrice * randomNumberBetween(0.98, 1.04)
    )

    const amount = roundCurrency(quantity * unitPrice)
    const paymentTerms =
      mode === "suspicious"
        ? pickRandom(["Net 7", "Immediate payment"])
        : pickRandom(["Net 15", "Net 30"])
    const bankDetails =
      mode === "suspicious"
        ? `Beneficiary: ${supplier.name} Settlement Hub | Account: 9988-4411-02 | SWIFT: ZXTRMYKL`
        : `Beneficiary: ${supplier.name} | Account: ${randomIntBetween(11000000, 99999999)} | Bank: Maybank`

    const invoiceId = id("inv")
    const invoiceNumber = `TEST-${mode === "suspicious" ? "S" : "N"}-${Date.now()}`

    await throwIfSupabaseError(
      await supabase.from("invoices").insert({
        id: invoiceId,
        invoice_number: invoiceNumber,
        supplier_id: supplierId,
        workflow_id: workflow.id,
        source_type: "image",
        file_url: "/test-files/invoice.png",
        processing_status: "idle",
        amount: amount,
        currency,
        quantity,
        payment_terms: paymentTerms,
        bank_details: bankDetails,
        validation_status: "parsed",
        risk_level: "low",
        approval_state: "waiting_approval",
      })
    )

    await throwIfSupabaseError(
      await supabase.from("invoice_products").insert({
        id: id("ivp"),
        invoice_id: invoiceId,
        product_id: product.id,
        quantity,
        unit_price: unitPrice,
        subtotal: amount,
      })
    )

    await throwIfSupabaseError(
      await supabase.from("invoice_actions").insert({
        id: id("ia"),
        invoice_id: invoiceId,
        action_type: "test_invoice_created",
        note:
          mode === "suspicious"
            ? `Created a suspicious test invoice for ${product.sku} with elevated quantity, higher unit price, and unusual bank details.`
            : `Created a normal test invoice for ${product.sku} with values close to the negotiated workflow range.`,
        actor_type: "system",
      })
    )

    revalidatePath("/dashboard")
    revalidatePath("/invoice-management")
    revalidatePath(`/invoice-management/${invoiceId}`)

    return {
      ok: true,
      message: "Test invoice created.",
      invoiceId,
    }
  } catch (error) {
    return {
      ...failure(error),
      invoiceId: undefined,
    }
  }
}

export async function createUploadedInvoiceAction(
  formData: FormData
): Promise<CreateUploadedInvoiceActionResult> {
  try {
    const supabase = requireSupabaseAdmin()
    const fileEntry = formData.get("file")

    if (!(fileEntry instanceof File)) {
      throw new Error("No file selected.")
    }

    if (fileEntry.size === 0) {
      throw new Error("The selected file is empty.")
    }

    const sourceType = invoiceSourceTypeForFile(fileEntry)
    const bucketName = await ensureInvoiceFilesBucket(supabase)
    const { workflow, supplier } = await selectInvoiceCreationContext(supabase)

    const invoiceId = id("inv")
    const safeName = sanitizeFileName(fileEntry.name)
    const storagePath = `uploads/${invoiceId}/${Date.now()}-${safeName}`
    const bytes = Buffer.from(await fileEntry.arrayBuffer())

    await throwIfSupabaseError(
      await supabase.storage.from(bucketName).upload(storagePath, bytes, {
        contentType: fileEntry.type || undefined,
        upsert: false,
      })
    )

    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(storagePath)
    const fileUrl = publicUrlData.publicUrl

    if (!fileUrl) {
      throw new Error("Could not build a public URL for the uploaded invoice file.")
    }

    const invoiceNumber = `UPL-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${invoiceId.slice(-6).toUpperCase()}`

    await throwIfSupabaseError(
      await supabase.from("invoices").insert({
        id: invoiceId,
        invoice_number: invoiceNumber,
        supplier_id: supplier.id,
        workflow_id: workflow.id,
        source_type: sourceType,
        file_url: fileUrl,
        amount: 0,
        currency: "USD",
        validation_status: "parsed",
        risk_level: "low",
        approval_state: "waiting_approval",
        processing_status: "idle",
      })
    )

    await throwIfSupabaseError(
      await supabase.from("invoice_actions").insert({
        id: id("ia"),
        invoice_id: invoiceId,
        action_type: "file_uploaded",
        note: `Uploaded invoice file ${safeName} to Supabase Storage bucket ${bucketName}.`,
        actor_type: "system",
      })
    )

    revalidatePath("/dashboard")
    revalidatePath("/invoice-management")
    revalidatePath(`/invoice-management/${invoiceId}`)

    return {
      ok: true,
      message: "Invoice created from uploaded file.",
      invoiceId,
    }
  } catch (error) {
    return {
      ...failure(error),
      invoiceId: undefined,
    }
  }
}

export async function extractInvoiceTextAction(
  payload: AnalyzeInvoicePayload
): Promise<ActionResult> {
  let invoiceId = payload.invoiceId
  try {
    const supabase = requireSupabase()

    if (!payload.invoiceId) {
      throw new Error("Missing invoice identifier.")
    }

    const invoice = await throwIfSupabaseError(
      await supabase
        .from("invoices")
        .select(
          "id,invoice_number,workflow_id,supplier_id,file_url,extracted_text,quantity,payment_terms,bank_details"
        )
        .eq("id", payload.invoiceId)
        .single()
    )

    if (!invoice) {
      throw new Error("Invoice no longer exists.")
    }

    invoiceId = invoice.id

    if (typeof invoice.extracted_text === "string" && invoice.extracted_text.trim()) {
      return success("Invoice text already extracted.")
    }

    if (!invoice.file_url) {
      throw new Error("Invoice file URL is missing.")
    }

    const extracted = await extractInvoiceDocumentText(invoice.file_url)
    const derivedFields = deriveInvoiceFieldsFromExtractedText(extracted.text)

    const updatePayload: Record<string, unknown> = {
      extracted_text: extracted.text,
    }

    if (invoice.quantity == null && typeof derivedFields.quantity === "number") {
      updatePayload.quantity = derivedFields.quantity
    }
    if (!invoice.payment_terms && derivedFields.paymentTerms) {
      updatePayload.payment_terms = derivedFields.paymentTerms
    }
    if (!invoice.bank_details && derivedFields.bankDetails) {
      updatePayload.bank_details = derivedFields.bankDetails
    }

    await throwIfSupabaseError(
      await supabase.from("invoices").update(updatePayload).eq("id", invoice.id)
    )

    await throwIfSupabaseError(
      await supabase.from("invoice_actions").insert({
        id: id("ia"),
        invoice_id: invoice.id,
        action_type: "text_extracted",
        note: `Extracted ${extracted.text.length.toLocaleString("en-US")} characters from the ${extracted.fileKind.toUpperCase()} invoice file using page limit 1, image max edge 1600px, and text truncation at 3000 characters.`,
        actor_type: "system",
      })
    )

    revalidatePath("/dashboard")
    revalidatePath("/invoice-management")
    revalidatePath("/invoice-management/completed")
    revalidatePath(`/invoice-management/${invoice.id}`)

    return success("Invoice text extraction completed.")
  } catch (error) {
    if (invoiceId) {
      try {
        const supabase = requireSupabase()
        await updateInvoiceProcessingStatus(supabase, invoiceId, "idle")
        await throwIfSupabaseError(
          await supabase.from("invoice_actions").insert({
            id: id("ia"),
            invoice_id: invoiceId,
            action_type: "text_extraction_failed",
            note:
              error instanceof Error && error.message
                ? `OCR extraction failed: ${error.message}`
                : "OCR extraction failed.",
            actor_type: "system",
          })
        )
      } catch (loggingError) {
        console.error(
          "[Invoice OCR] Failed to persist OCR failure state",
          debugSerialize({
            invoiceId,
            originalError:
              error instanceof Error ? error.message : String(error),
            loggingError:
              loggingError instanceof Error
                ? loggingError.message
                : String(loggingError),
          })
        )
      }
    }

    return failure(error)
  }
}

export async function analyzeInvoiceAction(
  payload: AnalyzeInvoicePayload
): Promise<ActionResult> {
  try {
    const supabase = requireSupabase()

    if (!payload.invoiceId) {
      throw new Error("Missing invoice identifier.")
    }

    const context = await buildInvoiceAnalysisContext(supabase, payload.invoiceId)
    console.info(
      "[Invoice AI] extracted_text preview",
      debugSerialize({
        invoiceId: context.invoice.id,
        extractedTextPreview: (context.invoice.extracted_text ?? "").slice(0, 500),
      })
    )

    if (context.invoice.ai_last_analyzed_at) {
      console.info(
        "[Invoice AI] Skipping analysis because ai_last_analyzed_at is already set",
        debugSerialize({
          invoiceId: context.invoice.id,
          aiLastAnalyzedAt: context.invoice.ai_last_analyzed_at,
        })
      )
      return success("Invoice already analyzed.")
    }

    let analysis = null as Awaited<ReturnType<typeof analyzeInvoiceWithAI>> | null
    let usedFallback = false
    let actionNotePrefix = "AI invoice analysis completed."

    try {
      console.info(
        "[Invoice AI] Starting analyzeInvoiceWithAI",
        debugSerialize({
          invoiceId: context.invoice.id,
          invoiceData: context.invoiceData,
          expectedData: context.expectedData,
        })
      )
      analysis = await analyzeInvoiceWithAIRetries(
        context.invoiceData,
        context.expectedData
      )
    } catch (error) {
      usedFallback = true
      console.error(
        "[Invoice AI] AI unavailable, using fallback",
        debugSerialize({
          invoiceId: context.invoice.id,
          error: error instanceof Error ? error.message : String(error),
        })
      )
      analysis = analyzeInvoiceWithFallback(context.invoiceData, context.expectedData)
      actionNotePrefix =
        error instanceof Error && error.message
          ? `AI analysis was unavailable, so rule-based fallback validation ran. ${error.message}`
          : "AI analysis was unavailable, so rule-based fallback validation ran."
    }

    console.info(
      "[Invoice AI] parsedInvoiceFields returned",
      debugSerialize({
        invoiceId: context.invoice.id,
        parsedInvoiceFields: analysis.parsedInvoiceFields,
      })
    )

    const repairResult = await repairInvoiceFieldsFromParsedData(
      supabase,
      context,
      analysis.parsedInvoiceFields,
      {
        allowFieldRepair: !usedFallback || analysis.parserReliability !== "low",
        parserReliability: analysis.parserReliability,
        rejectedValues: analysis.rejectedValues,
      }
    )
    console.info(
      "[Invoice AI] fields updated in invoice row",
      debugSerialize({
        invoiceId: context.invoice.id,
        updatedFields: repairResult.updatedFields,
      })
    )

    const validationInvoiceData =
      usedFallback && analysis.parserReliability === "low"
        ? context.invoiceData
        : applyParsedFieldsToInvoiceData(
            context.invoiceData,
            analysis.parsedInvoiceFields
          )
    console.info(
      "[Invoice AI] final invoiceData used for validation",
      debugSerialize({
        invoiceId: context.invoice.id,
        invoiceData: validationInvoiceData,
      })
    )

    const validationStatus = validationStatusFromIssues(analysis.issues)
    const confidencePercent = normalizeAiConfidencePercent(analysis.confidence)
    console.info(
      "[Invoice AI] Analysis completed",
      debugSerialize({
        invoiceId: context.invoice.id,
        usedFallback,
        parserReliability: analysis.parserReliability ?? null,
        rejectedValues: analysis.rejectedValues ?? [],
        riskLevel: analysis.riskLevel,
        issues: analysis.issues,
        confidencePercent,
      })
    )

    await throwIfSupabaseError(
      await supabase
        .from("invoice_validation_results")
        .delete()
        .eq("invoice_id", context.invoice.id)
        .like("check_name", "ai_%")
    )

    if (analysis.issues.length > 0) {
      const validationRows = analysis.issues.map((issue) => {
        const values = expectedActualValuesForIssue(
          issue,
          validationInvoiceData,
          context.expectedData
        )
        return {
          id: id("ivr"),
          invoice_id: context.invoice.id,
          check_name: checkNameForIssue(issue),
          expected_value: values.expectedValue,
          actual_value: values.actualValue,
          result: issue.severity === "low" ? "warning" : "failed",
        }
      })

      await throwIfSupabaseError(
        await supabase.from("invoice_validation_results").insert(validationRows)
      )
    }

    const invoiceUpdatePayload: Record<string, unknown> = {
      risk_level: analysis.riskLevel,
      validation_status: validationStatus,
    }

    if (usedFallback) {
      invoiceUpdatePayload.risk_confidence = null
      invoiceUpdatePayload.ai_summary = `Fallback validation only: ${analysis.summary}`
      invoiceUpdatePayload.ai_last_analyzed_at = null
    } else {
      invoiceUpdatePayload.risk_confidence = confidencePercent
      invoiceUpdatePayload.ai_summary = analysis.summary
      invoiceUpdatePayload.ai_last_analyzed_at = new Date().toISOString()
    }

    await throwIfSupabaseError(
      await supabase
        .from("invoices")
        .update(invoiceUpdatePayload)
        .eq("id", context.invoice.id)
    )

    const actionType = usedFallback ? "validation_fallback" : "ai_analysis"
    const parsedLineItemsNote = repairResult.parsedLineItemsNote
      ? ` Parsed line items: ${repairResult.parsedLineItemsNote}.`
      : ""
    const actionNote = `${actionNotePrefix} Risk ${analysis.riskLevel}. Confidence ${confidencePercent}%. ${analysis.summary}${parsedLineItemsNote}`

    await throwIfSupabaseError(
      await supabase.from("invoice_actions").insert({
        id: id("ia"),
        invoice_id: context.invoice.id,
        action_type: actionType,
        note: actionNote,
        actor_type: usedFallback ? "system" : "ai",
      })
    )

    revalidatePath("/dashboard")
    revalidatePath("/invoice-management")
    revalidatePath("/invoice-management/completed")
    revalidatePath("/conversations")
    revalidatePath(`/invoice-management/${context.invoice.id}`)
    if (context.conversationId) {
      revalidatePath(`/conversations/${context.conversationId}`)
    }
    context.inventorySkus.forEach((sku) => revalidatePath(`/inventory/${sku}`))

    return success(
      usedFallback
        ? "Fallback invoice validation completed."
        : "AI invoice validation completed."
    )
  } catch (error) {
    return failure(error)
  }
}

export async function processInvoicePipelineAction(
  payload: ProcessInvoicePipelinePayload
): Promise<ActionResult> {
  try {
    const supabase = requireSupabase()

    if (!payload.invoiceId) {
      throw new Error("Missing invoice identifier.")
    }

    const invoice = await throwIfSupabaseError(
      await supabase
        .from("invoices")
        .select("id,extracted_text,ai_last_analyzed_at,processing_status")
        .eq("id", payload.invoiceId)
        .single()
    )

    if (!invoice) {
      throw new Error("Invoice no longer exists.")
    }

    const needsExtraction = !invoice.extracted_text?.trim()
    const needsAnalysis = !invoice.ai_last_analyzed_at

    if (!needsExtraction && !needsAnalysis) {
      console.info(
        "[Invoice Pipeline] Skipping pipeline because extraction and analysis are already complete",
        debugSerialize({
          invoiceId: payload.invoiceId,
          aiLastAnalyzedAt: invoice.ai_last_analyzed_at,
        })
      )
      return success("Invoice pipeline already completed.")
    }

    if (invoice.processing_status && invoice.processing_status !== "idle") {
      console.info(
        "[Invoice Pipeline] Skipping pipeline because invoice is already processing",
        debugSerialize({
          invoiceId: payload.invoiceId,
          processingStatus: invoice.processing_status,
        })
      )
      return {
        ok: false,
        message: "Already processing",
      }
    }

    const claimed = await updateInvoiceProcessingStatus(
      supabase,
      payload.invoiceId,
      needsExtraction ? "extracting" : "analyzing",
      "idle"
    )

    if (!claimed) {
      return {
        ok: false,
        message: "Already processing",
      }
    }

    let extractionMessage: string | undefined
    let extractionError: string | undefined
    let analysisMessage: string | undefined

    try {
      if (needsExtraction) {
        const extractionResult = await extractInvoiceTextAction({
          invoiceId: payload.invoiceId,
        })
        if (extractionResult.ok) {
          extractionMessage = extractionResult.message
        } else {
          extractionError =
            extractionResult.message ?? "Invoice text extraction failed."
        }

        if (needsAnalysis) {
          await updateInvoiceProcessingStatus(
            supabase,
            payload.invoiceId,
            "analyzing",
            "extracting"
          )
        }
      }

      if (needsAnalysis) {
        const analysisResult = await analyzeInvoiceAction({
          invoiceId: payload.invoiceId,
        })
        if (!analysisResult.ok) {
          throw new Error(analysisResult.message ?? "Invoice analysis failed.")
        }
        analysisMessage = analysisResult.message
      }

      const parts = [
        extractionMessage,
        extractionError
          ? `Extraction skipped with error: ${extractionError}`
          : undefined,
        analysisMessage,
      ].filter(Boolean)

      return success(parts.join(" ") || "Invoice pipeline completed.")
    } finally {
      await updateInvoiceProcessingStatus(
        supabase,
        payload.invoiceId,
        "idle"
      )
    }
  } catch (error) {
    return failure(error)
  }
}

async function getInvoiceWorkflowProductSku(
  supabase: AppSupabaseClient,
  workflowId?: string | null
) {
  if (!workflowId) {
    return undefined
  }

  const workflow = await throwIfSupabaseError(
    await supabase
      .from("workflows")
      .select("id,product_id")
      .eq("id", workflowId)
      .single()
  )

  if (!workflow?.product_id) {
    return undefined
  }

  const workflowProduct = await throwIfSupabaseError(
    await supabase
      .from("products")
      .select("sku")
      .eq("id", workflow.product_id)
      .single()
  )

  return workflowProduct?.sku as string | undefined
}

async function syncInvoiceWorkflowState(
  supabase: AppSupabaseClient,
  invoice: {
    id: string
    workflow_id?: string | null
    invoice_number: string
  },
  options: {
    invoiceApprovalState: "waiting_approval" | "needs_review" | "blocked" | "completed"
    workflowState?: "ready_for_approval" | "invoice_processing" | "blocked" | "completed"
    workflowApprovalState?: "waiting_approval" | "needs_review" | "blocked" | "completed"
    actionType: string
    note: string
    actorType: "merchant" | "system" | "finance"
    completeWorkflow?: boolean
  }
) {
  const workflowProductSku = await getInvoiceWorkflowProductSku(
    supabase,
    invoice.workflow_id
  )

  await throwIfSupabaseError(
    await supabase
      .from("invoices")
      .update({ approval_state: options.invoiceApprovalState })
      .eq("id", invoice.id)
  )

  if (invoice.workflow_id) {
    if (options.completeWorkflow) {
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
    } else if (options.workflowState && options.workflowApprovalState) {
      await throwIfSupabaseError(
        await supabase
          .from("workflows")
          .update({
            current_state: options.workflowState,
            approval_state: options.workflowApprovalState,
          })
          .eq("id", invoice.workflow_id)
      )
    }
  }

  await throwIfSupabaseError(
    await supabase.from("invoice_actions").insert({
      id: id("ia"),
      invoice_id: invoice.id,
      action_type: options.actionType,
      note: options.note,
      actor_type: options.actorType,
    })
  )

  revalidateInvoicePaths(invoice.id, workflowProductSku)
  return workflowProductSku
}

async function getInvoiceDecisionRecord(
  supabase: AppSupabaseClient,
  invoiceId: string
) {
  const invoice = await throwIfSupabaseError(
    await supabase
      .from("invoices")
      .select("id,invoice_number,workflow_id,approval_state")
      .eq("id", invoiceId)
      .single()
  )

  if (!invoice) {
    throw new Error("Invoice no longer exists.")
  }

  return invoice
}

export async function approveInvoiceAction(invoiceId: string): Promise<ActionResult> {
  try {
    const supabase = requireSupabase()
    const invoice = await getInvoiceDecisionRecord(supabase, invoiceId)

    if (invoice.approval_state === "completed") {
      return success(`Invoice ${invoice.invoice_number} is already completed.`)
    }

    if (invoice.approval_state === "blocked") {
      return failure(new Error("Blocked invoices cannot be sent to mock payment."))
    }

    await syncInvoiceWorkflowState(supabase, invoice, {
      invoiceApprovalState: "waiting_approval",
      workflowState: "ready_for_approval",
      workflowApprovalState: "waiting_approval",
      actionType: "approved",
      note: "Invoice approved and sent to mock payment.",
      actorType: "merchant",
    })

    return success(`Invoice ${invoice.invoice_number} approved for mock payment.`)
  } catch (error) {
    return failure(error)
  }
}

export async function holdReviewInvoiceAction(
  invoiceId: string
): Promise<ActionResult> {
  try {
    const supabase = requireSupabase()
    const invoice = await getInvoiceDecisionRecord(supabase, invoiceId)

    if (invoice.approval_state === "completed") {
      return success(`Invoice ${invoice.invoice_number} is already completed.`)
    }

    if (invoice.approval_state === "needs_review") {
      return success(`Invoice ${invoice.invoice_number} is already on hold for review.`)
    }

    await syncInvoiceWorkflowState(supabase, invoice, {
      invoiceApprovalState: "needs_review",
      workflowState: "invoice_processing",
      workflowApprovalState: "needs_review",
      actionType: "hold_review",
      note: "Invoice was held for additional review.",
      actorType: "merchant",
    })

    return success(`Invoice ${invoice.invoice_number} moved to review.`)
  } catch (error) {
    return failure(error)
  }
}

export async function rejectInvoiceAction(invoiceId: string): Promise<ActionResult> {
  try {
    const supabase = requireSupabase()
    const invoice = await getInvoiceDecisionRecord(supabase, invoiceId)

    if (invoice.approval_state === "blocked") {
      return success(`Invoice ${invoice.invoice_number} is already blocked.`)
    }

    if (invoice.approval_state === "completed") {
      return success(`Invoice ${invoice.invoice_number} is already completed.`)
    }

    await syncInvoiceWorkflowState(supabase, invoice, {
      invoiceApprovalState: "blocked",
      workflowState: "blocked",
      workflowApprovalState: "blocked",
      actionType: "rejected",
      note: "Invoice was rejected or blocked by merchant review.",
      actorType: "merchant",
    })

    return success(`Invoice ${invoice.invoice_number} was blocked.`)
  } catch (error) {
    return failure(error)
  }
}

export async function markInvoiceCompletedAction(
  invoiceId: string
): Promise<ActionResult> {
  try {
    const supabase = requireSupabase()
    const invoice = await getInvoiceDecisionRecord(supabase, invoiceId)

    if (invoice.approval_state === "completed") {
      return success(`Invoice ${invoice.invoice_number} is already completed.`)
    }

    await syncInvoiceWorkflowState(supabase, invoice, {
      invoiceApprovalState: "completed",
      workflowState: "completed",
      workflowApprovalState: "completed",
      actionType: "completed",
      note: "Invoice settlement was marked completed.",
      actorType: "merchant",
      completeWorkflow: true,
    })

    return success(`Invoice ${invoice.invoice_number} marked completed.`)
  } catch (error) {
    return failure(error)
  }
}

export async function completeMockPaymentAction(
  payload: CompleteMockPaymentPayload
): Promise<ActionResult> {
  try {
    const supabase = requireSupabase()

    if (!payload.invoiceId) {
      throw new Error("Missing invoice identifier.")
    }

    if (!payload.paymentMethod?.trim()) {
      throw new Error("Choose a payment method before confirming payment.")
    }

    const invoice = await getInvoiceDecisionRecord(supabase, payload.invoiceId)

    if (invoice.approval_state === "completed") {
      return success(`Invoice ${invoice.invoice_number} is already completed.`)
    }

    if (invoice.approval_state === "blocked") {
      return failure(new Error("Invoice is blocked and cannot be paid."))
    }

    await syncInvoiceWorkflowState(supabase, invoice, {
      invoiceApprovalState: "completed",
      workflowState: "completed",
      workflowApprovalState: "completed",
      actionType: "mock_payment_completed",
      note: `Mock payment completed using ${payload.paymentMethod}.`,
      actorType: "merchant",
      completeWorkflow: true,
    })

    return success(`Mock payment completed for invoice ${invoice.invoice_number}.`)
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
