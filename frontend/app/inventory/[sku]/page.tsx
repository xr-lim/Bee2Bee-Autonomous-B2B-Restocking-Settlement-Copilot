import Link from "next/link"
import { notFound } from "next/navigation"

import { PageHeader } from "@/components/layout/page-header"
import { ProductStockDemandChart } from "@/components/shared/inventory-charts"
import { RestockForm } from "@/components/shared/restock-form"
import { StatusBadge } from "@/components/shared/status-badge"
import { SupplierOptionsPanel } from "@/components/shared/supplier-options-panel"
import { ThresholdChangeBanner } from "@/components/shared/threshold-change-request-list"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getAiThresholdAnalysisBySku,
  getConversations,
  getProductMonthlySummaryBySku,
  getProductStockDemandTrendBySku,
  getProducts,
  getRestockRecommendations,
  getSupplierBatchAdvantageNotes,
  getSuppliers,
  getThresholdChangeRequests,
} from "@/lib/data"
import type { StatusTone, StockStatus } from "@/lib/types"

const stockStatusTone: Record<StockStatus, StatusTone> = {
  healthy: "success",
  "near-threshold": "warning",
  "below-threshold": "danger",
  "batch-candidate": "ai",
}

const stockStatusLabel: Record<StockStatus, string> = {
  healthy: "Healthy",
  "near-threshold": "Near Threshold",
  "below-threshold": "Below Threshold",
  "batch-candidate": "Batch Candidate",
}

export async function generateStaticParams() {
  const products = await getProducts()
  return products.map((product) => ({ sku: product.sku }))
}

export default async function InventoryDetailPage({
  params,
}: {
  params: Promise<{ sku: string }>
}) {
  const { sku } = await params
  const [
    products,
    suppliers,
    conversations,
    productMonthlySummaryBySku,
    aiThresholdAnalysisBySku,
    supplierBatchAdvantageNotes,
    restockRecommendations,
    thresholdChangeRequests,
    productStockDemandTrendBySku,
  ] = await Promise.all([
    getProducts(),
    getSuppliers(),
    getConversations(),
    getProductMonthlySummaryBySku(),
    getAiThresholdAnalysisBySku(),
    getSupplierBatchAdvantageNotes(),
    getRestockRecommendations(),
    getThresholdChangeRequests(),
    getProductStockDemandTrendBySku(),
  ])

  const product = products.find((item) => item.sku === decodeURIComponent(sku))

  if (!product) {
    notFound()
  }

  const supplier = suppliers.find((item) => item.id === product.supplierId)
  const conversation = conversations.find(
    (item) => item.id === product.conversationId
  )
  const monthlySummary =
    productMonthlySummaryBySku[
      product.sku as keyof typeof productMonthlySummaryBySku
    ] ?? []
  const analysis =
    aiThresholdAnalysisBySku[
      product.sku as keyof typeof aiThresholdAnalysisBySku
    ] ?? {
      currentThreshold: product.aiThreshold,
      recommendedThreshold: product.aiThreshold,
      safetyBuffer: "N/A",
      reorderUrgency: "N/A",
      confidenceScore: 0,
      explanation: "No AI threshold analysis found for this SKU in Supabase.",
    }
  const bundleProducts = products.filter(
    (item) => item.supplierId === product.supplierId
  )
  const thresholdMarginPercent = Math.round(
    ((product.stockOnHand - product.aiThreshold) / product.aiThreshold) * 100
  )
  const supplierNote =
    supplierBatchAdvantageNotes[
      product.supplierId as keyof typeof supplierBatchAdvantageNotes
    ]
  const restockRecommendation = restockRecommendations.find(
    (item) => item.sku === product.sku
  )
  const pendingThresholdRequest = thresholdChangeRequests.find(
    (item) => item.productSku === product.sku && item.status === "pending"
  )

  return (
    <>
      <PageHeader
        eyebrow="Inventory detail"
        title={product.name}
        description={`${product.sku} / ${supplier?.name ?? "Unknown supplier"}`}
        actions={
          <>
            {conversation ? (
              <Button
                asChild
                className="h-10 rounded-[10px] bg-[#3B82F6] px-4 text-white hover:bg-[#2563EB]"
              >
                <Link href={`/conversations/${conversation.id}`}>
                  View Auto Negotiation
                </Link>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-[10px] border-[#243047] bg-[#172033] px-4 text-[#E5E7EB] hover:bg-[#243047]"
            >
              Export Stock Analysis
            </Button>
          </>
        }
      />

      {pendingThresholdRequest ? (
        <ThresholdChangeBanner
          request={pendingThresholdRequest}
          product={product}
        />
      ) : null}

      <section className="grid grid-cols-3 gap-3">
        <CompactMetric label="SKU" value={product.sku} />
        <CompactMetric label="Supplier" value={supplier?.name ?? "Unknown supplier"} />
        <CompactMetric label="Current Stock" value={product.stockOnHand} emphasis />
        <CompactMetric label="Unit Cost" value={`$${product.unitCost.toFixed(2)}`} emphasis />
        <CompactMetric label="Lead Time" value={`${supplier?.leadTimeDays ?? 0}d`} emphasis />
        <Card className="rounded-[10px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
          <CardContent className="flex min-h-[76px] items-center justify-between gap-3 p-4">
            <div>
              <p className="text-[12px] text-[#9CA3AF]">Stock Status</p>
              <div className="mt-2">
                <StatusBadge
                  label={stockStatusLabel[product.status]}
                  tone={stockStatusTone[product.status]}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {restockRecommendation ? (
        <RestockForm
          recommendation={restockRecommendation}
          product={product}
          supplier={supplier}
        />
      ) : null}

      <SupplierOptionsPanel product={product} suppliers={suppliers} />

      <ProductStockDemandChart
        trend={
          productStockDemandTrendBySku[
            product.sku as keyof typeof productStockDemandTrendBySku
          ] ?? []
        }
      />

      <section className="grid grid-cols-[1fr_360px] gap-6">
        <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
          <CardHeader className="border-b border-[#243047] p-4">
            <CardTitle className="text-[16px] font-semibold text-[#E5E7EB]">
              Monthly Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-[#243047] hover:bg-transparent">
                  <TableHead className="px-4 text-[12px] text-[#9CA3AF]">
                    Month
                  </TableHead>
                  <TableHead className="text-[12px] text-[#9CA3AF]">
                    Average Sales
                  </TableHead>
                  <TableHead className="text-[12px] text-[#9CA3AF]">
                    Seasonal Spike
                  </TableHead>
                  <TableHead className="text-[12px] text-[#9CA3AF]">
                    Promotion Note
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlySummary.map((month) => (
                  <TableRow
                    key={month.month}
                    className="border-[#243047] hover:bg-[#172033]/70"
                  >
                    <TableCell className="px-4 text-[14px] font-medium text-[#E5E7EB]">
                      {month.month}
                    </TableCell>
                    <TableCell className="text-[14px] text-[#E5E7EB]">
                      {month.averageSales}
                    </TableCell>
                    <TableCell className="text-[14px] text-[#9CA3AF]">
                      {month.seasonalSpike}
                    </TableCell>
                    <TableCell className="text-[14px] text-[#9CA3AF]">
                      {month.promotionNote}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
          <CardHeader className="border-b border-[#243047] p-4">
            <CardTitle className="text-[16px] font-semibold text-[#E5E7EB]">
              AI Threshold Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Current Threshold" value={analysis.currentThreshold} />
              <Metric
                label="Recommended Threshold"
                value={analysis.recommendedThreshold}
              />
              <Metric label="Safety Buffer" value={analysis.safetyBuffer} />
              <Metric label="Reorder Urgency" value={analysis.reorderUrgency} />
            </div>
            <div className="rounded-[14px] border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 p-4">
              <p className="text-[12px] font-medium text-[#C4B5FD]">
                AI explanation
              </p>
              <p className="mt-2 text-[14px] leading-6 text-[#E5E7EB]">
                {analysis.explanation}
              </p>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] text-[#9CA3AF]">Confidence score</span>
                <span className="text-[14px] font-semibold text-[#E5E7EB]">
                  {analysis.confidenceScore}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#172033]">
                <div
                  className="h-2 rounded-full bg-[#8B5CF6]"
                  style={{ width: `${analysis.confidenceScore}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-[1fr_360px] gap-6">
        <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
          <CardHeader className="border-b border-[#243047] p-4">
            <CardTitle className="text-[16px] font-semibold text-[#E5E7EB]">
              Batch Restocking Opportunity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-[#243047] hover:bg-transparent">
                  <TableHead className="px-4 text-[12px] text-[#9CA3AF]">
                    Same-Supplier Products
                  </TableHead>
                    <TableHead className="text-[12px] text-[#9CA3AF]">
                    Current / Max Capacity
                  </TableHead>
                  <TableHead className="text-[12px] text-[#9CA3AF]">
                    Threshold Proximity
                  </TableHead>
                  <TableHead className="text-[12px] text-[#9CA3AF]">
                    Recommended Bundle Quantity
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bundleProducts.map((item) => {
                  const proximity = Math.round(
                    (item.stockOnHand / item.aiThreshold) * 100
                  )
                  const headroom = Math.max(
                    item.maxStockAmount - item.stockOnHand,
                    0
                  )
                  const rawBundleQuantity = Math.max(
                    item.aiThreshold - item.stockOnHand,
                    Math.round(item.monthlyVelocity * 0.3)
                  )
                  const bundleQuantity = Math.min(
                    rawBundleQuantity,
                    headroom
                  )
                  const cappedByCapacity = bundleQuantity < rawBundleQuantity

                  return (
                    <TableRow
                      key={item.sku}
                      className="border-[#243047] hover:bg-[#172033]/70"
                    >
                      <TableCell className="px-4">
                        <p className="text-[14px] font-medium text-[#E5E7EB]">
                          {item.name}
                        </p>
                        <p className="text-[12px] text-[#6B7280]">{item.sku}</p>
                      </TableCell>
                      <TableCell className="text-[14px] text-[#E5E7EB]">
                        {item.stockOnHand}
                        <span className="ml-1 text-[11px] text-[#6B7280]">
                          / cap {item.maxStockAmount.toLocaleString("en-US")}
                        </span>
                      </TableCell>
                      <TableCell className="text-[14px] text-[#9CA3AF]">
                        {proximity}%
                      </TableCell>
                      <TableCell className="text-[14px] font-medium text-[#E5E7EB]">
                        {bundleQuantity.toLocaleString("en-US")}
                        {cappedByCapacity ? (
                          <span className="ml-1 text-[11px] font-normal text-[#F59E0B]">
                            (capped by max capacity)
                          </span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <div className="border-t border-[#243047] p-4">
              <p className="text-[14px] leading-6 text-[#9CA3AF]">{supplierNote}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
          <CardHeader className="border-b border-[#243047] p-4">
            <CardTitle className="text-[16px] font-semibold text-[#E5E7EB]">
              Constraints Panel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <Metric label="Threshold Margin" value={`${thresholdMarginPercent}%`} />
            <Metric
              label="Max Capacity"
              value={product.maxStockAmount.toLocaleString("en-US")}
            />
            <Metric
              label="Capacity Headroom"
              value={`${Math.max(
                product.maxStockAmount - product.stockOnHand,
                0
              ).toLocaleString("en-US")} units`}
            />
            <div className="flex items-center justify-between rounded-[14px] border border-[#243047] bg-[#172033] p-4">
              <div>
                <p className="text-[12px] font-medium text-[#E5E7EB]">
                  Include same-supplier products
                </p>
                <p className="mt-1 text-[12px] text-[#9CA3AF]">
                  Bundle review enabled
                </p>
              </div>
              <div className="flex h-6 w-11 items-center rounded-full bg-[#3B82F6] p-1">
                <span className="ml-auto size-4 rounded-full bg-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  )
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[14px] border border-[#243047] bg-[#172033] p-4">
      <p className="text-[12px] text-[#9CA3AF]">{label}</p>
      <p className="mt-2 text-[20px] font-semibold text-[#E5E7EB]">{value}</p>
    </div>
  )
}

function CompactMetric({
  label,
  value,
  emphasis,
}: {
  label: string
  value: number | string
  emphasis?: boolean
}) {
  return (
    <Card className="rounded-[10px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
      <CardContent className="min-h-[76px] p-4">
        <p className="text-[12px] text-[#9CA3AF]">{label}</p>
        <p
          className={
            emphasis
              ? "mt-2 text-[22px] font-semibold leading-tight text-[#E5E7EB]"
              : "mt-2 truncate text-[14px] font-semibold leading-tight text-[#E5E7EB]"
          }
        >
          {value}
        </p>
      </CardContent>
    </Card>
  )
}
