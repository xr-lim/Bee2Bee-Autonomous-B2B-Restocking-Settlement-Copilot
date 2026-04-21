import type { LucideIcon } from "lucide-react"

export type StatusTone = "default" | "success" | "warning" | "danger" | "ai"

export type NavigationItem = {
  title: string
  href: string
  icon: LucideIcon
}

export type StockStatus =
  | "healthy"
  | "near-threshold"
  | "below-threshold"
  | "batch-candidate"

export type ProductSupplierOption = {
  supplierId: string
  lastDealPrice: number
  lastDealDate: string
  leadTimeDays: number
  moq: number
  reliabilityScore: number
  preferred: boolean
  note?: string
}

export type Product = {
  id: string
  sku: string
  name: string
  category: string
  stockOnHand: number
  reorderPoint: number
  staticThreshold: number
  aiThreshold: number
  unitCost: number
  maxStockAmount: number
  forecastDemand: number
  monthlyVelocity: number
  trend30d: number
  trend365d: number
  supplierId: string
  conversationId: string
  invoiceId: string
  status: StockStatus
  suppliers?: ProductSupplierOption[]
  pendingAiAnalysis?: boolean
}

export type ThresholdChangeRequest = {
  id: string
  productSku: string
  productName: string
  currentThreshold: number
  proposedThreshold: number
  changePercent: number
  reason: string
  proposedAt: string
  status: "pending" | "approved" | "rejected"
  trigger:
    | "demand-spike"
    | "demand-drop"
    | "lead-time-shift"
    | "bundle-opportunity"
    | "new-product"
}

export type Workflow = {
  id: string
  title: string
  stage:
    | "review needed"
    | "negotiation active"
    | "invoice review"
    | "ready for approval"
    | "blocked"
    | "completed"
  status: "active" | "blocked" | "complete" | "pending"
  owner: string
  updatedAt: string
}

export type Supplier = {
  id: string
  name: string
  region: string
  reliabilityScore: number
  leadTimeDays: number
  status: "preferred" | "watchlist" | "inactive"
}

export type OrderSummaryItem = {
  sku: string
  productName: string
  quantity: number
  unit: string
  unitPrice: string
  lineTotal: string
}

export type OrderSummary = {
  poNumber: string
  issuedAt: string
  items: OrderSummaryItem[]
  subtotal: string
  total: string
  deliveryBy: string
  paymentTerms: string
  notes?: string
}

export type NegotiationMessage = {
  id: string
  conversationId: string
  supplierId: string
  type:
    | "supplier-message"
    | "ai-interpretation"
    | "merchant-action"
    | "ai-recommendation"
  author: "merchant" | "supplier" | "ai" | "system"
  body: string
  sentiment: "positive" | "neutral" | "risk"
  createdAt: string
  attachmentType?: "email" | "screenshot" | "image" | "pdf" | "voice"
  attachmentLabel?: string
  orderSummary?: OrderSummary
  invoiceId?: string
  language?: "EN" | "ZH" | "JA"
  translation?: string
}

export type ConversationSource =
  | "Email"
  | "WhatsApp"
  | "Telegram"
  | "WeChat"
  | "PDF"
  | "Image"
  | "Voice Note"

export type NegotiationState =
  | "New Input"
  | "Needs Analysis"
  | "Counter Offer Suggested"
  | "Waiting Reply"
  | "Accepted"
  | "Escalated"
  | "Closed"

export type Conversation = {
  id: string
  productSku: string
  linkedSkus: string[]
  supplierId: string
  subject: string
  source: ConversationSource
  negotiationState: NegotiationState
  latestMessage: string
  targetPriceRange: string
  createdDate: string
  priority: "low" | "medium" | "high" | "critical"
  lastMessageAt: string
  status: "needs-reply" | "negotiating" | "waiting-supplier" | "resolved"
  aiExtraction: {
    extractedPrice: string
    extractedQuantity: string
    deliveryEstimate: string
    supplierLanguage: string
    detectedIntent: string
    missingFields: string[]
    confidenceScore: number
  }
  nextAction: {
    recommendedNextStep: string
    negotiationSummary: string
    linkedInvoiceStatus: string
  }
}

export type Invoice = {
  id: string
  supplierId: string
  productSku: string
  linkedSkus: string[]
  workflowId: string
  invoiceNumber: string
  amount: number
  negotiatedAmount: number
  expectedQuantity: number
  invoiceQuantity: number
  unitPrice: number
  subtotal: number
  currency: "USD" | "MYR" | "SGD"
  risk: "low risk" | "waiting approval" | "needs review" | "blocked"
  riskLevel: "Low Risk" | "Medium Risk" | "High Risk"
  riskReason: string
  validationStatus:
    | "Parsed"
    | "Validated"
    | "Mismatch Detected"
    | "Missing Information"
  approvalState: "Waiting Approval" | "Needs Review" | "Blocked" | "Completed"
  sourceType: "PDF" | "Image" | "Email Attachment" | "Upload"
  fileName: string
  fileSize: string
  bankDetails: string
  paymentTerms: string
  riskConfidence: number
  flags: {
    bankDetailsIssue: boolean
    amountMismatch: boolean
    missingFields: boolean
    supplierInconsistency: boolean
  }
  mismatches: string[]
  history: Array<{
    timestamp: string
    title: string
    description: string
  }>
  notes: string
  status: "matched" | "exception" | "pending" | "approved" | "blocked" | "paid"
  dueDate: string
  lastUpdated: string
}

export type StrategyReport = {
  id: string
  title: string
  period: string
  summary: string
  status: "draft" | "ready" | "reviewed"
  generatedAt: string
}

export type TimelineEvent = {
  id: string
  workflowId: string
  title: string
  description: string
  timestamp: string
  tone: StatusTone
}

export type RestockRecommendation = {
  id: string
  sku: string
  productName: string
  supplier: string
  reason: string
  currentStock: number
  aiThreshold: number
  targetPrice: string
  quantity: number
  estimatedSpend: string
  automationPlan: string[]
  conversationId: string
}
