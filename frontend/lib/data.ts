import { getSupabaseServerClient } from "@/lib/supabase/server"
import type {
  Conversation,
  ConversationSource,
  Invoice,
  NegotiationMessage,
  Product,
  RestockRecommendation,
  StockStatus,
  Supplier,
  ThresholdChangeRequest,
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
  proteinBars: number
  proteinThreshold: number
  coldBrew: number
  coldBrewThreshold: number
  rice: number
  riceThreshold: number
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

type AiThresholdAnalysisMap = Record<
  string,
  {
    currentThreshold: number
    recommendedThreshold: number
    safetyBuffer: string
    reorderUrgency: string
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
  staticThreshold: number
  aiThreshold: number
  maxCapacity: number
  thresholdBuffer: number
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

type RawInvoice = {
  id: string
  invoiceNumber: string
  supplierId?: string | null
  workflowId?: string | null
  sourceType: string
  fileUrl?: string | null
  amount: number
  currency: "USD" | "MYR" | "SGD"
  quantity?: number | null
  paymentTerms?: string | null
  bankDetails?: string | null
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

function displayProductStatus(status: string): StockStatus {
  const statusMap: Record<string, StockStatus> = {
    healthy: "healthy",
    near_threshold: "near-threshold",
    below_threshold: "below-threshold",
    batch_candidate: "batch-candidate",
  }

  return statusMap[status] ?? "healthy"
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

function derivedTrend(product: RawProduct) {
  if (product.status === "below_threshold") return 12
  if (product.status === "near_threshold") return -6
  if (product.status === "batch_candidate") return 9
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
    status: reliabilityStatus(Number(supplier.reliabilityScore)),
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
    const supplierLinks = rows.productSuppliers.filter(
      (link) => link.productId === product.id
    )
    const primarySupplierId =
      product.primarySupplierId ??
      supplierLinks.find((link) => link.isPrimary)?.supplierId ??
      supplierLinks[0]?.supplierId ??
      ""
    const trend30d = derivedTrend(product)

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      stockOnHand: product.currentStock,
      reorderPoint: product.staticThreshold,
      staticThreshold: product.staticThreshold,
      aiThreshold: product.aiThreshold,
      unitCost: Number(product.unitPrice),
      maxStockAmount: product.maxCapacity,
      forecastDemand: Math.max(product.aiThreshold * 2, product.currentStock),
      monthlyVelocity: Math.max(
        0,
        Math.round((product.maxCapacity - product.currentStock) * 0.45)
      ),
      trend30d,
      trend365d: Math.max(0, trend30d + 14),
      supplierId: primarySupplierId,
      conversationId: conversationsByProductId.get(product.id)?.id ?? "",
      invoiceId: invoicesByProductId.get(product.id)?.id ?? "",
      status: displayProductStatus(product.status),
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

  return rows.conversations.map((conversation) => {
    const linkedSkus = rows.conversationProducts
      .filter((link) => link.conversationId === conversation.id)
      .map((link) => productById.get(link.productId)?.sku)
      .filter((sku): sku is string => Boolean(sku))
    const workflow = rows.workflows.find(
      (item) => item.conversationId === conversation.id
    )
    const latestMessage = latestMessageForConversation(
      rows.conversationMessages,
      conversation.id
    )
    const state = displayState(conversation.state)
    const missingFields = latestMessage?.missingFields ?? []

    return {
      id: conversation.id,
      productSku: linkedSkus[0] ?? "",
      linkedSkus,
      supplierId: conversation.supplierId ?? "",
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
        recommendedNextStep: nextConversationStep(state, missingFields),
        negotiationSummary:
          latestMessage?.content ??
          conversation.latestMessage ??
          "No negotiation summary available yet.",
        linkedInvoiceStatus: conversation.linkedInvoiceId ? "linked" : "pending",
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
  const conversationsById = new Map(
    rows.conversations.map((conversation) => [conversation.id, conversation])
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

  return rows.invoices.map((invoice) => {
    const lines = rows.invoiceProducts.filter((line) => line.invoiceId === invoice.id)
    const checks = rows.invoiceValidationResults.filter(
      (check) => check.invoiceId === invoice.id
    )
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
    const subtotal = lines.reduce((total, line) => total + Number(line.subtotal), 0)
    const quantity =
      invoice.quantity ??
      lines.reduce((total, line) => total + Number(line.quantity), 0)
    const nonPassingChecks = checks.filter((check) => check.result !== "passed")
    const approvalState = displayApprovalState(invoice.approvalState)
    const validationStatus = displayValidationStatus(invoice.validationStatus)
    const riskLevel = displayRiskLevel(invoice.riskLevel)
    const missingFields = validationStatus === "Missing Information"
    const amountMismatch =
      validationStatus === "Mismatch Detected" ||
      nonPassingChecks.some((check) => /amount|freight|terms/i.test(check.checkName))
    const riskReason =
      nonPassingChecks[0]?.actualValue ??
      actions.at(-1)?.note ??
      "All available invoice checks passed."

    return {
      id: invoice.id,
      supplierId: invoice.supplierId ?? "",
      productSku: linkedSkus[0] ?? "",
      linkedSkus,
      workflowId: invoice.workflowId ?? "",
      invoiceNumber: invoice.invoiceNumber,
      amount: Number(invoice.amount),
      negotiatedAmount: subtotal || Number(invoice.amount),
      expectedQuantity: quantity,
      invoiceQuantity: quantity,
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
      fileName: fileNameFromUrl(invoice.fileUrl),
      fileSize: "Stored file",
      bankDetails: invoice.bankDetails ?? "Not provided",
      paymentTerms: invoice.paymentTerms ?? "Not provided",
      riskConfidence: riskLevel === "High Risk" ? 91 : riskLevel === "Medium Risk" ? 84 : 96,
      flags: {
        bankDetailsIssue: checks.some((check) => /bank/i.test(check.checkName) && check.result === "failed"),
        amountMismatch,
        missingFields,
        supplierInconsistency: checks.some(
          (check) => /supplier/i.test(check.checkName) && check.result === "failed"
        ),
      },
      mismatches: nonPassingChecks.map((check) =>
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

function priorityProducts(products: Product[]) {
  return products.filter((product) =>
    ["below-threshold", "near-threshold", "batch-candidate"].includes(
      product.status
    )
  )
}

function mapRestockRecommendations(
  rows: Awaited<ReturnType<typeof getDomainRows>>
): RestockRecommendation[] {
  const suppliers = mapSuppliers(rows.suppliers)
  const products = mapProducts(rows)

  return priorityProducts(products).map((product) => {
    const supplier = suppliers.find((item) => item.id === product.supplierId)
    const workflow = rows.workflows.find((item) => item.productId === product.id)
    const quantity =
      workflow?.quantity ??
      Math.max(product.aiThreshold - product.stockOnHand, product.aiThreshold)
    const unitPrice = workflow?.targetPriceMax ?? product.unitCost

    return {
      id: `restock-${product.id}`,
      sku: product.sku,
      productName: product.name,
      supplier: supplier?.name ?? "Unknown supplier",
      reason:
        product.stockOnHand < product.aiThreshold
          ? "Current stock is below AI threshold."
          : "Approaching AI threshold or grouped for restock.",
      currentStock: product.stockOnHand,
      aiThreshold: product.aiThreshold,
      targetPrice: formatMoneyRange(workflow?.targetPriceMin, workflow?.targetPriceMax),
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
      change: `${products.filter((item) => item.status === "below-threshold").length} below AI threshold`,
      tone: lowStock.length > 0 ? "warning" : "success",
    },
    {
      title: "AI Threshold Changes Today",
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
      title: "AI Threshold Recommendation",
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
  const proteinBars = products.find((product) => product.sku.includes("ALM")) ?? products[0]
  const coldBrew = products.find((product) => product.sku.includes("CFE")) ?? products[1]
  const rice = products.find((product) => product.sku.includes("RCE")) ?? products[2]

  if (!proteinBars || !coldBrew || !rice) return []

  return [
    { date: "Apr 01", multiplier: 1.72 },
    { date: "Apr 07", multiplier: 1.46 },
    { date: "Apr 13", multiplier: 1.21 },
    { date: "Apr 19", multiplier: 1 },
  ].map((point) => ({
    date: point.date,
    proteinBars: Math.round(proteinBars.stockOnHand * point.multiplier),
    proteinThreshold: proteinBars.aiThreshold,
    coldBrew: Math.round(coldBrew.stockOnHand * point.multiplier),
    coldBrewThreshold: coldBrew.aiThreshold,
    rice: Math.round(rice.stockOnHand * point.multiplier),
    riceThreshold: rice.aiThreshold,
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

export async function getAiThresholdAnalysisBySku(): Promise<
  AiThresholdAnalysisMap
> {
  const [products, thresholdRequests] = await Promise.all([
    getProducts(),
    getThresholdChangeRequests(),
  ])

  return Object.fromEntries(
    products.map((product) => {
      const request = thresholdRequests.find((item) => item.productSku === product.sku)

      return [
        product.sku,
        {
          currentThreshold: product.aiThreshold,
          recommendedThreshold: request?.proposedThreshold ?? product.aiThreshold,
          safetyBuffer: `${Math.max(0, product.stockOnHand - product.aiThreshold)} units`,
          reorderUrgency:
            product.status === "below-threshold"
              ? "Critical"
              : product.status === "near-threshold"
                ? "High"
                : "Normal",
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
