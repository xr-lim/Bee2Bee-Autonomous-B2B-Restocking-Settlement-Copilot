import Link from "next/link"
import { ArrowLeft, CheckCircle2 } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { CompletedInvoicesList } from "@/components/shared/completed-invoices-list"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getInvoices, getSuppliers } from "@/lib/data"

export const dynamic = "force-dynamic"

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

      <CompletedInvoicesList
        invoices={completedInvoices}
        suppliers={suppliers}
      />
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
