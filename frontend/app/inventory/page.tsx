import { AlertTriangle, Boxes, PackageCheck } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { FilterToolbar } from "@/components/shared/filter-toolbar"
import { InventoryTableClient } from "@/components/shared/inventory-table-client"
import { RestockAlertPanel } from "@/components/shared/restock-alert-panel"
import { StatCard } from "@/components/shared/stat-card"
import { ThresholdChangeRequestList } from "@/components/shared/threshold-change-request-list"
import {
  getInventorySummaryStats,
  getProducts,
  getRestockRecommendations,
  getSuppliers,
  getThresholdChangeRequests,
} from "@/lib/data"

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
        description="Track current stock, AI threshold changes, and supplier-linked restocking opportunities."
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

      <RestockAlertPanel recommendations={restockRecommendations} />

      <ThresholdChangeRequestList
        requests={thresholdChangeRequests}
        products={products}
        variant="preview"
        defaultOpen
        title="Pending Threshold Change Requests"
        description="Short preview · open the product detail to review the full AI reasoning and confirm the new threshold."
      />

      <FilterToolbar searchPlaceholder="Search by SKU, product, supplier, or stock status..." />

      <InventoryTableClient
        initialProducts={products}
        suppliers={suppliers}
      />
    </>
  )
}
