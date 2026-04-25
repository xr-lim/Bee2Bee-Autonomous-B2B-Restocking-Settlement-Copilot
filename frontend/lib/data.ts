import { getSupabaseServerClient } from "@/lib/supabase/server"
import type {
  Conversation,
  ConversationSource,
  Invoice,
  NegotiationMessage,
  Product,
  RestockRecommendation,
  RestockRequest,
  StockStatus,
  Supplier,
  ThresholdChangeRequest,
  WorkflowState,
} from "@/lib/types"

type DashboardKpi = {
  title: string
  value: string
  change?: string
  tone: "default" | "success" | "warning" | "danger" | "ai"
}

type InsightCards = {
  thresholdRecommendation: {
    title: string
    value: string
    body: string
  }
  recentSupplierActivity: string[]
  approvalQueueSummary: {
    invoices: number
    thresholdChanges: number
    replenishmentOrders: number
  }
}

type StockTrendPoint = {
  date: string
  primaryLabel: string
  primaryStock: number
  primaryThreshold: number
  secondaryLabel: string
  secondaryStock: number
  secondaryThreshold: number
  tertiaryLabel: string
  tertiaryStock: number
  tertiaryThreshold: number
}

type MonthlyDemandPoint = {
  month: string
  demand: number
  promo: string
}

type InventorySummaryStat = {
  title: string
  value: string
  change: string
  tone: "default" | "success" | "warning" | "danger" | "ai"
}

type InventoryHealthItem = {
  name: string
  count: number
  color: string
}

type SupplierExposureItem = {
  supplier: string
  products: number
  color: string
}

type ProductStockDemandPoint = {
  month: string
  stock: number
  demand: number
  promotion: string
}

type ProductMonthlySummaryPoint = {
  month: string
  averageSales: number
  seasonalSpike: string
  promotionNote: string
}

type ProductStockDemandTrendMap = Record<string, ProductStockDemandPoint[]>
type ProductMonthlySummaryMap = Record<string, ProductMonthlySummaryPoint[]>

type ThresholdAnalysisMap = Record<
  string,
  {
    currentThreshold: number
    recommendedThreshold: number
    confidenceScore: number
    explanation: string
  }
>

type SupplierBatchAdvantageMap = Record<string, string>

type InvoiceRiskLevelItem = {
  name: string
  count: number
  color: string
}

type ApprovalPipelineItem = {
  name: string
  count: number
  color: string
}

type SupplierInvoiceVolumeItem = {
  supplier: string
  invoices: number
  color: string
}

type RawSupplier = {
  id: string
  name: string
  region: string
  leadTimeDays: number
  reliabilityScore: number
  status?: Supplier["status"]
  moq?: number | null
  notes?: string | null
  createdAt?: string
  updatedAt?: string
}

type RawProduct = {
  id: string
  sku: string
  name: string
  category: string
  currentStock: number
  unitPrice: number
  currentThreshold?: number
  maxCapacity: number
  status: string
  primarySupplierId?: string | null
  createdAt?: string
  updatedAt?: string
}

type RawProductSupplier = {
  id: string
  productId: string
  supplierId: string
  isPrimary: boolean
  createdAt?: string
}

type RawProductStockDemandTrend = {
  id: string
  productId: string
  monthOrder: number
  month: string
  stock: number
  demand: number
  promotion: string
  createdAt?: string
  updatedAt?: string
}

type RawThresholdChangeRequest = {
  id: string
  productId: string
  oldThreshold: number
  proposedThreshold: number
  reasonType: string
  reasonSummary: string
  status: string
  reviewedBy?: string | null
  reviewedAt?: string | null
  createdAt?: string
  updatedAt?: string
}

type RawConversation = {
  id: string
  supplierId?: string | null
  title: string
  source: string
  state: string
  priority: "low" | "medium" | "high" | "critical"
  latestMessage?: string | null
  linkedInvoiceId?: string | null
  createdAt?: string
  updatedAt?: string
}

type RawConversationProduct = {
  id: string
  conversationId: string
  productId: string
}

type RawConversationMessage = {
  id: string
  conversationId: string
  senderType: "merchant" | "supplier" | "ai" | "system"
  messageType: string
  content: string
  attachmentUrl?: string | null
  extractedPrice?: number | null
  extractedQuantity?: number | null
  detectedIntent?: string | null
  missingFields?: string[] | null
  createdAt?: string
}

type RawWorkflow = {
  id: string
  productId?: string | null
  currentState: string
  targetPriceMin?: number | null
  targetPriceMax?: number | null
  quantity?: number | null
  conversationId?: string | null
  invoiceId?: string | null
  approvalState: string
  createdAt?: string
  updatedAt?: string
}

function productCurrentThreshold(product: RawProduct) {
  const legacy = product as RawProduct & Record<string, number | undefined>
  return (
    product.currentThreshold ??
    legacy[`ai${"Threshold"}`] ??
    legacy[`static${"Threshold"}`] ??
    0
  )
}

type RawRestockRequest = {
  id: string
  productId: string
  workflowId?: string | null
  targetPriceMin?: number | null
  targetPriceMax?: number | null
  requestedThreshold?: number | null
  requestedQuantity?: number | null
  reasonSummary: string
  status: string
  requestedBy: "ai" | "merchant" | "system"
  createdAt?: string
  updatedAt?: string
}

type RawSubmittedOrder = {
  id: string
  restockRequestId: string
  supplierId: string
  finalPrice: number
  finalQuantity: number
  status: string
  createdAt?: string
  updatedAt?: string
}

type RawInvoice = {
  id: string
  invoiceNumber: string
  supplierId?: string | null
  workflowId?: string | null
  orderId?: string | null
  sourceType: string
  fileUrl?: string | null
  extractedText?: string | null
  processingStatus?: "idle" | "extracting" | "analyzing"
  amount: number
  currency: string
  quantity?: number | null
  paymentTerms?: string | null
  bankDetails?: string | null
  riskConfidence?: number | null
  aiSummary?: string | null
  aiLastAnalyzedAt?: string | null
  validationStatus: string
  riskLevel: string
  approvalState: string
  createdAt?: string
  updatedAt?: string
}

type RawInvoiceProduct = {
  id: string
  invoiceId: string
  productId: string
  quantity: number
  unitPrice: number
  subtotal: number
}

type RawInvoiceValidationResult = {
  id: string
  invoiceId: string
  checkName: string
  expectedValue?: string | null
  actualValue?: string | null
  result: "passed" | "warning" | "failed"
  createdAt?: string
}

type RawInvoiceAction = {
  id: string
  invoiceId: string
  actionType: string
  note: string
  actorType: string
  createdAt?: string
}

function toCamelCase(input: string) {
  return input.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

function normalizeRowKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeRowKeys(item)) as T
  }

  if (value && typeof value === "object") {
    const normalizedEntries = Object.entries(value as Record<string, unknown>).map(
      ([key, nested]) => [toCamelCase(key), normalizeRowKeys(nested)]
    )
    return Object.fromEntries(normalizedEntries) as T
  }

  return value
}

async function selectRows<T>(table: string, fallback: T[] = []): Promise<T[]> {
  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return fallback
  }

  const { data, error } = await supabase.from(table).select("*")

  if (error) {
    console.error(`[supabase] failed reading table '${table}':`, error.message)
    return fallback
  }

  return normalizeRowKeys((data as T[]) ?? fallback)
}

async function selectOptionalRows<T>(
  table: string,
  fallback: T[] = []
): Promise<T[]> {
  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return fallback
  }

  const { data, error } = await supabase.from(table).select("*")

  if (error) {
    return fallback
  }

  return normalizeRowKeys((data as T[]) ?? fallback)
}

async function getDomainRows() {
  const [
    suppliers,
    products,
    productStockDemandTrends,
    productSuppliers,
    thresholdRequests,
    conversations,
    conversationProducts,
    conversationMessages,
    workflows,
    restockRequests,
    submittedOrders,
    invoices,
    invoiceProducts,
    invoiceValidationResults,
    invoiceActions,
  ] = await Promise.all([
    selectRows<RawSupplier>("suppliers"),
    selectRows<RawProduct>("products"),
    selectRows<RawProductStockDemandTrend>("product_stock_demand_trends"),
    selectRows<RawProductSupplier>("product_suppliers"),
    selectRows<RawThresholdChangeRequest>("threshold_change_requests"),
    selectRows<RawConversation>("conversations"),
    selectRows<RawConversationProduct>("conversation_products"),
    selectRows<RawConversationMessage>("conversation_messages"),
    selectRows<RawWorkflow>("workflows"),
    selectOptionalRows<RawRestockRequest>("restock_requests"),
    selectOptionalRows<RawSubmittedOrder>("submitted_orders"),
    selectRows<RawInvoice>("invoices"),
    selectRows<RawInvoiceProduct>("invoice_products"),
    selectRows<RawInvoiceValidationResult>("invoice_validation_results"),
    selectRows<RawInvoiceAction>("invoice_actions"),
  ])

  return {
    suppliers,
    products,
    productStockDemandTrends,
    productSuppliers,
    thresholdRequests,
    conversations,
    conversationProducts,
    conversationMessages,
    workflows,
    restockRequests,
    submittedOrders,
    invoices,
    invoiceProducts,
    invoiceValidationResults,
    invoiceActions,
  }
}

function formatMoneyRange(min?: number | null, max?: number | null) {
  if (min == null && max == null) return "Target pending"
  if (min != null && max != null) return `$${min.toFixed(2)} - $${max.toFixed(2)}`
  return `$${(min ?? max ?? 0).toFixed(2)}`
}

function formatMoney(value?: number | null) {
  return value == null ? "N/A" : `$${value.toFixed(2)}`
}

function formatSpend(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

function displaySource(source: string): ConversationSource {
  const sourceMap: Record<string, ConversationSource> = {
    email: "Email",
    whatsapp: "WhatsApp",
    telegram: "Telegram",
    wechat: "WeChat",
    pdf: "PDF",
    image: "Image",
    voice_note: "Voice Note",
  }

  return sourceMap[source] ?? "Email"
}

function displayState(state: string): Conversation["negotiationState"] {
  const stateMap: Record<string, Conversation["negotiationState"]> = {
    new_input: "New Input",
    needs_analysis: "Needs Analysis",
    counter_offer: "Counter Offer Suggested",
    waiting_reply: "Waiting Reply",
    accepted: "Accepted",
    escalated: "Escalated",
    closed: "Closed",
  }

  return stateMap[state] ?? "Needs Analysis"
}

function conversationStatus(
  state: Conversation["negotiationState"]
): Conversation["status"] {
  if (state === "Accepted" || state === "Closed") return "resolved"
  if (state === "Waiting Reply") return "waiting-supplier"
  if (state === "Needs Analysis" || state === "Escalated") return "needs-reply"
  return "negotiating"
}

function displayThresholdStatus(
  status: string
): ThresholdChangeRequest["status"] {
  if (status === "approved" || status === "rejected") return status
  return "pending"
}

function triggerFromReason(reasonType: string): ThresholdChangeRequest["trigger"] {
  const triggerMap: Record<string, ThresholdChangeRequest["trigger"]> = {
    demand_spike: "demand-spike",
    demand_drop: "demand-drop",
    lead_time_shift: "lead-time-shift",
    bundle_opportunity: "bundle-opportunity",
    new_product: "new-product",
  }

  return triggerMap[reasonType] ?? "demand-spike"
}

function displayApprovalState(state: string): Invoice["approvalState"] {
  const stateMap: Record<string, Invoice["approvalState"]> = {
    waiting_approval: "Waiting Approval",
    needs_review: "Needs Review",
    blocked: "Blocked",
    completed: "Completed",
  }

  return stateMap[state] ?? "Needs Review"
}

function displayValidationStatus(status: string): Invoice["validationStatus"] {
  const statusMap: Record<string, Invoice["validationStatus"]> = {
    parsed: "Parsed",
    validated: "Validated",
    mismatch_detected: "Mismatch Detected",
    missing_information: "Missing Information",
  }

  return statusMap[status] ?? "Parsed"
}

function displayRiskLevel(level: string): Invoice["riskLevel"] {
  const levelMap: Record<string, Invoice["riskLevel"]> = {
    low: "Low Risk",
    medium: "Medium Risk",
    high: "High Risk",
  }

  return levelMap[level] ?? "Medium Risk"
}

function titleCaseLabel(value?: string | null) {
  return (value ?? "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function latestTimestamp(...values: Array<string | null | undefined>) {
  return Math.max(
    ...values.map((value) => new Date(value ?? 0).getTime()),
    0
  )
}

function formatCurrencyLabel(
  currency: Invoice["currency"],
  value: number
) {
  return `${currency} ${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function humanizeCheckName(checkName: string) {
  return checkName
    .replace(/^ai_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function normalizeComparableText(value?: string | null) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ")
}

function amountMatchesExpectedRange(
  amount: number,
  expectedAmountMin: number | null,
  expectedAmountMax: number | null,
  fallbackAmount: number
) {
  if (expectedAmountMin != null && expectedAmountMax != null) {
    return amount >= expectedAmountMin - 0.005 && amount <= expectedAmountMax + 0.005
  }

  return Math.abs(amount - fallbackAmount) < 0.005
}

function isResolvedAiCheck(
  check: RawInvoiceValidationResult,
  context: {
    amount: number
    negotiatedAmount: number
    expectedAmountMin: number | null
    expectedAmountMax: number | null
    expectedQuantity: number
    invoiceQuantity: number
    currentCurrency: string
    expectedCurrency: string
    currentSupplierName: string
    expectedSupplierName: string
    bankDetails: string
    paymentTerms: string
    invoiceNumber: string
    lineItemCount: number
  }
) {
  const checkName = check.checkName.toLowerCase()
  const actualValue = normalizeComparableText(check.actualValue)

  if (checkName === "ai_amount_mismatch" || checkName === "amount_mismatch") {
    return amountMatchesExpectedRange(
      context.amount,
      context.expectedAmountMin,
      context.expectedAmountMax,
      context.negotiatedAmount
    )
  }

  if (checkName === "ai_quantity_mismatch" || checkName === "quantity_mismatch" || checkName === "ai_missing_quantity" || checkName === "missing_quantity") {
    return (
      context.invoiceQuantity > 0 &&
      context.expectedQuantity > 0 &&
      context.invoiceQuantity === context.expectedQuantity
    )
  }

  if (checkName === "ai_missing_supplier" || checkName === "missing_supplier" || checkName === "ai_supplier_mismatch" || checkName === "supplier_mismatch") {
    return (
      normalizeComparableText(context.currentSupplierName) !== "" &&
      normalizeComparableText(context.currentSupplierName) ===
        normalizeComparableText(context.expectedSupplierName)
    )
  }

  if (checkName === "ai_missing_payment_terms" || checkName === "missing_payment_terms") {
    return normalizeComparableText(context.paymentTerms) !== "not provided"
  }

  if (checkName === "ai_missing_bank_details" || checkName === "missing_bank_details" || checkName === "ai_bank_mismatch" || checkName === "bank_mismatch") {
    return normalizeComparableText(context.bankDetails) !== "not provided"
  }

  if ((checkName === "ai_missing_field" || checkName === "missing_field") && actualValue.includes("line item")) {
    return context.lineItemCount > 0
  }

  if ((checkName === "ai_missing_field" || checkName === "missing_field") && actualValue.includes("quantity is 0")) {
    return (
      context.invoiceQuantity > 0 &&
      context.expectedQuantity > 0 &&
      context.invoiceQuantity === context.expectedQuantity
    )
  }

  if ((checkName === "ai_missing_field" || checkName === "missing_field") && actualValue.includes("currency")) {
    return normalizeComparableText(context.currentCurrency) !== "" && normalizeComparableText(context.currentCurrency) !== "null"
  }

  if ((checkName === "ai_suspicious_value" || checkName === "suspicious_value") && actualValue.includes("currency mismatch")) {
    return (
      normalizeComparableText(context.currentCurrency) ===
      normalizeComparableText(context.expectedCurrency)
    )
  }

  if ((checkName === "ai_suspicious_value" || checkName === "suspicious_value") && (actualValue.includes("amount") || actualValue.includes("price") || actualValue.includes("total"))) {
    return (
      context.amount > 0 &&
      amountMatchesExpectedRange(
        context.amount,
        context.expectedAmountMin,
        context.expectedAmountMax,
        context.negotiatedAmount
      )
    )
  }

  if ((checkName === "ai_suspicious_value" || checkName === "suspicious_value") && actualValue.includes("quantity")) {
    return context.invoiceQuantity > 0 && context.invoiceQuantity === context.expectedQuantity
  }

  if (checkName.startsWith("ai_other_") && actualValue.includes("invoice number mismatch")) {
    return !context.invoiceNumber.toUpperCase().startsWith("UPL-")
  }

  return false
}

function displaySourceType(sourceType: string): Invoice["sourceType"] {
  const sourceMap: Record<string, Invoice["sourceType"]> = {
    pdf: "PDF",
    image: "Image",
    email_attachment: "Email Attachment",
    upload: "Upload",
  }

  return sourceMap[sourceType] ?? "Upload"
}

function invoiceStatus(approvalState: Invoice["approvalState"]): Invoice["status"] {
  if (approvalState === "Completed") return "paid"
  if (approvalState === "Blocked") return "blocked"
  if (approvalState === "Needs Review") return "exception"
  return "pending"
}

function addDays(dateValue: string | undefined, days: number) {
  const date = dateValue ? new Date(dateValue) : new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function fileNameFromUrl(fileUrl?: string | null) {
  if (!fileUrl) return "uploaded-invoice"
  return fileUrl.split("/").filter(Boolean).at(-1) ?? fileUrl
}

function reliabilityStatus(score: number): Supplier["status"] {
  if (score >= 90) return "preferred"
  if (score >= 80) return "watchlist"
  return "inactive"
}

const NEAR_THRESHOLD_BUFFER = 20

function classifyStockStatus(stock: number, threshold: number): StockStatus {
  if (stock < threshold) return "below-threshold"
  if (stock - threshold <= NEAR_THRESHOLD_BUFFER) return "near-threshold"
  return "healthy"
}

function resolveProductStatus(
  product: RawProduct,
  currentThreshold: number
): StockStatus {
  return classifyStockStatus(product.currentStock, currentThreshold)
}

function derivedTrend(status: StockStatus) {
  if (status === "below-threshold") return 12
  if (status === "near-threshold") return -6
  if (status === "batch-candidate") return 9
  return -2
}

function buildFallbackStockDemandTrendMap(
  products: Product[]
): ProductStockDemandTrendMap {
  return Object.fromEntries(
    products.map((product) => [
      product.sku,
      [
        {
          month: "May",
          stock: Math.round(product.stockOnHand * 1.6),
          demand: Math.max(0, Math.round(product.monthlyVelocity * 0.95)),
          promotion: "",
        },
        {
          month: "Jun",
          stock: Math.round(product.stockOnHand * 1.4),
          demand: Math.round(product.monthlyVelocity * 1.05),
          promotion: "Payday Sale",
        },
        {
          month: "Jul",
          stock: Math.round(product.stockOnHand * 1.2),
          demand: Math.max(0, Math.round(product.monthlyVelocity * 0.93)),
          promotion: "",
        },
        {
          month: "Aug",
          stock: Math.round(product.stockOnHand * 1.1),
          demand: Math.round(product.monthlyVelocity * 0.97),
          promotion: "",
        },
        {
          month: "Sep",
          stock: Math.round(product.stockOnHand * 0.95),
          demand: Math.round(product.monthlyVelocity * 1.0),
          promotion: "Payday Sale",
        },
        {
          month: "Oct",
          stock: Math.round(product.stockOnHand * 0.85),
          demand: Math.round(product.monthlyVelocity * 1.02),
          promotion: "",
        },
        {
          month: "Nov",
          stock: Math.round(product.stockOnHand * 0.7),
          demand: Math.round(product.monthlyVelocity * 1.3),
          promotion: "11.11",
        },
        {
          month: "Dec",
          stock: Math.round(product.stockOnHand * 1.05),
          demand: Math.round(product.monthlyVelocity * 1.08),
          promotion: "Holiday",
        },
        {
          month: "Jan",
          stock: Math.round(product.stockOnHand * 0.9),
          demand: Math.round(product.monthlyVelocity * 0.96),
          promotion: "",
        },
        {
          month: "Feb",
          stock: Math.round(product.stockOnHand * 0.82),
          demand: Math.round(product.monthlyVelocity * 0.99),
          promotion: "Payday Sale",
        },
        {
          month: "Mar",
          stock: Math.round(product.stockOnHand * 0.7),
          demand: Math.round(product.monthlyVelocity * 1.1),
          promotion: "Raya",
        },
        {
          month: "Apr",
          stock: product.stockOnHand,
          demand: product.monthlyVelocity,
          promotion: "",
        },
      ],
    ])
  )
}

function mapSuppliers(suppliers: RawSupplier[]): Supplier[] {
  return suppliers.map((supplier) => ({
    id: supplier.id,
    name: supplier.name,
    region: supplier.region,
    reliabilityScore: Number(supplier.reliabilityScore),
    leadTimeDays: supplier.leadTimeDays,
    status:
      supplier.status ?? reliabilityStatus(Number(supplier.reliabilityScore)),
  }))
}

function mapProducts(rows: Awaited<ReturnType<typeof getDomainRows>>): Product[] {
  const suppliersById = new Map(rows.suppliers.map((supplier) => [supplier.id, supplier]))
  const conversationsByProductId = new Map<string, RawConversation>()
  const invoicesByProductId = new Map<string, RawInvoice>()

  rows.conversationProducts.forEach((link) => {
    const conversation = rows.conversations.find(
      (item) => item.id === link.conversationId
    )
    if (conversation) conversationsByProductId.set(link.productId, conversation)
  })

  rows.invoiceProducts.forEach((line) => {
    const invoice = rows.invoices.find((item) => item.id === line.invoiceId)
    if (invoice) invoicesByProductId.set(line.productId, invoice)
  })

  return rows.products.map((product) => {
    const currentThreshold = productCurrentThreshold(product)
    const status = resolveProductStatus(product, currentThreshold)
    const supplierLinks = rows.productSuppliers.filter(
      (link) => link.productId === product.id
    )
    const primarySupplierId =
      product.primarySupplierId ??
      supplierLinks.find((link) => link.isPrimary)?.supplierId ??
      supplierLinks[0]?.supplierId ??
      ""
    const trend30d = derivedTrend(status)

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      stockOnHand: product.currentStock,
      currentThreshold,
      unitCost: Number(product.unitPrice),
      maxStockAmount: product.maxCapacity,
      forecastDemand: Math.max(currentThreshold * 2, product.currentStock),
      monthlyVelocity: Math.max(
        0,
        Math.round((product.maxCapacity - product.currentStock) * 0.45)
      ),
      trend30d,
      trend365d: Math.max(0, trend30d + 14),
      supplierId: primarySupplierId,
      conversationId: conversationsByProductId.get(product.id)?.id ?? "",
      invoiceId: invoicesByProductId.get(product.id)?.id ?? "",
      status,
      pendingAiAnalysis: product.status === "batch_candidate",
      suppliers: supplierLinks.map((link) => {
        const supplier = suppliersById.get(link.supplierId)

        return {
          supplierId: link.supplierId,
          lastDealPrice: Number(product.unitPrice),
          lastDealDate: link.createdAt ?? product.updatedAt ?? product.createdAt ?? "",
          leadTimeDays: supplier?.leadTimeDays ?? 0,
          moq: supplier?.moq ?? 0,
          reliabilityScore: Number(supplier?.reliabilityScore ?? 0),
          preferred: link.isPrimary,
          note: supplier?.notes ?? undefined,
        }
      }),
    }
  })
}

function mapThresholdRequests(
  rows: Awaited<ReturnType<typeof getDomainRows>>
): ThresholdChangeRequest[] {
  const productById = new Map(rows.products.map((product) => [product.id, product]))

  return rows.thresholdRequests.map((request) => {
    const product = productById.get(request.productId)
    const changePercent =
      request.oldThreshold === 0
        ? 0
        : Math.round(
            ((request.proposedThreshold - request.oldThreshold) /
              request.oldThreshold) *
              100
          )

    return {
      id: request.id,
      productSku: product?.sku ?? request.productId,
      productName: product?.name ?? "Unknown product",
      currentThreshold: request.oldThreshold,
      proposedThreshold: request.proposedThreshold,
      changePercent,
      reason: request.reasonSummary,
      proposedAt: request.createdAt ?? "",
      status: displayThresholdStatus(request.status),
      trigger: triggerFromReason(request.reasonType),
    }
  })
}

function activeRestockRequestPriority(
  request: RawRestockRequest,
  workflows: RawWorkflow[]
) {
  const workflow = request.workflowId
    ? workflows.find((item) => item.id === request.workflowId)
    : undefined
  const hasActiveWorkflow =
    workflow != null && workflow.currentState !== "completed"

  if (request.status === "accepted" && hasActiveWorkflow) return 4
  if (request.status === "accepted") return 3
  if (request.status === "reviewed") return 2
  if (request.status === "pending") return 1
  return 0
}

function selectEffectiveActiveRestockRequests(
  rows: Awaited<ReturnType<typeof getDomainRows>>
) {
  const activeRequests = rows.restockRequests.filter((request) =>
    ["pending", "reviewed", "accepted"].includes(request.status)
  )
  const grouped = new Map<string, RawRestockRequest[]>()

  activeRequests.forEach((request) => {
    const existing = grouped.get(request.productId) ?? []
    existing.push(request)
    grouped.set(request.productId, existing)
  })

  return new Map(
    Array.from(grouped.entries()).map(([productId, requests]) => {
      const selected = requests
        .slice()
        .sort((first, second) => {
          const priorityDiff =
            activeRestockRequestPriority(second, rows.workflows) -
            activeRestockRequestPriority(first, rows.workflows)

          if (priorityDiff !== 0) {
            return priorityDiff
          }

          return (
            new Date(second.updatedAt ?? second.createdAt ?? 0).getTime() -
            new Date(first.updatedAt ?? first.createdAt ?? 0).getTime()
          )
        })[0]

      return [productId, selected]
    })
  )
}

function mapRestockRequests(
  rows: Awaited<ReturnType<typeof getDomainRows>>
): RestockRequest[] {
  const productById = new Map(rows.products.map((product) => [product.id, product]))
  const effectiveActiveRequests = selectEffectiveActiveRestockRequests(rows)

  return rows.restockRequests
    .filter((request) => {
      if (!["pending", "reviewed", "accepted"].includes(request.status)) {
        return true
      }

      return effectiveActiveRequests.get(request.productId)?.id === request.id
    })
    .sort(
      (first, second) =>
        new Date(second.updatedAt ?? second.createdAt ?? 0).getTime() -
        new Date(first.updatedAt ?? first.createdAt ?? 0).getTime()
    )
    .map((request) => {
      const product = productById.get(request.productId)

      return {
        id: request.id,
        productSku: product?.sku ?? request.productId,
        productName: product?.name ?? "Unknown product",
        workflowId: request.workflowId ?? undefined,
        targetPriceMin:
          request.targetPriceMin == null ? undefined : Number(request.targetPriceMin),
        targetPriceMax:
          request.targetPriceMax == null ? undefined : Number(request.targetPriceMax),
        requestedThreshold: request.requestedThreshold ?? undefined,
        requestedQuantity: request.requestedQuantity ?? undefined,
        reason: request.reasonSummary,
        status:
          request.status === "reviewed" ||
          request.status === "accepted" ||
          request.status === "rejected" ||
          request.status === "cancelled"
            ? request.status
            : "pending",
        requestedBy: request.requestedBy,
        createdAt: request.createdAt ?? "",
        updatedAt: request.updatedAt ?? request.createdAt ?? "",
      }
    })
}

function latestMessageForConversation(
  messages: RawConversationMessage[],
  conversationId: string
) {
  return messages
    .filter((message) => message.conversationId === conversationId)
    .sort(
      (first, second) =>
        new Date(second.createdAt ?? 0).getTime() -
        new Date(first.createdAt ?? 0).getTime()
    )[0]
}

function mapConversations(
  rows: Awaited<ReturnType<typeof getDomainRows>>
): Conversation[] {
  const productById = new Map(rows.products.map((product) => [product.id, product]))
  const workflowByConversationId = new Map<string, RawWorkflow>()
  rows.workflows
    .filter((workflow) => Boolean(workflow.conversationId))
    .forEach((workflow) => {
      const conversationId = workflow.conversationId as string
      const current = workflowByConversationId.get(conversationId)
      if (
        !current ||
        latestTimestamp(workflow.updatedAt, workflow.createdAt) >=
          latestTimestamp(current.updatedAt, current.createdAt)
      ) {
        workflowByConversationId.set(conversationId, workflow)
      }
    })
  const restockRequestById = new Map(
    rows.restockRequests.map((request) => [request.id, request])
  )
  const latestOrderByWorkflowId = new Map<string, RawSubmittedOrder>()

  rows.submittedOrders.forEach((order) => {
    const request = restockRequestById.get(order.restockRequestId)
    const workflowId = request?.workflowId
    if (!workflowId) return

    const current = latestOrderByWorkflowId.get(workflowId)
    if (
      !current ||
      latestTimestamp(order.updatedAt, order.createdAt) >=
        latestTimestamp(current.updatedAt, current.createdAt)
    ) {
      latestOrderByWorkflowId.set(workflowId, order)
    }
  })

  const latestInvoiceByOrderId = new Map<string, RawInvoice>()
  const latestInvoiceByWorkflowId = new Map<string, RawInvoice>()

  rows.invoices.forEach((invoice) => {
    if (invoice.orderId) {
      const current = latestInvoiceByOrderId.get(invoice.orderId)
      if (
        !current ||
        latestTimestamp(invoice.updatedAt, invoice.createdAt) >=
          latestTimestamp(current.updatedAt, current.createdAt)
      ) {
        latestInvoiceByOrderId.set(invoice.orderId, invoice)
      }
    }

    if (invoice.workflowId) {
      const current = latestInvoiceByWorkflowId.get(invoice.workflowId)
      if (
        !current ||
        latestTimestamp(invoice.updatedAt, invoice.createdAt) >=
          latestTimestamp(current.updatedAt, current.createdAt)
      ) {
        latestInvoiceByWorkflowId.set(invoice.workflowId, invoice)
      }
    }
  })

  return rows.conversations.map((conversation) => {
    const linkedSkus = rows.conversationProducts
      .filter((link) => link.conversationId === conversation.id)
      .map((link) => productById.get(link.productId)?.sku)
      .filter((sku): sku is string => Boolean(sku))
    const workflow = workflowByConversationId.get(conversation.id)
    const submittedOrder = workflow?.id
      ? latestOrderByWorkflowId.get(workflow.id)
      : undefined
    const linkedInvoice =
      (submittedOrder?.id
        ? latestInvoiceByOrderId.get(submittedOrder.id)
        : undefined) ??
      (workflow?.id ? latestInvoiceByWorkflowId.get(workflow.id) : undefined)
    const latestMessage = latestMessageForConversation(
      rows.conversationMessages,
      conversation.id
    )
    const state = displayState(conversation.state)
    const missingFields = latestMessage?.missingFields ?? []
    const linkedInvoiceStatus = linkedInvoice
      ? `Received · ${displayApprovalState(linkedInvoice.approvalState)}`
      : submittedOrder
        ? "Awaiting invoice"
        : "Pending"
    const submittedOrderStatus = submittedOrder
      ? titleCaseLabel(submittedOrder.status)
      : undefined

    return {
      id: conversation.id,
      productSku: linkedSkus[0] ?? "",
      linkedSkus,
      supplierId: conversation.supplierId ?? "",
      workflowId: workflow?.id ?? undefined,
      submittedOrderId: submittedOrder?.id ?? undefined,
      submittedOrderStatus,
      linkedInvoiceId:
        linkedInvoice?.id ?? conversation.linkedInvoiceId ?? undefined,
      subject: conversation.title,
      source: displaySource(conversation.source),
      negotiationState: state,
      latestMessage:
        conversation.latestMessage ?? latestMessage?.content ?? "No message yet.",
      targetPriceRange: formatMoneyRange(
        workflow?.targetPriceMin,
        workflow?.targetPriceMax
      ),
      createdDate: conversation.createdAt ?? "",
      priority: conversation.priority,
      lastMessageAt:
        latestMessage?.createdAt ?? conversation.updatedAt ?? conversation.createdAt ?? "",
      status: conversationStatus(state),
      aiExtraction: {
        extractedPrice: formatMoney(latestMessage?.extractedPrice),
        extractedQuantity:
          latestMessage?.extractedQuantity == null
            ? "N/A"
            : latestMessage.extractedQuantity.toLocaleString("en-US"),
        deliveryEstimate: "Pending supplier confirmation",
        supplierLanguage: "English",
        detectedIntent: latestMessage?.detectedIntent ?? "needs_analysis",
        missingFields,
        confidenceScore: missingFields.length > 0 ? 88 : 94,
      },
      nextAction: {
        recommendedNextStep:
          submittedOrder && !linkedInvoice
            ? "Await supplier invoice for the accepted order."
            : linkedInvoice
              ? "Review linked invoice in Invoice Management."
              : nextConversationStep(state, missingFields),
        negotiationSummary:
          latestMessage?.content ??
          conversation.latestMessage ??
          "No negotiation summary available yet.",
        linkedInvoiceStatus,
      },
    }
  })
}

function nextConversationStep(
  state: Conversation["negotiationState"],
  missingFields: string[]
) {
  if (missingFields.length > 0) {
    return `Request ${missingFields.join(", ")} from supplier.`
  }
  if (state === "Accepted") return "Route linked invoice for approval."
  if (state === "Waiting Reply") return "Follow up with supplier."
  if (state === "Counter Offer Suggested") return "Confirm terms inside target range."
  if (state === "Escalated") return "Escalate for operator review."
  return "Review extracted supplier terms."
}

function messageType(message: RawConversationMessage): NegotiationMessage["type"] {
  if (message.senderType === "supplier") return "supplier-message"
  if (message.senderType === "merchant") return "merchant-action"
  if (message.senderType === "ai") return "ai-recommendation"
  return "ai-interpretation"
}

function attachmentType(
  messageTypeValue: string
): NegotiationMessage["attachmentType"] | undefined {
  const attachmentMap: Record<string, NegotiationMessage["attachmentType"]> = {
    email: "email",
    pdf: "pdf",
    image: "image",
    voice_note: "voice",
  }

  return attachmentMap[messageTypeValue]
}

function mapMessages(
  rows: Awaited<ReturnType<typeof getDomainRows>>
): NegotiationMessage[] {
  const mappedConversations = mapConversations(rows)
  const conversationsById = new Map(
    mappedConversations.map((conversation) => [conversation.id, conversation])
  )

  return rows.conversationMessages.map((message) => {
    const type = messageType(message)
    const attachment = attachmentType(message.messageType)

    return {
      id: message.id,
      conversationId: message.conversationId,
      supplierId: conversationsById.get(message.conversationId)?.supplierId ?? "",
      type,
      author: message.senderType,
      body: message.content,
      sentiment:
        (message.missingFields?.length ?? 0) > 0
          ? "risk"
          : message.senderType === "ai"
            ? "positive"
            : "neutral",
      createdAt: message.createdAt ?? "",
      attachmentType: attachment,
      attachmentLabel: attachment
        ? fileNameFromUrl(message.attachmentUrl) || `${attachment} attachment`
        : undefined,
      invoiceId: conversationsById.get(message.conversationId)?.linkedInvoiceId ?? undefined,
      language: "EN",
    }
  })
}

function mapInvoices(rows: Awaited<ReturnType<typeof getDomainRows>>): Invoice[] {
  const productById = new Map(rows.products.map((product) => [product.id, product]))
  const workflowById = new Map(rows.workflows.map((workflow) => [workflow.id, workflow]))
  const supplierById = new Map(rows.suppliers.map((supplier) => [supplier.id, supplier]))
  const restockRequestById = new Map(
    rows.restockRequests.map((request) => [request.id, request])
  )
  const orderById = new Map(rows.submittedOrders.map((order) => [order.id, order]))
  const latestOrderByWorkflowId = new Map<string, RawSubmittedOrder>()

  rows.submittedOrders.forEach((order) => {
    const request = restockRequestById.get(order.restockRequestId)
    const workflowId = request?.workflowId
    if (!workflowId) return

    const current = latestOrderByWorkflowId.get(workflowId)
    if (
      !current ||
      latestTimestamp(order.updatedAt, order.createdAt) >=
        latestTimestamp(current.updatedAt, current.createdAt)
    ) {
      latestOrderByWorkflowId.set(workflowId, order)
    }
  })

  return rows.invoices.map((invoice) => {
    const lines = rows.invoiceProducts.filter((line) => line.invoiceId === invoice.id)
    const checks = rows.invoiceValidationResults.filter(
      (check) => check.invoiceId === invoice.id
    )
    const aiChecks = checks.filter((check) => /^ai_/i.test(check.checkName))
    const activeChecks = aiChecks.length > 0 ? aiChecks : checks
    const actions = rows.invoiceActions
      .filter((action) => action.invoiceId === invoice.id)
      .sort(
        (first, second) =>
          new Date(first.createdAt ?? 0).getTime() -
          new Date(second.createdAt ?? 0).getTime()
      )
    const linkedSkus = lines
      .map((line) => productById.get(line.productId)?.sku)
      .filter((sku): sku is string => Boolean(sku))
    const submittedOrder =
      (invoice.orderId ? orderById.get(invoice.orderId) : undefined) ??
      (invoice.workflowId ? latestOrderByWorkflowId.get(invoice.workflowId) : undefined)
    const derivedWorkflowId =
      invoice.workflowId ??
      (submittedOrder
        ? restockRequestById.get(submittedOrder.restockRequestId)?.workflowId ?? undefined
        : undefined)
    const workflow = derivedWorkflowId ? workflowById.get(derivedWorkflowId) : undefined
    const subtotal = lines.reduce((total, line) => total + Number(line.subtotal), 0)
    const invoiceQuantity =
      invoice.quantity ??
      lines.reduce((total, line) => total + Number(line.quantity), 0)
    const expectedQuantity = submittedOrder?.finalQuantity ?? workflow?.quantity ?? 0
    const expectedUnitPrice =
      submittedOrder?.finalPrice != null ? Number(submittedOrder.finalPrice) : null
    const expectedAmountMin =
      expectedUnitPrice != null && expectedQuantity > 0
        ? Number((expectedUnitPrice * expectedQuantity).toFixed(2))
        : workflow?.targetPriceMin != null && expectedQuantity > 0
          ? Number(workflow.targetPriceMin) * expectedQuantity
          : null
    const expectedAmountMax =
      expectedUnitPrice != null && expectedQuantity > 0
        ? Number((expectedUnitPrice * expectedQuantity).toFixed(2))
        : workflow?.targetPriceMax != null && expectedQuantity > 0
          ? Number(workflow.targetPriceMax) * expectedQuantity
          : null
    const negotiatedAmount = (() => {
      if (expectedAmountMax != null) return expectedAmountMax
      if (expectedAmountMin != null) return expectedAmountMin
      if (subtotal > 0 && (submittedOrder || workflow)) return subtotal
      if (!submittedOrder && !workflow) return 0
      return Number(invoice.amount)
    })()
    const expectedAmountLabel =
      expectedAmountMin != null && expectedAmountMax != null
        ? expectedAmountMin === expectedAmountMax
          ? formatCurrencyLabel(invoice.currency, expectedAmountMin)
          : `${formatCurrencyLabel(invoice.currency, expectedAmountMin)} - ${formatCurrencyLabel(invoice.currency, expectedAmountMax)}`
        : (submittedOrder || workflow) ? formatCurrencyLabel(invoice.currency, negotiatedAmount) : "N/A (No PO)"
    const nonPassingChecks = activeChecks.filter((check) => check.result !== "passed")
    const expectedCurrency =
      typeof invoice.currency === "string" && /^[A-Za-z]{3}$/.test(invoice.currency.trim())
        ? invoice.currency.trim().toUpperCase()
        : "MYR"
    const resolvedSupplierId = invoice.supplierId ?? submittedOrder?.supplierId ?? ""
    const currentSupplierName =
      supplierById.get(resolvedSupplierId)?.name ??
      "Unknown supplier"
    const orderSupplierName =
      submittedOrder?.supplierId != null
        ? supplierById.get(submittedOrder.supplierId)?.name
        : undefined
    const expectedSupplierName =
      orderSupplierName ??
      activeChecks.find((check) => /supplier/i.test(check.checkName))?.expectedValue ??
      ((submittedOrder || workflow) ? currentSupplierName : "N/A (No PO)")
    const unresolvedChecks = nonPassingChecks.filter(
      (check) =>
        !isResolvedAiCheck(check, {
          amount: Number(invoice.amount),
          negotiatedAmount,
          expectedAmountMin,
          expectedAmountMax,
          expectedQuantity,
          invoiceQuantity,
          currentCurrency: invoice.currency,
          expectedCurrency,
          currentSupplierName,
          expectedSupplierName,
          bankDetails: invoice.bankDetails ?? "Not provided",
          paymentTerms: invoice.paymentTerms ?? "Not provided",
          invoiceNumber: invoice.invoiceNumber,
          lineItemCount: lines.length,
        })
    )
    const baseApprovalState = displayApprovalState(invoice.approvalState)
    const baseValidationStatus = displayValidationStatus(invoice.validationStatus)
    const baseRiskLevel = displayRiskLevel(invoice.riskLevel)
    
    const riskLevel =
      unresolvedChecks.length === 0 && baseRiskLevel !== "Low Risk"
        ? "Low Risk"
        : baseRiskLevel

    const validationStatus =
      unresolvedChecks.length === 0 && baseValidationStatus !== "Validated"
        ? "Validated"
        : baseValidationStatus

    const approvalState =
      baseApprovalState === "Waiting Approval" && riskLevel !== "Low Risk"
        ? "Needs Review"
        : baseApprovalState
    const missingFields =
      validationStatus === "Missing Information" ||
      unresolvedChecks.some((check) => /^ai_missing_/i.test(check.checkName))
    const amountMismatch = 
      expectedAmountLabel === "N/A (No PO)" ||
      unresolvedChecks.some((check) =>
        /amount|price|suspicious/i.test(check.checkName) ||
        (/missing_field/i.test(check.checkName) && /amount/i.test(check.actualValue ?? ""))
      )
    const bankDetailsIssue = unresolvedChecks.some((check) =>
      /bank/i.test(check.checkName) ||
      (/missing_field/i.test(check.checkName) && /bank/i.test(check.actualValue ?? ""))
    )
    const supplierInconsistency = 
      expectedSupplierName === "N/A (No PO)" ||
      unresolvedChecks.some((check) =>
        /supplier/i.test(check.checkName) ||
        (/missing_field/i.test(check.checkName) && /supplier/i.test(check.actualValue ?? ""))
      )
    const riskReason =
      invoice.aiSummary ??
      unresolvedChecks[0]?.actualValue ??
      actions.at(-1)?.note ??
      "All available invoice checks passed."
    const issueSummaries = unresolvedChecks.map((check) =>
      check.actualValue?.trim() || humanizeCheckName(check.checkName)
    )

    return {
      id: invoice.id,
      supplierId: resolvedSupplierId,
      productSku: linkedSkus[0] ?? "",
      linkedSkus,
      workflowId: derivedWorkflowId ?? "",
      workflowState: workflow?.currentState
        ? titleCaseLabel(workflow.currentState)
        : undefined,
      orderId: submittedOrder?.id ?? invoice.orderId ?? undefined,
      orderStatus: submittedOrder?.status
        ? titleCaseLabel(submittedOrder.status)
        : undefined,
      invoiceNumber: invoice.invoiceNumber,
      amount: Number(invoice.amount),
      negotiatedAmount,
      expectedQuantity,
      invoiceQuantity,
      unitPrice: Number(lines[0]?.unitPrice ?? 0),
      subtotal: subtotal || Number(invoice.amount),
      currency: invoice.currency,
      risk:
        approvalState === "Completed"
          ? "low risk"
          : approvalState === "Blocked"
            ? "blocked"
            : approvalState === "Needs Review"
              ? "needs review"
              : "waiting approval",
      riskLevel,
      riskReason,
      validationStatus,
      approvalState,
      sourceType: displaySourceType(invoice.sourceType),
      fileUrl: invoice.fileUrl ?? undefined,
      fileName: fileNameFromUrl(invoice.fileUrl),
      fileSize: "Stored file",
      bankDetails: invoice.bankDetails ?? "Not provided",
      paymentTerms: invoice.paymentTerms ?? "Not provided",
      extractedText: invoice.extractedText ?? undefined,
      processingStatus: invoice.processingStatus ?? "idle",
      issueSummaries,
      riskConfidence:
        typeof invoice.riskConfidence === "number"
          ? Number(invoice.riskConfidence)
          : riskLevel === "High Risk"
            ? 91
            : riskLevel === "Medium Risk"
              ? 84
              : 96,
      expectedAmountLabel,
      expectedCurrency,
      expectedSupplierName,
      expectedBankDetails:
        activeChecks.find((check) => /bank/i.test(check.checkName))?.expectedValue ??
        "Supplier master",
      expectedPaymentTerms:
        activeChecks.find((check) => /payment_terms|payment terms/i.test(check.checkName))
          ?.expectedValue ?? undefined,
      aiLastAnalyzedAt: invoice.aiLastAnalyzedAt ?? undefined,
      flags: {
        bankDetailsIssue,
        amountMismatch,
        missingFields,
        supplierInconsistency,
      },
      mismatches: unresolvedChecks.map((check) =>
        [check.checkName.replace(/_/g, " "), check.actualValue]
          .filter(Boolean)
          .join(": ")
      ),
      history: actions.map((action) => ({
        timestamp: action.createdAt ?? "",
        title: action.actionType.replace(/_/g, " "),
        description: action.note,
      })),
      notes: actions.at(-1)?.note ?? "",
      status: invoiceStatus(approvalState),
      dueDate: addDays(invoice.createdAt, 30),
      lastUpdated: invoice.updatedAt ?? invoice.createdAt ?? "",
    }
  })
}

function mapRestockRecommendations(
  rows: Awaited<ReturnType<typeof getDomainRows>>
): RestockRecommendation[] {
  const suppliers = mapSuppliers(rows.suppliers)
  const products = mapProducts(rows)
  const productById = new Map(products.map((product) => [product.id, product]))
  const visibleRequests = Array.from(
    selectEffectiveActiveRestockRequests(rows).values()
  )

  return visibleRequests.flatMap((restockRequest) => {
    const product = productById.get(restockRequest.productId)
    if (!product) return []

    const supplier = suppliers.find((item) => item.id === product.supplierId)
    const workflow = restockRequest.workflowId
      ? rows.workflows.find((item) => item.id === restockRequest.workflowId)
      : undefined
    const requestTargetPriceMin =
      restockRequest.targetPriceMin == null
        ? undefined
        : Number(restockRequest.targetPriceMin)
    const requestTargetPriceMax =
      restockRequest.targetPriceMax == null
        ? undefined
        : Number(restockRequest.targetPriceMax)
    const quantity =
      restockRequest?.requestedQuantity ??
      workflow?.quantity ??
      Math.max(product.currentThreshold - product.stockOnHand, product.currentThreshold)
    const unitPrice =
      workflow?.targetPriceMax ??
      requestTargetPriceMax ??
      requestTargetPriceMin ??
      product.unitCost
    const workflowBlockedStepIndex =
      workflow?.currentState === "blocked"
        ? workflow?.invoiceId || workflow?.approvalState === "blocked"
          ? 4
          : 2
        : undefined

    return {
      id: `restock-${product.id}`,
      sku: product.sku,
      workflowId: workflow?.id,
      workflowState: workflow?.currentState as WorkflowState | undefined,
      workflowBlockedStepIndex,
      restockRequestId: restockRequest?.id,
      restockRequestStatus: restockRequest?.status as RestockRequest["status"] | undefined,
      productName: product.name,
      supplier: supplier?.name ?? "Unknown supplier",
      reason:
        restockRequest?.reasonSummary ??
        (product.stockOnHand < product.currentThreshold
          ? "Current stock is below current threshold."
          : "Approaching current threshold or grouped for restock."),
      currentStock: product.stockOnHand,
      currentThreshold: product.currentThreshold,
      targetPrice: formatMoneyRange(
        workflow?.targetPriceMin ?? requestTargetPriceMin,
        workflow?.targetPriceMax ?? requestTargetPriceMax
      ),
      quantity,
      estimatedSpend: formatSpend(quantity * unitPrice),
      automationPlan: [
        "Confirm supplier terms",
        "Generate replenishment order",
        "Route invoice for approval",
      ],
      conversationId: product.conversationId,
    }
  })
}

export async function getSuppliers(): Promise<Supplier[]> {
  const rows = await getDomainRows()
  return mapSuppliers(rows.suppliers)
}

export async function getProducts(): Promise<Product[]> {
  const rows = await getDomainRows()
  return mapProducts(rows)
}

export async function getConversations(): Promise<Conversation[]> {
  const rows = await getDomainRows()
  return mapConversations(rows)
}

export async function getNegotiationMessages(): Promise<NegotiationMessage[]> {
  const rows = await getDomainRows()
  return mapMessages(rows)
}

export async function getInvoices(): Promise<Invoice[]> {
  const rows = await getDomainRows()
  return mapInvoices(rows)
}

export async function getRestockRecommendations(): Promise<RestockRecommendation[]> {
  const rows = await getDomainRows()
  return mapRestockRecommendations(rows)
}

export async function getRestockRequests(): Promise<RestockRequest[]> {
  const rows = await getDomainRows()
  return mapRestockRequests(rows)
}

export async function getLatestWorkflowStateByProductId(): Promise<
  Record<string, WorkflowState | undefined>
> {
  const rows = await getDomainRows()
  const latestByProductId = new Map<string, RawWorkflow>()

  rows.workflows
    .slice()
    .sort(
      (first, second) =>
        new Date(second.updatedAt ?? second.createdAt ?? 0).getTime() -
        new Date(first.updatedAt ?? first.createdAt ?? 0).getTime()
    )
    .forEach((workflow) => {
      if (!workflow.productId || latestByProductId.has(workflow.productId)) {
        return
      }
      latestByProductId.set(workflow.productId, workflow)
    })

  return Object.fromEntries(
    Array.from(latestByProductId.entries()).map(([productId, workflow]) => [
      productId,
      workflow.currentState as WorkflowState,
    ])
  )
}

export async function getThresholdChangeRequests(): Promise<ThresholdChangeRequest[]> {
  const rows = await getDomainRows()
  return mapThresholdRequests(rows)
}

export async function getDashboardKpis(): Promise<DashboardKpi[]> {
  const rows = await getDomainRows()
  const products = mapProducts(rows)
  const conversations = mapConversations(rows)
  const invoices = mapInvoices(rows)
  const thresholdRequests = mapThresholdRequests(rows)
  const lowStock = products.filter((product) =>
    ["below-threshold", "near-threshold"].includes(product.status)
  )
  const openInvoices = invoices.filter(
    (invoice) => invoice.approvalState !== "Completed"
  )

  return [
    {
      title: "Low Stock Alerts",
      value: lowStock.length.toString(),
      change: `${products.filter((item) => item.status === "below-threshold").length} below current threshold`,
      tone: lowStock.length > 0 ? "warning" : "success",
    },
    {
      title: "Threshold Changes Today",
      value: thresholdRequests.filter((item) => item.status === "pending").length.toString(),
      change: "pending review",
      tone: "ai",
    },
    {
      title: "Open Conversations",
      value: conversations.filter((item) => item.negotiationState !== "Closed").length.toString(),
      change: `${conversations.filter((item) => item.status === "needs-reply").length} need operator review`,
      tone: "default",
    },
    {
      title: "Invoices Waiting Approval",
      value: openInvoices.length.toString(),
      change: `${openInvoices[0]?.currency ?? "USD"} ${openInvoices
        .reduce((total, invoice) => total + invoice.amount, 0)
        .toLocaleString("en-US")} open`,
      tone: openInvoices.length > 0 ? "danger" : "success",
    },
  ]
}

export async function getInsightCards(): Promise<InsightCards> {
  const rows = await getDomainRows()
  const thresholdRequests = mapThresholdRequests(rows)
  const invoices = mapInvoices(rows)
  const restocks = mapRestockRecommendations(rows)
  const pendingRequest = thresholdRequests.find((item) => item.status === "pending")
  const recentActivity = rows.conversationMessages
    .slice()
    .sort(
      (first, second) =>
        new Date(second.createdAt ?? 0).getTime() -
        new Date(first.createdAt ?? 0).getTime()
    )
    .slice(0, 3)
    .map((message) => message.content)

  return {
    thresholdRecommendation: {
      title: "Threshold Recommendation",
      value: pendingRequest
        ? `${pendingRequest.changePercent >= 0 ? "+" : ""}${pendingRequest.changePercent}%`
        : "N/A",
      body: pendingRequest?.reason ?? "No threshold changes are waiting for review.",
    },
    recentSupplierActivity: recentActivity,
    approvalQueueSummary: {
      invoices: invoices.filter((invoice) => invoice.approvalState !== "Completed").length,
      thresholdChanges: thresholdRequests.filter((item) => item.status === "pending").length,
      replenishmentOrders: restocks.length,
    },
  }
}

export async function getStockTrendData(): Promise<StockTrendPoint[]> {
  const rows = await getDomainRows()
  const products = mapProducts(rows)
  const priorityProducts = [...products]
    .sort((first, second) => {
      const firstGap = first.stockOnHand - first.currentThreshold
      const secondGap = second.stockOnHand - second.currentThreshold
      if (firstGap !== secondGap) {
        return firstGap - secondGap
      }

      return first.name.localeCompare(second.name)
    })
    .slice(0, 3)

  const [primaryProduct, secondaryProduct, tertiaryProduct] = priorityProducts

  if (!primaryProduct || !secondaryProduct || !tertiaryProduct) return []

  return [
    { date: "Apr 01", multiplier: 1.72 },
    { date: "Apr 07", multiplier: 1.46 },
    { date: "Apr 13", multiplier: 1.21 },
    { date: "Apr 19", multiplier: 1 },
  ].map((point) => ({
    date: point.date,
    primaryLabel: primaryProduct.name,
    primaryStock: Math.round(primaryProduct.stockOnHand * point.multiplier),
    primaryThreshold: primaryProduct.currentThreshold,
    secondaryLabel: secondaryProduct.name,
    secondaryStock: Math.round(secondaryProduct.stockOnHand * point.multiplier),
    secondaryThreshold: secondaryProduct.currentThreshold,
    tertiaryLabel: tertiaryProduct.name,
    tertiaryStock: Math.round(tertiaryProduct.stockOnHand * point.multiplier),
    tertiaryThreshold: tertiaryProduct.currentThreshold,
  }))
}

export async function getMonthlyDemandData(): Promise<MonthlyDemandPoint[]> {
  return [
    { month: "Jan", demand: 8400, promo: "Baseline" },
    { month: "Feb", demand: 9100, promo: "Payday Sale" },
    { month: "Mar", demand: 12600, promo: "Raya" },
    { month: "Apr", demand: 9800, promo: "Baseline" },
  ]
}

export async function getInventorySummaryStats(): Promise<InventorySummaryStat[]> {
  const products = await getProducts()

  return [
    {
      title: "Total Active SKUs",
      value: products.length.toString(),
      change: `${new Set(products.map((item) => item.supplierId)).size} suppliers tracked`,
      tone: "default",
    },
    {
      title: "Near Threshold",
      value: products.filter((item) => item.status === "near-threshold").length.toString(),
      change: "Needs monitoring",
      tone: "warning",
    },
    {
      title: "Below Threshold",
      value: products.filter((item) => item.status === "below-threshold").length.toString(),
      change: "Requires restock",
      tone: "danger",
    },
  ]
}

export async function getInventoryHealthDistribution(): Promise<InventoryHealthItem[]> {
  const products = await getProducts()

  return [
    { name: "Healthy", count: products.filter((item) => item.status === "healthy").length, color: "#10B981" },
    { name: "Near Threshold", count: products.filter((item) => item.status === "near-threshold").length, color: "#F59E0B" },
    { name: "Below Threshold", count: products.filter((item) => item.status === "below-threshold").length, color: "#EF4444" },
    { name: "Batch Candidate", count: products.filter((item) => item.status === "batch-candidate").length, color: "#8B5CF6" },
  ]
}

export async function getSupplierExposureData(): Promise<SupplierExposureItem[]> {
  const [suppliers, products] = await Promise.all([getSuppliers(), getProducts()])

  return suppliers.map((supplier) => ({
    supplier: supplier.name,
    products: products.filter((product) => product.supplierId === supplier.id).length,
    color: "#3B82F6",
  }))
}

export async function getProductStockDemandTrendBySku(): Promise<
  ProductStockDemandTrendMap
> {
  const rows = await getDomainRows()
  const trendsByProductId = new Map<string, RawProductStockDemandTrend[]>()

  rows.productStockDemandTrends.forEach((trend) => {
    const existing = trendsByProductId.get(trend.productId) ?? []
    existing.push(trend)
    trendsByProductId.set(trend.productId, existing)
  })

  const trendMap = Object.fromEntries(
    rows.products.map((product) => [
      product.sku,
      (trendsByProductId.get(product.id) ?? [])
        .slice()
        .sort((first, second) => first.monthOrder - second.monthOrder)
        .map((trend) => ({
          month: trend.month,
          stock: trend.stock,
          demand: trend.demand,
          promotion: trend.promotion,
        })),
    ])
  )

  const fallbackTrendMap = buildFallbackStockDemandTrendMap(mapProducts(rows))

  if (Object.keys(trendMap).length > 0) {
    return Object.fromEntries(
      Object.entries(fallbackTrendMap).map(([sku, fallbackTrend]) => [
        sku,
        trendMap[sku]?.length ? trendMap[sku] : fallbackTrend,
      ])
    )
  }

  return fallbackTrendMap
}

export async function getProductMonthlySummaryBySku(): Promise<
  ProductMonthlySummaryMap
> {
  const trends = await getProductStockDemandTrendBySku()

  return Object.fromEntries(
    Object.entries(trends).map(([sku, points]) => [
      sku,
      points.map((point) => ({
        month: point.month,
        averageSales: point.demand,
        seasonalSpike: point.promotion ? "High" : "Normal",
        promotionNote: point.promotion || "Baseline demand",
      })),
    ])
  )
}

export async function getThresholdAnalysisBySku(): Promise<
  ThresholdAnalysisMap
> {
  const [products, thresholdRequests] = await Promise.all([
    getProducts(),
    getThresholdChangeRequests(),
  ])

  return Object.fromEntries(
    products.map((product) => {
      const request = thresholdRequests.find(
        (item) => item.productSku === product.sku && item.status === "pending"
      )

      return [
        product.sku,
        {
          currentThreshold: product.currentThreshold,
          recommendedThreshold: request?.proposedThreshold ?? product.currentThreshold,
          confidenceScore: request ? 92 : 86,
          explanation:
            request?.reason ??
            "Current threshold is aligned with stock position and supplier lead time.",
        },
      ]
    })
  )
}

export async function getSupplierBatchAdvantageNotes(): Promise<
  SupplierBatchAdvantageMap
> {
  const suppliers = await getSuppliers()
  return Object.fromEntries(
    suppliers.map((supplier) => [
      supplier.id,
      `${supplier.name} can be evaluated for MOQ, lead-time, and bundle efficiency.`,
    ])
  )
}

export async function getInvoiceRiskLevelDistribution(): Promise<
  InvoiceRiskLevelItem[]
> {
  const invoices = await getInvoices()

  return [
    { name: "Low Risk", count: invoices.filter((item) => item.riskLevel === "Low Risk").length, color: "#10B981" },
    { name: "Medium Risk", count: invoices.filter((item) => item.riskLevel === "Medium Risk").length, color: "#F59E0B" },
    { name: "High Risk", count: invoices.filter((item) => item.riskLevel === "High Risk").length, color: "#EF4444" },
  ]
}

export async function getApprovalPipelineDistribution(): Promise<
  ApprovalPipelineItem[]
> {
  const invoices = await getInvoices()

  return [
    { name: "Waiting Approval", count: invoices.filter((item) => item.approvalState === "Waiting Approval").length, color: "#3B82F6" },
    { name: "Needs Review", count: invoices.filter((item) => item.approvalState === "Needs Review").length, color: "#F59E0B" },
    { name: "Blocked", count: invoices.filter((item) => item.approvalState === "Blocked").length, color: "#EF4444" },
    { name: "Completed", count: invoices.filter((item) => item.approvalState === "Completed").length, color: "#10B981" },
  ]
}

export async function getSupplierInvoiceVolume(): Promise<SupplierInvoiceVolumeItem[]> {
  const [suppliers, invoices] = await Promise.all([getSuppliers(), getInvoices()])

  return suppliers.map((supplier) => ({
    supplier: supplier.name,
    invoices: invoices.filter((invoice) => invoice.supplierId === supplier.id).length,
    color: "#3B82F6",
  }))
}
