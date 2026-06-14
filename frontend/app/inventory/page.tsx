import { AlertTriangle, Boxes, PackageCheck } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { InventoryTableClient } from "@/components/shared/inventory-table-client"
import { RestockAlertPanel } from "@/components/shared/restock-alert-panel"
import { StatCard } from "@/components/shared/stat-card"
import { ThresholdChangeRequestList } from "@/components/shared/threshold-change-request-list"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  getInventorySummaryStats,
  getProducts,
  getRestockRecommendations,
  getSuppliers,
  getThresholdChangeRequests,
} from "@/lib/data"

export const dynamic = "force-dynamic"

const summaryIcons = [Boxes, AlertTriangle, PackageCheck]

export default async function InventoryPage() {
  const [
    inventorySummaryStats,
    products,
    suppliers,
    restockRecommendations,
    thresholdChangeRequests,
  ] = await Promise.all([
    getInventorySummaryStats(),
    getProducts(),
    getSuppliers(),
    getRestockRecommendations(),
    getThresholdChangeRequests(),
  ])

  return (
    <>
      <PageHeader
        eyebrow="Inventory"
        title="Inventory"
        description="Track stock levels and review what needs restocking."
      />

      <section className="grid grid-cols-3 gap-4">
        {inventorySummaryStats.map((stat, index) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            change={stat.change}
            tone={stat.tone}
            icon={summaryIcons[index]}
          />
        ))}
      </section>

      <Tabs defaultValue="all" className="gap-4">
        <TabsList
          variant="line"
          className="w-full justify-start gap-2 overflow-x-auto rounded-2xl border border-[#243047] bg-[#111827] p-2"
        >
          <TabsTrigger
            value="all"
            className="rounded-xl px-4 py-2 text-[#94A3B8] data-active:bg-[#172033] data-active:text-[#F8FAFC]"
          >
            All Products
          </TabsTrigger>
          <TabsTrigger
            value="needs-restock"
            className="rounded-xl px-4 py-2 text-[#94A3B8] data-active:bg-[#172033] data-active:text-[#F8FAFC]"
          >
            Needs Restock
          </TabsTrigger>
          <TabsTrigger
            value="near-threshold"
            className="rounded-xl px-4 py-2 text-[#94A3B8] data-active:bg-[#172033] data-active:text-[#F8FAFC]"
          >
            Near Threshold
          </TabsTrigger>
          <TabsTrigger
            value="threshold-requests"
            className="rounded-xl px-4 py-2 text-[#94A3B8] data-active:bg-[#172033] data-active:text-[#F8FAFC]"
          >
            Threshold Requests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <InventoryTableClient initialProducts={products} suppliers={suppliers} />
        </TabsContent>

        <TabsContent value="needs-restock" className="space-y-4">
          <RestockAlertPanel recommendations={restockRecommendations} />
          <InventoryTableClient
            initialProducts={products.filter(
              (product) =>
                product.status === "below-threshold" ||
                product.status === "batch-candidate"
            )}
            suppliers={suppliers}
          />
        </TabsContent>

        <TabsContent value="near-threshold" className="space-y-4">
          <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
            <CardContent className="px-5 py-4 text-[14px] text-[#94A3B8]">
              These products are not urgent yet, but they are getting close to
              the reorder point.
            </CardContent>
          </Card>
          <InventoryTableClient
            initialProducts={products.filter(
              (product) => product.status === "near-threshold"
            )}
            suppliers={suppliers}
          />
        </TabsContent>

        <TabsContent value="threshold-requests" className="space-y-4">
          <ThresholdChangeRequestList
            requests={thresholdChangeRequests}
            products={products}
            variant="preview"
            defaultOpen
            title="Threshold Requests"
            description="Review suggested stock level changes."
          />
        </TabsContent>
      </Tabs>
    </>
  )
}
