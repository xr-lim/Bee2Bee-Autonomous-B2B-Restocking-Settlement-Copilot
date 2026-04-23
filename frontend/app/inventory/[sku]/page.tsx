import Link from "next/link"
import { notFound } from "next/navigation"

import { PageHeader } from "@/components/layout/page-header"
import { ProductStockDemandChart } from "@/components/shared/inventory-charts"
import { ManualRestockButton } from "@/components/shared/manual-restock-button"
import { ProductDetailsEditor } from "@/components/shared/product-details-editor"
import { RestockForm } from "@/components/shared/restock-form"
import { ThresholdChangeReviewPanel } from "@/components/shared/threshold-change-review-panel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  getConversations,
  getLatestWorkflowStateByProductId,
  getProductStockDemandTrendBySku,
  getProducts,
  getRestockRecommendations,
  getRestockRequests,
  getSuppliers,
  getThresholdAnalysisBySku,
  getThresholdChangeRequests,
} from "@/lib/data"
import type { StatusTone, StockStatus } from "@/lib/types"

export const dynamic = "force-dynamic"

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
    latestWorkflowStateByProductId,
    thresholdAnalysisBySku,
    restockRecommendations,
    restockRequests,
    thresholdChangeRequests,
    productStockDemandTrendBySku,
  ] = await Promise.all([
    getProducts(),
    getSuppliers(),
    getConversations(),
    getLatestWorkflowStateByProductId(),
    getThresholdAnalysisBySku(),
    getRestockRecommendations(),
    getRestockRequests(),
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
  const analysis =
    thresholdAnalysisBySku[
      product.sku as keyof typeof thresholdAnalysisBySku
    ] ?? {
      currentThreshold: product.currentThreshold,
      recommendedThreshold: product.currentThreshold,
      confidenceScore: 0,
      explanation: "No threshold analysis found for this SKU in Supabase.",
    }
  const restockRecommendation = restockRecommendations.find(
    (item) => item.sku === product.sku
  )
  const activeRestockRequest = restockRequests.find(
    (item) =>
      item.productSku === product.sku &&
      ["pending", "reviewed", "accepted"].includes(item.status)
  )
  const latestWorkflowState = latestWorkflowStateByProductId[product.id]
  const hasActiveWorkflow =
    latestWorkflowState != null &&
    !["stock_healthy", "completed"].includes(latestWorkflowState)
  const showManualRestockButton =
    !activeRestockRequest &&
    !hasActiveWorkflow &&
    !restockRecommendation
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
                  View Chat
                </Link>
              </Button>
            ) : null}
            {showManualRestockButton ? (
              <ManualRestockButton productId={product.id} sku={product.sku} />
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

      <section className="grid grid-cols-[1.35fr_1fr] gap-5">
        <ProductDetailsEditor
          product={product}
          suppliers={suppliers}
          stockStatus={{
            label: stockStatusLabel[product.status],
            tone: stockStatusTone[product.status],
          }}
          leadTimeDays={supplier?.leadTimeDays ?? 0}
        />

        <Card className="rounded-[14px] border border-[#8B5CF6]/30 bg-[#111827] py-0 shadow-none ring-0">
          <CardHeader className="border-b border-[#8B5CF6]/25 p-5">
            <CardTitle className="text-[17px] font-semibold text-[#E5E7EB]">
              Threshold Analysis
            </CardTitle>
            <p className="mt-1 text-[13px] leading-5 text-[#9CA3AF]">
              Z.AI&apos;s recommendation for the current reorder threshold.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <Metric
                label="Current"
                value={analysis.currentThreshold}
              />
              <Metric
                label="Recommended"
                value={analysis.recommendedThreshold}
              />
            </div>
            <div className="rounded-[12px] border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 p-4">
              <p className="text-[12px] font-medium text-[#C4B5FD]">
                AI explanation
              </p>
              <p className="mt-2 text-[13px] leading-5 text-[#E5E7EB]">
                {analysis.explanation}
              </p>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] text-[#9CA3AF]">
                  Confidence score
                </span>
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

      {pendingThresholdRequest ? (
        <ThresholdChangeReviewPanel
          request={pendingThresholdRequest}
          product={product}
        />
      ) : null}

      {restockRecommendation ? (
        <RestockForm
          recommendation={restockRecommendation}
          product={product}
          supplier={supplier}
          suppliers={suppliers}
        />
      ) : null}

      <ProductStockDemandChart
        trend={
          productStockDemandTrendBySku[
            product.sku as keyof typeof productStockDemandTrendBySku
          ] ?? []
        }
      />
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
