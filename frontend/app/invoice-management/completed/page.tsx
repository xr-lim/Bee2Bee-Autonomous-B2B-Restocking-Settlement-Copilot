import Link from "next/link"
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react"

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

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
})

function supplierName(suppliers: Supplier[], supplierId: string) {
  return (
    suppliers.find((supplier) => supplier.id === supplierId)?.name ??
    "Unknown supplier"
  )
}

export default async function CompletedInvoicesPage() {
  const [invoices, suppliers] = await Promise.all([getInvoices(), getSuppliers()])
  const completedInvoices = invoices
    .filter((invoice) => invoice.approvalState === "Completed")
    .toSorted(
      (a, b) =>
        new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
    )
  const completedTotal = completedInvoices.reduce(
    (total, invoice) => total + invoice.amount,
    0
  )

  return (
    <>
      <PageHeader
        eyebrow="Invoice history"
        title="Completed Invoices"
        description="Review approved and closed invoices without crowding the active approval board."
        actions={
          <Button
            asChild
            variant="outline"
            className="h-10 rounded-[10px] border-[#243047] bg-[#172033] text-[#E5E7EB] hover:bg-[#243047]"
          >
            <Link href="/invoice-management" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Active Invoices
            </Link>
          </Button>
        }
      />

      <section className="grid grid-cols-[1fr_240px_240px] gap-4">
        <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-[#10B981]/15 text-[#10B981]">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[12px] text-[#9CA3AF]">History Scope</p>
              <p className="mt-1 text-[16px] font-semibold text-[#E5E7EB]">
                Completed invoice archive
              </p>
            </div>
          </CardContent>
        </Card>
        <HistoryStat label="Completed" value={completedInvoices.length.toString()} />
        <HistoryStat
          label="Closed Value"
          value={`USD ${completedTotal.toLocaleString("en-US")}`}
        />
      </section>

      <FilterToolbar searchPlaceholder="Search completed invoices, suppliers, SKU, workflow, or amount..." />

      <section className="space-y-3">
        {completedInvoices.length > 0 ? (
          completedInvoices.map((invoice) => (
          <article
            key={invoice.id}
            className="grid grid-cols-12 items-center gap-3 rounded-[12px] border border-[#243047] bg-[#111827] px-4 py-3 transition hover:border-[#3B82F6]/70 hover:bg-[#172033]"
          >
            <div className="col-span-2">
              <p className="text-[14px] font-semibold text-[#E5E7EB]">
                {invoice.id}
              </p>
              <p className="mt-0.5 text-[12px] text-[#9CA3AF]">
                {dateFormatter.format(new Date(invoice.lastUpdated))}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-[12px] text-[#6B7280]">Supplier</p>
              <p className="mt-0.5 truncate text-[14px] font-medium text-[#E5E7EB]">
                {supplierName(suppliers, invoice.supplierId)}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-[12px] text-[#6B7280]">Linked SKU(s)</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
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
            </div>
            <div className="col-span-2">
              <p className="text-[12px] text-[#6B7280]">Amount</p>
              <p className="mt-0.5 text-[14px] font-semibold text-[#E5E7EB]">
                {invoice.currency} {invoice.amount.toLocaleString("en-US")}
              </p>
            </div>
            <div className="col-span-3 flex flex-wrap gap-1.5">
              <StatusBadge label={invoice.approvalState} tone="success" />
              <StatusBadge
                label={invoice.riskLevel}
                tone={riskTone[invoice.riskLevel]}
              />
              <StatusBadge
                label={invoice.validationStatus}
                tone={validationTone[invoice.validationStatus]}
              />
              <StatusBadge label={invoice.workflowId} tone="default" />
            </div>
            <div className="col-span-1 flex justify-end">
              <Button
                asChild
                className="h-9 rounded-[10px] bg-[#172033] text-[#E5E7EB] hover:bg-[#243047]"
              >
                <Link
                  href={`/invoice-management/${invoice.id}`}
                  className="flex items-center gap-2"
                >
                  View
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </article>
          ))
        ) : (
          <EmptyState
            icon={CheckCircle2}
            title="No completed invoices yet"
            description="Completed approvals will appear here after finance closes an invoice packet."
            tone="success"
          />
        )}
      </section>
    </>
  )
}

function HistoryStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
      <CardContent className="p-4">
        <p className="text-[12px] text-[#9CA3AF]">{label}</p>
        <p className="mt-3 text-[24px] font-semibold text-[#E5E7EB]">
          {value}
        </p>
      </CardContent>
    </Card>
  )
}
