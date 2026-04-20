import Link from "next/link"
import { ArrowRight, History, Inbox } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterToolbar } from "@/components/shared/filter-toolbar"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getInvoices, getSuppliers } from "@/lib/data"
import type { Invoice, StatusTone, Supplier } from "@/lib/types"

const riskTone: Record<Invoice["riskLevel"], StatusTone> = {
  "Low Risk": "success",
  "Medium Risk": "warning",
  "High Risk": "danger",
}

const validationTone: Record<Invoice["validationStatus"], StatusTone> = {
  Parsed: "default",
  Validated: "success",
  "Mismatch Detected": "danger",
  "Missing Information": "warning",
}

const approvalLanes: Array<{
  state: Invoice["approvalState"]
  title: string
  description: string
  accent: string
}> = [
  {
    state: "Waiting Approval",
    title: "Waiting Approval",
    description: "Clean invoices ready for final review.",
    accent: "#8B5CF6",
  },
  {
    state: "Needs Review",
    title: "Needs Review",
    description: "Mismatch or validation issue needs attention.",
    accent: "#F59E0B",
  },
  {
    state: "Blocked",
    title: "Blocked",
    description: "Cannot approve until the issue is cleared.",
    accent: "#EF4444",
  },
]

function supplierName(suppliers: Supplier[], supplierId: string) {
  return (
    suppliers.find((supplier) => supplier.id === supplierId)?.name ??
    "Unknown supplier"
  )
}

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  timeZone: "UTC",
})

export default async function InvoiceManagementPage() {
  const [invoices, suppliers] = await Promise.all([getInvoices(), getSuppliers()])

  return (
    <>
      <PageHeader
        eyebrow="Finance operations"
        title="Invoice Management"
        description="Review invoice risk, validation status, and approval pipeline."
        actions={
          <Button
            asChild
            variant="outline"
            className="h-10 rounded-[10px] border-[#243047] bg-[#172033] text-[#E5E7EB] hover:bg-[#243047]"
          >
            <Link href="/invoice-management/completed" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Completed History
            </Link>
          </Button>
        }
      />

      <FilterToolbar searchPlaceholder="Search invoices, suppliers, SKU, workflow, or approval state..." />

      <section className="grid grid-cols-3 gap-4">
        {approvalLanes.map((lane) => {
          const invoicesByLane = invoices.filter(
            (invoice) => invoice.approvalState === lane.state
          )

          return (
            <Card
              key={lane.state}
              className="min-h-[420px] rounded-[14px] border border-[#243047] border-t-4 bg-[#111827] py-0 shadow-none ring-0 transition hover:border-[#3B82F6]/60"
              style={{ borderTopColor: lane.accent }}
            >
              <CardContent className="p-0">
                <div className="border-b border-[#243047] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-[18px] font-semibold text-[#E5E7EB]">
                        {lane.title}
                      </h2>
                      <p className="mt-2 min-h-10 text-[13px] leading-5 text-[#9CA3AF]">
                        {lane.description}
                      </p>
                    </div>
                    <span
                      className="rounded-[10px] border px-3 py-1 text-[13px] font-semibold"
                      style={{
                        borderColor: `${lane.accent}66`,
                        backgroundColor: `${lane.accent}1A`,
                        color: lane.accent,
                      }}
                    >
                      {invoicesByLane.length}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 p-3">
                  {invoicesByLane.length > 0 ? (
                    invoicesByLane.map((invoice) => (
                      <InvoiceWorkCard
                        key={invoice.id}
                        invoice={invoice}
                        suppliers={suppliers}
                      />
                    ))
                  ) : (
                    <EmptyState
                      icon={Inbox}
                      title="No invoices"
                      description="This queue is clear for the current demo data."
                      compact
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </section>
    </>
  )
}

function InvoiceWorkCard({
  invoice,
  suppliers,
}: {
  invoice: Invoice
  suppliers: Supplier[]
}) {
  return (
    <article className="rounded-[12px] border border-[#243047] bg-[#172033] p-4 transition hover:border-[#3B82F6]/70 hover:bg-[#1B263C]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-[#E5E7EB]">
            {invoice.id}
          </p>
          <p className="mt-1 text-[13px] leading-5 text-[#9CA3AF]">
            {supplierName(suppliers, invoice.supplierId)}
          </p>
        </div>
        <p className="text-right text-[15px] font-semibold text-[#E5E7EB]">
          {invoice.currency} {invoice.amount.toLocaleString("en-US")}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <StatusBadge
          label={invoice.riskLevel}
          tone={riskTone[invoice.riskLevel]}
        />
        <StatusBadge
          label={invoice.validationStatus}
          tone={validationTone[invoice.validationStatus]}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-[10px] bg-[#0B1020] p-3">
        <div>
          <p className="text-[13px] text-[#6B7280]">Workflow</p>
          <p className="mt-1 text-[13px] font-medium text-[#E5E7EB]">
            {invoice.workflowId}
          </p>
        </div>
        <div>
          <p className="text-[13px] text-[#6B7280]">Updated</p>
          <p className="mt-1 text-[13px] font-medium text-[#E5E7EB]">
            {dateFormatter.format(new Date(invoice.lastUpdated))}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {invoice.linkedSkus.map((sku) => (
          <Link key={sku} href={`/inventory/${sku}`}>
            <StatusBadge
              label={sku}
              tone="default"
              className="hover:border-[#3B82F6] hover:text-[#93C5FD]"
            />
          </Link>
        ))}
      </div>

      <Button
        asChild
        className="mt-4 h-9 w-full rounded-[10px] bg-[#111827] text-[#E5E7EB] hover:bg-[#243047]"
      >
        <Link
          href={`/invoice-management/${invoice.id}`}
          className="flex items-center justify-center gap-2"
        >
          Review Invoice
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </article>
  )
}
