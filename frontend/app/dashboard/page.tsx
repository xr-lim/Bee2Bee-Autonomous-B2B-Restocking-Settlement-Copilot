import Link from "next/link"
import {
  AlertTriangle,
  Bot,
  MessageSquareText,
  ReceiptText,
  SlidersHorizontal,
} from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { DashboardCharts } from "@/components/shared/dashboard-charts"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { ThresholdChangeRequestList } from "@/components/shared/threshold-change-request-list"
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
  dashboardKpis,
  insightCards,
  mockInvoices,
  mockSuppliers,
  restockRecommendations,
  thresholdChangeRequests,
} from "@/lib/mock-data"
import type { Invoice, StatusTone } from "@/lib/types"

const statIcons = [
  AlertTriangle,
  SlidersHorizontal,
  MessageSquareText,
  ReceiptText,
]

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

const activeInvoices = mockInvoices.filter((invoice) =>
  ["Waiting Approval", "Needs Review", "Blocked"].includes(invoice.approvalState)
)

function supplierName(supplierId: string) {
  return (
    mockSuppliers.find((supplier) => supplier.id === supplierId)?.name ??
    "Unknown supplier"
  )
}

function firstSentence(text: string) {
  const match = text.match(/^(.*?[.?!])(\s|$)/)
  return match ? match[1] : text
}

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        eyebrow="Bee2Bee command center"
        title="Restock Control Center"
        description="Monitor stock health, supplier communication, invoice risk, and approval pipeline."
        actions={
          <Button
            asChild
            className="h-11 rounded-[10px] bg-[#3B82F6] px-5 text-[15px] text-white hover:bg-[#2563EB]"
          >
            <Link href="/invoice-management">Review approvals</Link>
          </Button>
        }
      />

      <section className="grid grid-cols-4 gap-5">
        {dashboardKpis.map((stat, index) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            tone={stat.tone}
            icon={statIcons[index]}
          />
        ))}
      </section>

      <section className="grid grid-cols-[1fr_340px] gap-8">
        <div className="space-y-8">
          <ThresholdChangeRequestList
            requests={thresholdChangeRequests}
            maxVisible={3}
            description="Z.AI threshold updates awaiting approval."
          />

          <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
            <CardHeader className="border-b border-[#243047] p-5">
              <CardTitle className="text-[17px] font-semibold text-[#E5E7EB]">
                Restock Queue
              </CardTitle>
              <p className="mt-1 text-[14px] leading-6 text-[#9CA3AF]">
                SKUs below AI threshold · ordered by urgency.
              </p>
            </CardHeader>
            <CardContent className="p-0">
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
                  {restockRecommendations.map((item) => {
                    const belowThreshold = item.currentStock < item.aiThreshold

                    return (
                      <TableRow
                        key={item.id}
                        className="border-[#243047] hover:bg-[#172033]/70 [&>td]:px-5 [&>td]:py-4"
                      >
                        <TableCell>
                          <p className="text-[15px] font-medium text-[#E5E7EB]">
                            {item.productName}
                          </p>
                          <p className="mt-1 font-mono text-[12px] text-[#6B7280]">
                            {item.sku}
                          </p>
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
                              / {item.aiThreshold}
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
                          <Button
                            asChild
                            variant="outline"
                            className="h-9 rounded-[10px] border-[#243047] bg-[#172033] px-3 text-[13px] text-[#E5E7EB] hover:bg-[#243047]"
                          >
                            <Link href={`/inventory/${item.sku}`}>
                              Review & restock
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
            <CardHeader className="border-b border-[#243047] p-5">
              <CardTitle className="text-[17px] font-semibold text-[#E5E7EB]">
                Invoice Action Queue
              </CardTitle>
              <p className="mt-1 text-[14px] leading-6 text-[#9CA3AF]">
                Invoices waiting on approval, review, or unblock action.
              </p>
            </CardHeader>
            <CardContent className="p-0">
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
                          {supplierName(invoice.supplierId)}
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
                          className="h-9 rounded-[10px] border-[#243047] bg-[#172033] px-3 text-[13px] text-[#E5E7EB] hover:bg-[#243047]"
                        >
                          <Link href={`/invoice-management/${invoice.id}`}>
                            Review
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[17px] font-semibold text-[#E5E7EB]">
                  AI Threshold Insight
                </h3>
                <Bot className="size-5 text-[#8B5CF6]" aria-hidden="true" />
              </div>
              <p className="text-[32px] font-semibold leading-none text-[#E5E7EB]">
                {insightCards.thresholdRecommendation.value}
              </p>
              <p className="mt-3 text-[14px] leading-6 text-[#9CA3AF]">
                {firstSentence(insightCards.thresholdRecommendation.body)}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
            <CardContent className="p-6">
              <h3 className="text-[17px] font-semibold text-[#E5E7EB]">
                Recent Supplier Activity
              </h3>
              <ul className="mt-4 space-y-3">
                {insightCards.recentSupplierActivity.map((activity) => (
                  <li
                    key={activity}
                    className="flex gap-2.5 text-[14px] leading-6 text-[#9CA3AF]"
                  >
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#3B82F6]" />
                    <span>{activity}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <DashboardCharts />
    </>
  )
}
