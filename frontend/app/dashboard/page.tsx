import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  FileWarning,
  MessageSquareText,
  PackageSearch,
  Sparkles,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
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
  getConversations,
  getInvoices,
  getRestockRecommendations,
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

type PriorityItem = {
  id: string
  label: string
  summary: string
  status: string
  tone: StatusTone
  href: string
}

function supplierName(suppliers: Supplier[], supplierId: string) {
  return (
    suppliers.find((supplier) => supplier.id === supplierId)?.name ??
    "Unknown supplier"
  )
}

function restockStatusLabel(
  item: Awaited<ReturnType<typeof getRestockRecommendations>>[number]
) {
  if (item.restockRequestStatus === "accepted") {
    return item.workflowState === "completed" ? "Completed" : "In progress"
  }

  if (item.restockRequestStatus === "reviewed") {
    return "Needs attention"
  }

  return "Restock needed"
}

function restockStatusTone(
  item: Awaited<ReturnType<typeof getRestockRecommendations>>[number]
): StatusTone {
  if (item.restockRequestStatus === "accepted") {
    return item.workflowState === "completed" ? "success" : "ai"
  }

  return item.currentStock < item.currentThreshold ? "warning" : "default"
}

export default async function DashboardPage() {
  const [conversations, invoices, suppliers, restockRecommendations] =
    await Promise.all([
      getConversations(),
      getInvoices(),
      getSuppliers(),
      getRestockRecommendations(),
    ])

  const restockNeeded = restockRecommendations.filter(
    (item) =>
      item.restockRequestStatus === "pending" ||
      item.restockRequestStatus === "reviewed"
  )
  const newSupplierMessages = conversations.filter(
    (conversation) =>
      conversation.negotiationState === "Needs Analysis" ||
      conversation.negotiationState === "Escalated" ||
      conversation.negotiationState === "Waiting Reply"
  )
  const invoicesNeedingAttention = invoices.filter(
    (invoice) => invoice.approvalState !== "Completed"
  )

  const kpiCards: Array<{
    title: string
    value: string
    change: string
    tone: StatusTone
    icon: LucideIcon
  }> = [
    {
      title: "Restock Needed",
      value: restockNeeded.length.toString(),
      change:
        restockNeeded.length > 0
          ? "Products waiting for reorder review"
          : "No urgent stock gaps right now",
      tone: restockNeeded.length > 0 ? "warning" : "success",
      icon: PackageSearch,
    },
    {
      title: "New Supplier Messages",
      value: newSupplierMessages.length.toString(),
      change:
        newSupplierMessages.length > 0
          ? "Conversations waiting for a response"
          : "No new supplier replies waiting",
      tone: newSupplierMessages.length > 0 ? "ai" : "success",
      icon: MessageSquareText,
    },
    {
      title: "Invoices Needing Attention",
      value: invoicesNeedingAttention.length.toString(),
      change:
        invoicesNeedingAttention.length > 0
          ? "Invoices still in review or payment"
          : "All invoices are settled",
      tone: invoicesNeedingAttention.length > 0 ? "danger" : "success",
      icon: FileWarning,
    },
  ]

  const priorityQueue: PriorityItem[] = [
    ...restockNeeded.slice(0, 3).map((item) => ({
      id: item.id,
      label: item.productName,
      summary: `${item.supplier} · ${item.currentStock}/${item.currentThreshold} in stock · ${item.quantity.toLocaleString("en-US")} suggested`,
      status: restockStatusLabel(item),
      tone: restockStatusTone(item),
      href:
        item.restockRequestStatus === "accepted" && item.workflowId
          ? `/inventory/${item.sku}`
          : `/inventory/${item.sku}`,
    })),
    ...newSupplierMessages.slice(0, 3).map((conversation) => ({
      id: conversation.id,
      label: supplierName(suppliers, conversation.supplierId),
      summary: `${conversation.linkedSkus[0] ?? "Supplier update"} · ${conversation.nextAction.recommendedNextStep}`,
      status:
        conversation.negotiationState === "Escalated"
          ? "Needs attention"
          : "New message",
      tone:
        conversation.negotiationState === "Escalated" ? "warning" : "ai",
      href: `/conversations/${conversation.id}`,
    })),
    ...invoicesNeedingAttention.slice(0, 3).map((invoice) => ({
      id: invoice.id,
      label: supplierName(suppliers, invoice.supplierId),
      summary: `${invoice.currency} ${invoice.amount.toLocaleString("en-US")} · ${invoice.invoiceNumber}`,
      status:
        invoice.approvalState === "Needs Review"
          ? "Needs attention"
          : invoice.approvalState === "Blocked"
            ? "Issue found"
            : "Ready for approval",
      tone: approvalTone[invoice.approvalState],
      href: `/invoice-management/${invoice.id}`,
    })),
  ].slice(0, 9)

  return (
    <>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.9fr)_360px]">
        <Card className="panel-surface rounded-3xl py-0 shadow-none ring-0">
          <CardContent className="p-6 sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#FACC15]/20 bg-[#FACC15]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#FCD34D]">
                  <Sparkles className="size-3" aria-hidden="true" />
                  Bee2Bee Overview
                </div>
                <h1 className="max-w-3xl text-[1.75rem] font-semibold leading-tight text-[#F8FAFC] sm:text-[2.15rem]">
                  Operations Dashboard
                </h1>
                <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[#94A3B8] sm:text-[15px]">
                  See what needs action across stock, suppliers, and invoices.
                </p>
              </div>

              <Button
                asChild
                className="h-11 shrink-0 rounded-2xl bg-[#FACC15] px-5 font-semibold text-[#111827] hover:bg-[#EAB308]"
              >
                <Link href="#priority-queue">
                  Review priority queue
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>

          </CardContent>
        </Card>

        <Card className="panel-surface rounded-3xl py-0 shadow-none ring-0">
          <CardHeader className="border-b border-[#243047] px-5 py-4">
            <CardTitle className="text-[18px] font-semibold text-[#F8FAFC]">
              Quick Actions
            </CardTitle>
            <p className="mt-1 text-[14px] text-[#94A3B8]">
              Jump straight to the area you need.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            <QuickActionLink
              href="/inventory"
              title="Review stock"
              body="Open product stock and restock suggestions."
            />
            <QuickActionLink
              href="/conversations"
              title="Open supplier inbox"
              body="Reply to suppliers and review accepted deals."
            />
            <QuickActionLink
              href="/invoice-management"
              title="Review invoices"
              body="Check invoices waiting for approval or payment."
            />
            <QuickActionLink
              href="/suppliers"
              title="Manage suppliers"
              body="Update supplier records and SKU assignments."
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
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

      <section className="grid gap-6 xl:grid-cols-[minmax(0,2.35fr)_320px]">
        <Card
          id="priority-queue"
          className="panel-surface rounded-3xl py-0 shadow-none ring-0"
        >
          <CardHeader className="border-b border-[#243047] px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-[20px] font-semibold text-[#F8FAFC]">
                  Priority Queue
                </CardTitle>
                <p className="mt-1 text-[14px] text-[#94A3B8]">
                  One place to review the next most important tasks.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge
                  label={`${priorityQueue.length} items`}
                  tone={priorityQueue.length > 0 ? "warning" : "success"}
                />
                <p className="text-[12px] text-[#64748B]">
                  Sorted by current urgency
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-[#243047] hover:bg-transparent">
                  <TableHead className="px-5 text-[12px] text-[#9CA3AF]">
                    Item
                  </TableHead>
                  <TableHead className="text-[12px] text-[#9CA3AF]">
                    Summary
                  </TableHead>
                  <TableHead className="text-[12px] text-[#9CA3AF]">
                    Status
                  </TableHead>
                  <TableHead className="text-right text-[12px] text-[#9CA3AF]">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {priorityQueue.map((item) => (
                  <TableRow
                    key={`${item.href}-${item.id}`}
                    className="border-[#243047] hover:bg-[#172033]/70"
                  >
                    <TableCell className="px-5 py-4 text-[15px] font-medium text-[#E5E7EB]">
                      {item.label}
                    </TableCell>
                    <TableCell className="py-4 text-[14px] text-[#9CA3AF]">
                      {item.summary}
                    </TableCell>
                    <TableCell className="py-4">
                      <StatusBadge label={item.status} tone={item.tone} />
                    </TableCell>
                    <TableCell className="py-4 text-right">
                      <Button
                        asChild
                        variant="outline"
                        className="h-9 rounded-2xl border-[#334155] bg-[#172033] px-3 text-[#E5E7EB] hover:border-[#38BDF8]/40 hover:bg-[#1B2940]"
                      >
                        <Link href={item.href}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {priorityQueue.length === 0 ? (
                  <TableRow className="border-[#243047] hover:bg-transparent">
                    <TableCell
                      colSpan={4}
                      className="px-5 py-10 text-center text-[14px] text-[#9CA3AF]"
                    >
                      No urgent items right now.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="panel-surface rounded-3xl py-0 shadow-none ring-0">
            <CardHeader className="border-b border-[#243047] px-5 py-4">
              <CardTitle className="text-[18px] font-semibold text-[#F8FAFC]">
                Today&apos;s Focus
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5 text-[14px] text-[#94A3B8]">
              <FocusRow
                icon={AlertTriangle}
                title="Restock gaps"
                value={`${restockNeeded.length} product${restockNeeded.length === 1 ? "" : "s"} waiting`}
              />
              <FocusRow
                icon={MessageSquareText}
                title="Supplier follow-up"
                value={`${newSupplierMessages.length} conversation${newSupplierMessages.length === 1 ? "" : "s"} in progress`}
              />
              <FocusRow
                icon={FileWarning}
                title="Invoice review"
                value={`${invoicesNeedingAttention.length} invoice${invoicesNeedingAttention.length === 1 ? "" : "s"} still active`}
              />
            </CardContent>
          </Card>

          <Card className="panel-surface rounded-3xl py-0 shadow-none ring-0">
            <CardHeader className="border-b border-[#243047] px-5 py-4">
              <CardTitle className="text-[18px] font-semibold text-[#F8FAFC]">
                Operator Note
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              <p className="text-[14px] leading-6 text-[#94A3B8]">
                Start with the priority queue when you need the fastest path to action.
                Use the quick actions above only when you already know which workflow you want.
              </p>
              <div className="rounded-2xl border border-[#243047] bg-[#172033] px-4 py-3">
                <p className="text-[12px] uppercase tracking-[0.16em] text-[#64748B]">
                  Recommended flow
                </p>
                <p className="mt-2 text-[14px] text-[#E5E7EB]">
                  Stock review, then supplier response, then invoice approval.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  )
}

function QuickActionLink({
  href,
  title,
  body,
}: {
  href: string
  title: string
  body: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 rounded-2xl border border-[#243047] bg-[#172033] px-4 py-3 transition-colors hover:border-[#3B82F6]/40 hover:bg-[#1B2940]"
    >
      <div>
        <p className="text-[15px] font-medium text-[#E5E7EB]">{title}</p>
        <p className="mt-1 text-[13px] text-[#94A3B8]">{body}</p>
      </div>
      <ArrowRight className="size-4 shrink-0 text-[#93C5FD]" aria-hidden="true" />
    </Link>
  )
}

function FocusRow({
  icon: Icon,
  title,
  value,
}: {
  icon: LucideIcon
  title: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#243047] bg-[#172033] px-4 py-3">
      <div className="flex size-10 items-center justify-center rounded-2xl bg-[#0F1728]">
        <Icon className="size-4 text-[#93C5FD]" aria-hidden="true" />
      </div>
      <div>
        <p className="text-[13px] uppercase tracking-[0.16em] text-[#64748B]">
          {title}
        </p>
        <p className="mt-1 text-[15px] font-medium text-[#E5E7EB]">{value}</p>
      </div>
    </div>
  )
}
