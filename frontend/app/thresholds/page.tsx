import { PageHeader } from "@/components/layout/page-header"
import { ThresholdChangeRequestList } from "@/components/shared/threshold-change-request-list"
import { Card, CardContent } from "@/components/ui/card"
import { getProducts, getThresholdChangeRequests } from "@/lib/data"

export const dynamic = "force-dynamic"

export default async function ThresholdsPage() {
  const [products, thresholdChangeRequests] = await Promise.all([
    getProducts(),
    getThresholdChangeRequests(),
  ])
  const pendingRequests = thresholdChangeRequests.filter(
    (request) => request.status === "pending"
  )
  const raiseCount = pendingRequests.filter(
    (request) => request.proposedThreshold > request.currentThreshold
  ).length
  const reduceCount = pendingRequests.length - raiseCount

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Threshold review"
        title="Thresholds"
        description="Confirm AI-suggested reorder threshold changes before they update stock rules."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryMetric label="Pending proposals" value={pendingRequests.length} />
        <SummaryMetric label="Raise threshold" value={raiseCount} />
        <SummaryMetric label="Reduce threshold" value={reduceCount} />
      </div>

      <ThresholdChangeRequestList
        requests={thresholdChangeRequests}
        products={products}
        collapsible={false}
        defaultOpen
        title="Threshold Update Queue"
        description="Review individual proposals or apply every pending threshold update in one confirmation."
        emptyLabel="No threshold updates are waiting for confirmation."
      />
    </div>
  )
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
      <CardContent className="p-5">
        <p className="text-[12px] font-medium uppercase tracking-wider text-[#9CA3AF]">
          {label}
        </p>
        <p className="mt-3 text-[24px] font-semibold text-[#E5E7EB]">
          {value.toLocaleString("en-US")}
        </p>
      </CardContent>
    </Card>
  )
}
