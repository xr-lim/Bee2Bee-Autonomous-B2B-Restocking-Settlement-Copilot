import Link from "next/link"
import { notFound } from "next/navigation"

import { PageHeader } from "@/components/layout/page-header"
import { MockInvoicePaymentPanel } from "@/components/shared/mock-invoice-payment-panel"
import { Button } from "@/components/ui/button"
import { getInvoices, getSuppliers } from "@/lib/data"

export const dynamic = "force-dynamic"

export default async function InvoicePaymentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [invoices, suppliers] = await Promise.all([getInvoices(), getSuppliers()])
  const invoice = invoices.find((item) => item.id === id)

  if (!invoice) {
    notFound()
  }

  const supplier =
    suppliers.find((item) => item.id === invoice.supplierId)?.name ?? "Unknown supplier"

  return (
    <>
      <PageHeader
        eyebrow="Finance operations"
        title="Mock Payment"
        description={`Complete a simulated payment for invoice ${invoice.invoiceNumber}.`}
        actions={
          <Button
            asChild
            className="h-10 rounded-[10px] bg-[#111827] px-4 text-[#E5E7EB] hover:bg-[#243047]"
          >
            <Link href={`/invoice-management/${invoice.id}`}>Back to Invoice</Link>
          </Button>
        }
      />

      <MockInvoicePaymentPanel
        invoiceId={invoice.id}
        invoiceNumber={invoice.invoiceNumber}
        supplierName={supplier}
        amount={invoice.amount}
        currency={invoice.currency}
        approvalState={invoice.approvalState}
      />
    </>
  )
}
