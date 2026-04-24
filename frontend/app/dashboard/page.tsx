import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  FileCheck2,
  FileWarning,
  MessageSquareText,
  PackageCheck,
  PackageSearch,
  Receipt,
  Sparkles,
} from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { CollapsibleSection } from "@/components/shared/collapsible-section"
import { DashboardThresholdAnalysisButton } from "@/components/shared/dashboard-threshold-analysis-button"
import { DashboardRestockRowActions } from "@/components/shared/dashboard-restock-row-actions"
import { DashboardCharts } from "@/components/shared/dashboard-charts"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getInsightCards,
  getInvoices,
  getRestockRecommendations,
  getStockTrendData,
  getSuppliers,
} from "@/lib/data"
import type { Invoice, StatusTone, Supplier } from "@/lib/types"

export const dynamic = "force-dynamic"

const approvalTone: Record<Invoice["approvalState"], StatusTone> = {
  "Waiting Approval": "ai",
  "Needs Review": "warning",
  Blocked: "danger",
  Completed: "success",
}

const riskTone: Record<Invoice["riskLevel"], StatusTone> = {
  "Low Risk": "success",
  "Medium Risk": "warning",
  "High Risk": "danger",
}

function supplierName(suppliers: Supplier[], supplierId: string) {
  return (
    suppliers.find((supplier) => supplier.id === supplierId)?.name ??
    "Unknown supplier"
  )
}

function firstSentence(text: string) {
  const match = text.match(/^(.*?[.?!])(\s|$)/)
  return match ? match[1] : text
}

export default async function DashboardPage() {
  const [
    insightCards,
    invoices,
    suppliers,
    restockRecommendations,
    stockTrendData,
  ] = await Promise.all([
    getInsightCards(),
    getInvoices(),
    getSuppliers(),
    getRestockRecommendations(),
    getStockTrendData(),
  ])

  const activeInvoices = invoices.filter((invoice) =>
    ["Waiting Approval", "Needs Review", "Blocked"].includes(invoice.approvalState)
  )
  const riskyInvoices = activeInvoices.filter(
    (invoice) => invoice.riskLevel === "High Risk" || invoice.riskLevel === "Medium Risk"
  )
  const actionableRestocks = restockRecommendations.filter((item) =>
    isActionableRestock(item)
  )
  const pendingRestocks = restockRecommendations.filter((item) =>
    item.restockRequestStatus === "pending" || item.restockRequestStatus === "reviewed"
  )
  const activeRestocks = restockRecommendations.filter(
    (item) => item.restockRequestStatus === "accepted" && item.workflowState !== "completed"
  )
  const completedSettlements = invoices.filter(
    (invoice) => invoice.approvalState === "Completed" || invoice.status === "paid"
  )
  const supplierReplyCount = insightCards.recentSupplierActivity.length
  const kpiCards = [
    {
      title: "Low Stock Items",
      value: actionableRestocks.length.toString(),
      change: `${activeRestocks.length} already in active recovery flow`,
      tone: actionableRestocks.length > 0 ? "warning" : "success",
      icon: AlertTriangle,
    },
    {
      title: "Pending Restock",
      value: pendingRestocks.length.toString(),
      change: `${restockRecommendations.length} total recommendations in play`,
      tone: pendingRestocks.length > 0 ? "ai" : "success",
      icon: PackageSearch,
    },
    {
      title: "Supplier Replies",
      value: supplierReplyCount.toString(),
      change: "latest inbound messages ready for review",
      tone: supplierReplyCount > 0 ? "default" : "success",
      icon: MessageSquareText,
    },
    {
      title: "Invoice Risks",
      value: riskyInvoices.length.toString(),
      change: `${activeInvoices.length} invoices still need action`,
      tone: riskyInvoices.length > 0 ? "danger" : "success",
      icon: FileWarning,
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Bee2Bee command center"
        title="Restock Control Center"
        description="Monitor stock health, supplier communication, invoice risk, and approval pipeline."
        actions={
          <>
            <Button
              asChild
              variant="outline"
              className="h-11 rounded-2xl border-[#334155] bg-[#101827]/70 px-4 text-[#E5E7EB] hover:border-[#38BDF8]/40 hover:bg-[#172033]"
            >
              <Link href="/conversations">
                <MessageSquareText className="size-4" aria-hidden="true" />
                Inbox
              </Link>
            </Button>
            <Button
              asChild
              className="h-11 rounded-2xl bg-[#FACC15] px-4 font-semibold text-[#111827] hover:bg-[#EAB308]"
            >
              <Link href="#restock-queue">
                <PackageCheck className="size-4" aria-hidden="true" />
                Review Queue
              </Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            tone={stat.tone}
            icon={stat.icon}
            change={stat.change}
          />
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[3.5fr_minmax(340px,1fr)]">
        {/* Main Content: Queues */}
        <div className="space-y-6">
          <div id="restock-queue">
            <CollapsibleSection
              title="Restock Queue"
              description="SKUs below current threshold · ordered by urgency."
              headerAccessory={
                <StatusBadge
                  label={`${actionableRestocks.length} items`}
                  tone={actionableRestocks.length > 0 ? "warning" : "default"}
                />
              }
              defaultOpen
            >
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#243047] hover:bg-transparent [&>th]:h-12 [&>th]:px-5 [&>th]:text-[13px] [&>th]:text-[#9CA3AF]">
                      <TableHead>Product</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Stock / Threshold</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Target Price</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actionableRestocks.map((item) => {
                      const belowThreshold = item.currentStock < item.currentThreshold

                      return (
                        <TableRow
                          key={item.id}
                          className="border-[#243047] hover:bg-[#172033]/70 [&>td]:px-5 [&>td]:py-4"
                        >
                          <TableCell>
                            <p className="text-[15px] font-medium text-[#E5E7EB]">
                              {item.productName}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              <p className="font-mono text-[12px] text-[#6B7280]">
                                {item.sku}
                              </p>
                              <StatusBadge
                                label={restockQueueStatus(item).label}
                                tone={restockQueueStatus(item).tone}
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-[14px] text-[#9CA3AF]">
                            {item.supplier}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-baseline gap-1.5">
                              <span
                                className={
                                  belowThreshold
                                    ? "text-[15px] font-semibold text-[#F87171]"
                                    : "text-[15px] font-semibold text-[#E5E7EB]"
                                }
                              >
                                {item.currentStock}
                              </span>
                              <span className="text-[13px] text-[#6B7280]">
                                / {item.currentThreshold}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-[15px] font-medium text-[#E5E7EB]">
                            {item.quantity.toLocaleString("en-US")}
                          </TableCell>
                          <TableCell className="text-[14px] text-[#9CA3AF]">
                            {item.targetPrice}
                          </TableCell>
                          <TableCell className="text-right">
                            <DashboardRestockRowActions
                              sku={item.sku}
                              requestId={item.restockRequestId}
                              actionLabel={
                                item.restockRequestStatus === "accepted"
                                  ? "View restocking"
                                  : "Review & restock"
                              }
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleSection>
          </div>

          <CollapsibleSection
            title="Invoice Action Queue"
            description="Invoices waiting on approval, review, or unblock action."
            headerAccessory={
              <StatusBadge
                label={`${activeInvoices.length} open`}
                tone={activeInvoices.length > 0 ? "ai" : "default"}
              />
            }
            defaultOpen
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#243047] hover:bg-transparent [&>th]:h-12 [&>th]:px-5 [&>th]:text-[13px] [&>th]:text-[#9CA3AF]">
                    <TableHead>Invoice / Supplier</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeInvoices.map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      className="border-[#243047] hover:bg-[#172033]/70 [&>td]:px-5 [&>td]:py-4"
                    >
                      <TableCell>
                        <p className="text-[15px] font-medium text-[#E5E7EB]">
                          {supplierName(suppliers, invoice.supplierId)}
                        </p>
                        <p className="mt-1 font-mono text-[12px] text-[#6B7280]">
                          {invoice.id}
                        </p>
                      </TableCell>
                      <TableCell className="text-[15px] font-medium text-[#E5E7EB]">
                        {invoice.currency}{" "}
                        {invoice.amount.toLocaleString("en-US")}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          label={invoice.approvalState}
                          tone={approvalTone[invoice.approvalState]}
                        />
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          label={invoice.riskLevel}
                          tone={riskTone[invoice.riskLevel]}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          asChild
                          variant="outline"
                          className="h-10 rounded-2xl border-[#334155] bg-[#172033] px-3 text-[13px] font-semibold text-[#E5E7EB] hover:border-[#38BDF8]/40 hover:bg-[#1B2940]"
                        >
                          <Link href={`/invoice-management/${invoice.id}`}>
                            <FileCheck2 className="size-4" aria-hidden="true" />
                            Review
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CollapsibleSection>
        </div>

        {/* Sidebar Content: Insights and Agent Controls */}
        <div className="space-y-6">
          <Card className="panel-surface rounded-3xl py-0">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#FCD34D]">
                    Threshold Insight
                  </p>
                  <h3 className="mt-2 text-[18px] font-semibold text-[#F8FAFC]">
                    Reorder signal
                  </h3>
                </div>
                <div className="rounded-2xl border border-[#FACC15]/20 bg-[#FACC15]/10 p-2.5">
                  <Bot className="size-5 text-[#FCD34D]" aria-hidden="true" />
                </div>
              </div>
              <p className="text-[36px] font-semibold leading-none text-[#F8FAFC]">
                {insightCards.thresholdRecommendation.value}
              </p>
              <p className="mt-3 text-[14px] leading-6 text-[#94A3B8]">
                {firstSentence(insightCards.thresholdRecommendation.body)}
              </p>
            </CardContent>
          </Card>

          <Card className="panel-surface rounded-3xl py-0">
            <CardContent className="flex flex-col gap-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#7DD3FC]">
                    Agent Controls
                  </p>
                  <h3 className="mt-2 text-[18px] font-semibold text-[#F8FAFC]">
                    AI Analysis
                  </h3>
                </div>
                <Sparkles className="size-5 text-[#7DD3FC]" aria-hidden="true" />
              </div>
              <DashboardThresholdAnalysisButton />
            </CardContent>
          </Card>
        </div>
      </section>

      <DashboardCharts
        monthlyDemandData={[]}
        stockTrendData={stockTrendData}
        hideMonthlyDemand
      />
    </>
  )
}

function isActionableRestock(
  item: Awaited<ReturnType<typeof getRestockRecommendations>>[number]
) {
  if (item.restockRequestStatus === "accepted") {
    return item.workflowState !== "completed"
  }

  return (
    item.restockRequestStatus === "pending" ||
    item.restockRequestStatus === "reviewed"
  )
}

function restockQueueStatus(
  item: Awaited<ReturnType<typeof getRestockRecommendations>>[number]
): { label: string; tone: StatusTone } {
  if (
    item.restockRequestStatus === "accepted" &&
    item.workflowState &&
    item.workflowState !== "completed"
  ) {
    return { label: "Restocking", tone: "ai" }
  }

  if (item.restockRequestStatus === "reviewed") {
    return { label: "Request reviewed", tone: "warning" }
  }

  return { label: "Request pending", tone: "default" }
}
