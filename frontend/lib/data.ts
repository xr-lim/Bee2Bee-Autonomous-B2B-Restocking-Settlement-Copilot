import { getSupabaseServerClient } from "@/lib/supabase/server"
import type {
  Conversation,
  Invoice,
  NegotiationMessage,
  Product,
  RestockRecommendation,
  Supplier,
  ThresholdChangeRequest,
} from "@/lib/types"

type DashboardKpi = {
  title: string
  value: string
  change: string
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

type AppConfigRow = {
  key: string
  value: unknown
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

const EMPTY_INSIGHT_CARDS: InsightCards = {
  thresholdRecommendation: {
    title: "AI Threshold Recommendation",
    value: "N/A",
    body: "No recommendation available yet.",
  },
  recentSupplierActivity: [],
  approvalQueueSummary: {
    invoices: 0,
    thresholdChanges: 0,
    replenishmentOrders: 0,
  },
}

async function selectRows<T>(table: string, fallback: T[]): Promise<T[]> {
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

async function selectConfigValue<T>(key: string, fallback: T): Promise<T> {
  const supabase = getSupabaseServerClient()
  if (!supabase) {
    return fallback
  }

  const { data, error } = await supabase
    .from("app_config")
    .select("key, value")
    .eq("key", key)
    .maybeSingle<AppConfigRow>()

  if (error) {
    console.error(`[supabase] failed reading app_config '${key}':`, error.message)
    return fallback
  }

  return (data?.value as T | undefined) ?? fallback
}

export async function getSuppliers(): Promise<Supplier[]> {
  return selectRows<Supplier>("suppliers", [])
}

export async function getProducts(): Promise<Product[]> {
  return selectRows<Product>("products", [])
}

export async function getConversations(): Promise<Conversation[]> {
  return selectRows<Conversation>("conversations", [])
}

export async function getNegotiationMessages(): Promise<NegotiationMessage[]> {
  return selectRows<NegotiationMessage>("negotiation_messages", [])
}

export async function getInvoices(): Promise<Invoice[]> {
  return selectRows<Invoice>("invoices", [])
}

export async function getRestockRecommendations(): Promise<RestockRecommendation[]> {
  return selectRows<RestockRecommendation>("restock_recommendations", [])
}

export async function getThresholdChangeRequests(): Promise<ThresholdChangeRequest[]> {
  return selectRows<ThresholdChangeRequest>("threshold_change_requests", [])
}

export async function getDashboardKpis(): Promise<DashboardKpi[]> {
  return selectConfigValue<DashboardKpi[]>("dashboard_kpis", [])
}

export async function getInsightCards(): Promise<InsightCards> {
  return selectConfigValue<InsightCards>("insight_cards", EMPTY_INSIGHT_CARDS)
}

export async function getStockTrendData(): Promise<StockTrendPoint[]> {
  return selectConfigValue<StockTrendPoint[]>("stock_trend_data", [])
}

export async function getMonthlyDemandData(): Promise<MonthlyDemandPoint[]> {
  return selectConfigValue<MonthlyDemandPoint[]>("monthly_demand_data", [])
}

export async function getInventorySummaryStats(): Promise<InventorySummaryStat[]> {
  return selectConfigValue<InventorySummaryStat[]>("inventory_summary_stats", [])
}

export async function getInventoryHealthDistribution(): Promise<InventoryHealthItem[]> {
  return selectConfigValue<InventoryHealthItem[]>(
    "inventory_health_distribution",
    []
  )
}

export async function getSupplierExposureData(): Promise<SupplierExposureItem[]> {
  return selectConfigValue<SupplierExposureItem[]>("supplier_exposure_data", [])
}

export async function getProductStockDemandTrendBySku(): Promise<
  ProductStockDemandTrendMap
> {
  return selectConfigValue<ProductStockDemandTrendMap>(
    "product_stock_demand_trend_by_sku",
    {}
  )
}

export async function getProductMonthlySummaryBySku(): Promise<
  ProductMonthlySummaryMap
> {
  return selectConfigValue<ProductMonthlySummaryMap>(
    "product_monthly_summary_by_sku",
    {}
  )
}

export async function getAiThresholdAnalysisBySku(): Promise<
  AiThresholdAnalysisMap
> {
  return selectConfigValue<AiThresholdAnalysisMap>("ai_threshold_analysis_by_sku", {})
}

export async function getSupplierBatchAdvantageNotes(): Promise<
  SupplierBatchAdvantageMap
> {
  return selectConfigValue<SupplierBatchAdvantageMap>(
    "supplier_batch_advantage_notes",
    {}
  )
}

export async function getInvoiceRiskLevelDistribution(): Promise<
  InvoiceRiskLevelItem[]
> {
  return selectConfigValue<InvoiceRiskLevelItem[]>(
    "invoice_risk_level_distribution",
    []
  )
}

export async function getApprovalPipelineDistribution(): Promise<
  ApprovalPipelineItem[]
> {
  return selectConfigValue<ApprovalPipelineItem[]>(
    "approval_pipeline_distribution",
    []
  )
}

export async function getSupplierInvoiceVolume(): Promise<SupplierInvoiceVolumeItem[]> {
  return selectConfigValue<SupplierInvoiceVolumeItem[]>("supplier_invoice_volume", [])
}
