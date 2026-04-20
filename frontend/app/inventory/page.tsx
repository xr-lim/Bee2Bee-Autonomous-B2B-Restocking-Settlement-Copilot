import { AlertTriangle, Boxes, PackageCheck, Sparkles } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { FilterToolbar } from "@/components/shared/filter-toolbar"
import { InventoryListCharts } from "@/components/shared/inventory-charts"
import { InventoryTableClient } from "@/components/shared/inventory-table-client"
import { RestockAlertPanel } from "@/components/shared/restock-alert-panel"
import { StatCard } from "@/components/shared/stat-card"
import { ThresholdChangeRequestList } from "@/components/shared/threshold-change-request-list"
import {
  getInventoryHealthDistribution,
  getInventorySummaryStats,
  getProducts,
  getRestockRecommendations,
  getSupplierExposureData,
  getSuppliers,
  getThresholdChangeRequests,
} from "@/lib/data"

const summaryIcons = [Boxes, AlertTriangle, PackageCheck, Sparkles]

export default async function InventoryPage() {
  const [
    inventorySummaryStats,
    products,
    suppliers,
    restockRecommendations,
    thresholdChangeRequests,
    inventoryHealthDistribution,
    supplierExposureData,
  ] = await Promise.all([
    getInventorySummaryStats(),
    getProducts(),
    getSuppliers(),
    getRestockRecommendations(),
    getThresholdChangeRequests(),
    getInventoryHealthDistribution(),
    getSupplierExposureData(),
  ])

  return (
    <>
      <PageHeader
        eyebrow="Inventory"
        title="Inventory"
        description="Track current stock, AI threshold changes, and supplier-linked restocking opportunities."
      />

      <section className="grid grid-cols-4 gap-4">
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
        description="Z.AI proposes these threshold updates based on velocity, lead time and bundle signals. Approve to apply instantly to the AI threshold column."
      />

      <InventoryListCharts
        inventoryHealthDistribution={inventoryHealthDistribution}
        supplierExposureData={supplierExposureData}
      />

      <FilterToolbar searchPlaceholder="Search by SKU, product, supplier, or stock status..." />

      <InventoryTableClient
        initialProducts={products}
        suppliers={suppliers}
      />
    </>
  )
}
