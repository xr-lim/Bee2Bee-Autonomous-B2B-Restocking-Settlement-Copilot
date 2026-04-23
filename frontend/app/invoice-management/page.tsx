import Link from "next/link"
import { History } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { InvoiceBoard } from "@/components/shared/invoice-board"
import { Button } from "@/components/ui/button"
import { getInvoices, getSuppliers } from "@/lib/data"

export const dynamic = "force-dynamic"

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

      <InvoiceBoard invoices={invoices} suppliers={suppliers} />
    </>
  )
}
