import Link from "next/link"
import { notFound } from "next/navigation"

import { PageHeader } from "@/components/layout/page-header"
import { CollapsibleSection } from "@/components/shared/collapsible-section"
import { ProductStockDemandChart } from "@/components/shared/inventory-charts"
import { ManualRestockButton } from "@/components/shared/manual-restock-button"
import { ProductDetailsEditor } from "@/components/shared/product-details-editor"
import { RestockForm } from "@/components/shared/restock-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  getConversations,
  getLatestWorkflowStateByProductId,
  getProductStockDemandTrendBySku,
  getProducts,
  getRestockRecommendations,
  getRestockRequests,
  getSuppliers,
  getThresholdAnalysisBySku,
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
    productStockDemandTrendBySku,
  ] = await Promise.all([
    getProducts(),
    getSuppliers(),
    getConversations(),
    getLatestWorkflowStateByProductId(),
    getThresholdAnalysisBySku(),
    getRestockRecommendations(),
    getRestockRequests(),
    getProductStockDemandTrendBySku(),
  ])

  const product = products.find((item) => item.sku === decodeURIComponent(sku))

  if (!product) {
    notFound()
  }

  const supplier = suppliers.find((item) => item.id === product.supplierId)
  const conversation =
    conversations.find((item) => item.id === product.conversationId) ??
    [...conversations]
      .filter(
        (item) =>
          item.linkedSkus.includes(product.sku) ||
          item.productSku === product.sku ||
          item.supplierId === product.supplierId
      )
      .sort(
        (first, second) =>
          new Date(second.lastMessageAt).getTime() -
          new Date(first.lastMessageAt).getTime()
      )[0]
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
  return (
    <>
      <PageHeader
        eyebrow="Inventory detail"
        title={product.name}
        description={`${product.sku} · ${supplier?.name ?? "Unknown supplier"}`}
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
          </>
        }
      />

      <Tabs defaultValue="overview" className="gap-4">
        <TabsList
          variant="line"
          className="h-auto w-full justify-start gap-2 overflow-hidden rounded-2xl border border-[#243047] bg-[#111827] p-2"
        >
          <TabsTrigger value="overview" className="rounded-xl px-4 py-2 text-[#94A3B8] data-active:bg-[#172033] data-active:text-[#F8FAFC]">
            Overview
          </TabsTrigger>
          <TabsTrigger value="trend" className="rounded-xl px-4 py-2 text-[#94A3B8] data-active:bg-[#172033] data-active:text-[#F8FAFC]">
            Demand Trend
          </TabsTrigger>
          <TabsTrigger value="recommendation" className="rounded-xl px-4 py-2 text-[#94A3B8] data-active:bg-[#172033] data-active:text-[#F8FAFC]">
            Stock Recommendation
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-xl px-4 py-2 text-[#94A3B8] data-active:bg-[#172033] data-active:text-[#F8FAFC]">
            Conversation History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5">
          <section className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
            <ProductDetailsEditor
              product={product}
              suppliers={suppliers}
              stockStatus={{
                label: stockStatusLabel[product.status],
                tone: stockStatusTone[product.status],
              }}
              leadTimeDays={supplier?.leadTimeDays ?? 0}
            />

            <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
              <CardHeader className="border-b border-[#243047] p-5">
                <CardTitle className="text-[17px] font-semibold text-[#E5E7EB]">
                  At a Glance
                </CardTitle>
                <p className="mt-1 text-[13px] text-[#9CA3AF]">
                  Key stock and supplier details for this product.
                </p>
              </CardHeader>
              <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
                <Metric label="Stock on Hand" value={product.stockOnHand} />
                <Metric label="Reorder Point" value={product.currentThreshold} />
                <Metric label="Lead Time" value={`${supplier?.leadTimeDays ?? 0} days`} />
                <Metric label="Primary Supplier" value={supplier?.name ?? "Unknown supplier"} />
              </CardContent>
            </Card>
          </section>
        </TabsContent>

        <TabsContent value="trend">
          <ProductStockDemandChart
            trend={
              productStockDemandTrendBySku[
                product.sku as keyof typeof productStockDemandTrendBySku
              ] ?? []
            }
          />
        </TabsContent>

        <TabsContent value="recommendation" className="space-y-5">
          <Card className="rounded-[14px] border border-[#8B5CF6]/30 bg-[#111827] py-0 shadow-none ring-0">
            <CardHeader className="border-b border-[#8B5CF6]/25 p-5">
              <CardTitle className="text-[17px] font-semibold text-[#E5E7EB]">
                Stock Recommendation
              </CardTitle>
              <p className="mt-1 text-[13px] leading-5 text-[#9CA3AF]">
                Suggested reorder point based on recent stock movement.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3">
                <Metric label="Current Reorder Point" value={analysis.currentThreshold} />
                <Metric label="Suggested Reorder Point" value={analysis.recommendedThreshold} />
              </div>
              <CollapsibleSection
                title="Why this was suggested"
                description="Open to see the supporting explanation."
                defaultOpen={false}
              >
                <div className="space-y-4 p-5">
                  <div className="rounded-[12px] border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 p-4">
                    <p className="text-[13px] leading-6 text-[#E5E7EB]">
                      {analysis.explanation}
                    </p>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[12px] text-[#9CA3AF]">
                        Confidence
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
                </div>
              </CollapsibleSection>
            </CardContent>
          </Card>

          {restockRecommendation ? (
            <RestockForm
              recommendation={restockRecommendation}
              product={product}
              supplier={supplier}
              suppliers={suppliers}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="history">
          <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
            <CardHeader className="border-b border-[#243047] p-5">
              <CardTitle className="text-[17px] font-semibold text-[#E5E7EB]">
                Conversation History
              </CardTitle>
              <p className="mt-1 text-[13px] text-[#9CA3AF]">
                Review the latest supplier activity for this product.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              {conversation ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Metric label="Supplier" value={supplier?.name ?? "Unknown supplier"} />
                    <Metric label="Current Step" value={conversation.negotiationState} />
                    <Metric label="Next Action" value={conversation.nextAction.recommendedNextStep} />
                  </div>
                  <div className="rounded-[12px] border border-[#243047] bg-[#172033] p-4">
                    <p className="text-[12px] uppercase tracking-[0.18em] text-[#64748B]">
                      Latest Update
                    </p>
                    <p className="mt-2 text-[14px] leading-6 text-[#E5E7EB]">
                      {conversation.nextAction.negotiationSummary}
                    </p>
                  </div>
                  <Button
                    asChild
                    className="h-10 rounded-[10px] bg-[#3B82F6] px-4 text-white hover:bg-[#2563EB]"
                  >
                    <Link href={`/conversations/${conversation.id}`}>Open Conversation</Link>
                  </Button>
                </>
              ) : (
                <p className="text-[14px] text-[#9CA3AF]">
                  No supplier conversation is linked to this product yet.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
