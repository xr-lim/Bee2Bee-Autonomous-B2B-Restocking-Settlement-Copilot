import Link from "next/link"
import { notFound } from "next/navigation"

import { PageHeader } from "@/components/layout/page-header"
import { AiReasoningTrail } from "@/components/shared/ai-reasoning-trail"
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
import { buildInvoiceReasoning } from "@/lib/ai-reasoning"
import { getInvoices, getProducts, getSuppliers } from "@/lib/data"
import type { Invoice, Product, StatusTone } from "@/lib/types"

const riskTone: Record<Invoice["riskLevel"], StatusTone> = {
  "Low Risk": "success",
  "Medium Risk": "warning",
  "High Risk": "danger",
}

const approvalTone: Record<Invoice["approvalState"], StatusTone> = {
  "Waiting Approval": "ai",
  "Needs Review": "warning",
  Blocked: "danger",
  Completed: "success",
}

export async function generateStaticParams() {
  const invoices = await getInvoices()
  return invoices.map((invoice) => ({ id: invoice.id }))
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [invoices, products, suppliers] = await Promise.all([
    getInvoices(),
    getProducts(),
    getSuppliers(),
  ])
  const invoice = invoices.find((item) => item.id === id)

  if (!invoice) {
    notFound()
  }

  const supplier = suppliers.find((item) => item.id === invoice.supplierId)
  const linkedProducts = invoice.linkedSkus
    .map((sku) => products.find((product) => product.sku === sku))
    .filter((product): product is Product => Boolean(product))
  const isCompleted = invoice.approvalState === "Completed"
  const invoiceReasoning = buildInvoiceReasoning(invoice, supplier)

  return (
    <>
      <PageHeader
        eyebrow="Invoice detail"
        title={invoice.invoiceNumber}
        description={`${supplier?.name ?? "Unknown supplier"} / ${invoice.workflowId}`}
        actions={
          <Button
            asChild
            className="h-10 rounded-[10px] bg-[#3B82F6] px-4 text-white hover:bg-[#2563EB]"
          >
            <Link
              href={
                isCompleted
                  ? "/invoice-management/completed"
                  : "/invoice-management"
              }
            >
              {isCompleted ? "Back to history" : "Back to invoices"}
            </Link>
          </Button>
        }
      />

      <section className="grid grid-cols-5 gap-3">
        <SummaryTile label="Invoice ID" value={invoice.id} />
        <SummaryTile label="Supplier" value={supplier?.name ?? "Unknown supplier"} />
        <div className="rounded-[10px] border border-[#243047] bg-[#111827] p-4">
          <p className="text-[13px] text-[#9CA3AF]">Linked SKU(s)</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
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
        <SummaryTile label="Workflow ID" value={invoice.workflowId} />
        <div className="rounded-[10px] border border-[#243047] bg-[#111827] p-4">
          <p className="text-[13px] text-[#9CA3AF]">Approval State</p>
          <div className="mt-2">
            <StatusBadge
              label={invoice.approvalState}
              tone={approvalTone[invoice.approvalState]}
            />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-[1fr_380px] gap-6">
        <main className="space-y-6">
          <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
            <CardHeader className="border-b border-[#243047] p-4">
              <CardTitle className="text-[18px] font-semibold text-[#E5E7EB]">
                Invoice Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-[280px_1fr] gap-5 p-5">
              <div className="flex h-[360px] flex-col rounded-[12px] border border-[#243047] bg-[#F8FAFC] p-5 text-[#111827]">
                <div className="mb-6 flex items-center justify-between border-b border-[#CBD5E1] pb-3">
                  <span className="text-[13px] font-semibold">INVOICE</span>
                  <span className="text-[13px]">{invoice.invoiceNumber}</span>
                </div>
                <div className="space-y-3 text-[13px]">
                  <p className="font-semibold">{supplier?.name}</p>
                  <p>Amount: {invoice.currency} {invoice.amount.toLocaleString("en-US")}</p>
                  <p>Due: {invoice.dueDate}</p>
                  <p>Terms: {invoice.paymentTerms}</p>
                </div>
                <div className="mt-auto space-y-2">
                  <div className="h-3 rounded bg-[#CBD5E1]" />
                  <div className="h-3 w-4/5 rounded bg-[#CBD5E1]" />
                  <div className="h-3 w-2/3 rounded bg-[#CBD5E1]" />
                </div>
              </div>
              <div className="space-y-4">
                <InfoRow label="File Name" value={invoice.fileName} />
                <InfoRow label="Source Type" value={invoice.sourceType} />
                <InfoRow label="File Size" value={invoice.fileSize} />
                <InfoRow label="Validation Status" value={invoice.validationStatus} />
                <div className="rounded-[12px] border border-[#243047] bg-[#172033] p-4">
                  <p className="text-[13px] text-[#9CA3AF]">Review context</p>
                  <p className="mt-2 text-[15px] leading-6 text-[#E5E7EB]">
                    Invoice preview is generated from parsed mock metadata. Use the
                    validation section below to compare against negotiated terms.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
            <CardHeader className="border-b border-[#243047] p-4">
              <CardTitle className="text-[18px] font-semibold text-[#E5E7EB]">
                Parsed Invoice Fields
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4 p-5">
              <InfoRow label="Invoice Number" value={invoice.invoiceNumber} />
              <InfoRow label="Supplier Name" value={supplier?.name ?? "Unknown supplier"} />
              <InfoRow
                label="Linked Products"
                value={linkedProducts.map((product) => product?.name).join(", ")}
              />
              <InfoRow label="Quantity" value={invoice.invoiceQuantity.toLocaleString("en-US")} />
              <InfoRow label="Unit Price" value={`${invoice.currency} ${invoice.unitPrice.toFixed(2)}`} />
              <InfoRow label="Subtotal" value={`${invoice.currency} ${invoice.subtotal.toLocaleString("en-US")}`} />
              <InfoRow label="Total" value={`${invoice.currency} ${invoice.amount.toLocaleString("en-US")}`} />
              <InfoRow label="Currency" value={invoice.currency} />
              <InfoRow label="Bank Details" value={invoice.bankDetails} />
              <InfoRow label="Payment Terms" value={invoice.paymentTerms} />
            </CardContent>
          </Card>

          <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
            <CardHeader className="border-b border-[#243047] p-4">
              <CardTitle className="text-[18px] font-semibold text-[#E5E7EB]">
                Validation Result
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#243047] hover:bg-transparent">
                    <TableHead className="px-4 text-[13px] text-[#9CA3AF]">
                      Check
                    </TableHead>
                    <TableHead className="text-[13px] text-[#9CA3AF]">
                      Expected
                    </TableHead>
                    <TableHead className="text-[13px] text-[#9CA3AF]">
                      Invoice
                    </TableHead>
                    <TableHead className="text-[13px] text-[#9CA3AF]">
                      Result
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <ValidationRow
                    check="Amount"
                    expected={`${invoice.currency} ${invoice.negotiatedAmount.toLocaleString("en-US")}`}
                    actual={`${invoice.currency} ${invoice.amount.toLocaleString("en-US")}`}
                    matched={!invoice.flags.amountMismatch}
                  />
                  <ValidationRow
                    check="Quantity"
                    expected={invoice.expectedQuantity.toLocaleString("en-US")}
                    actual={invoice.invoiceQuantity.toLocaleString("en-US")}
                    matched={invoice.expectedQuantity === invoice.invoiceQuantity}
                  />
                  <ValidationRow
                    check="Supplier Info"
                    expected={supplier?.name ?? "Unknown supplier"}
                    actual={supplier?.name ?? "Unknown supplier"}
                    matched={!invoice.flags.supplierInconsistency}
                  />
                  <ValidationRow
                    check="Currency"
                    expected="USD"
                    actual={invoice.currency}
                    matched={invoice.currency === "USD"}
                  />
                  <ValidationRow
                    check="Bank Details"
                    expected="Supplier master"
                    actual={invoice.bankDetails}
                    matched={!invoice.flags.bankDetailsIssue}
                  />
                </TableBody>
              </Table>
              <div className="border-t border-[#243047] p-4">
                <p className="text-[13px] font-medium text-[#9CA3AF]">
                  Mismatch List
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {invoice.mismatches.length > 0 ? (
                    invoice.mismatches.map((mismatch) => (
                      <StatusBadge key={mismatch} label={mismatch} tone="danger" />
                    ))
                  ) : (
                    <StatusBadge label="No mismatches detected" tone="success" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </main>

        <aside className="space-y-6">
          <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
            <CardHeader className="border-b border-[#243047] p-4">
              <CardTitle className="text-[18px] font-semibold text-[#E5E7EB]">
                Risk Analysis Panel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <StatusBadge label={invoice.riskLevel} tone={riskTone[invoice.riskLevel]} />
              <p className="text-[15px] leading-6 text-[#9CA3AF]">
                {invoice.riskReason}
              </p>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13px] text-[#9CA3AF]">Confidence</span>
                  <span className="text-[15px] font-semibold text-[#E5E7EB]">
                    {invoice.riskConfidence}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#172033]">
                  <div
                    className="h-2 rounded-full bg-[#8B5CF6]"
                    style={{ width: `${invoice.riskConfidence}%` }}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Flag label="Bank details issue" active={invoice.flags.bankDetailsIssue} />
                <Flag label="Amount mismatch" active={invoice.flags.amountMismatch} />
                <Flag label="Missing fields" active={invoice.flags.missingFields} />
                <Flag
                  label="Supplier inconsistency"
                  active={invoice.flags.supplierInconsistency}
                />
              </div>
              <AiReasoningTrail
                id={`invoice-${invoice.id}`}
                signals={invoiceReasoning.signals}
                confidence={invoiceReasoning.confidence}
                decision={invoiceReasoning.decision}
              />
            </CardContent>
          </Card>

          <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
            <CardHeader className="border-b border-[#243047] p-4">
              <CardTitle className="text-[18px] font-semibold text-[#E5E7EB]">
                Internal Notes and History
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <textarea
                defaultValue={invoice.notes}
                className="min-h-[96px] w-full resize-none rounded-[10px] border border-[#243047] bg-[#172033] p-3 text-[15px] text-[#E5E7EB] outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              />
              <div className="space-y-3">
                {invoice.history.map((event) => (
                  <div key={`${event.timestamp}-${event.title}`} className="border-l border-[#243047] pl-3">
                    <p className="text-[15px] font-medium text-[#E5E7EB]">
                      {event.title}
                    </p>
                    <p className="mt-1 text-[13px] leading-5 text-[#9CA3AF]">
                      {event.description}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>
      </section>

      <section className="rounded-[14px] border border-[#3B82F6]/40 bg-[#172033] p-5 shadow-[0_16px_40px_rgba(59,130,246,0.08)]">
        <div className="grid grid-cols-[1fr_auto] items-center gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[18px] font-semibold text-[#E5E7EB]">
                Final Approval Decision
              </p>
              <StatusBadge
                label={invoice.approvalState}
                tone={approvalTone[invoice.approvalState]}
              />
              <StatusBadge label={invoice.riskLevel} tone={riskTone[invoice.riskLevel]} />
            </div>
            <p className="mt-2 max-w-3xl text-[15px] leading-6 text-[#9CA3AF]">
              Review is complete when parsed fields, validation checks, risk flags,
              and notes are acceptable. Total invoice amount is {invoice.currency}{" "}
              {invoice.amount.toLocaleString("en-US")}.
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              disabled={isCompleted}
              className="h-11 rounded-[10px] bg-[#10B981] px-5 text-white hover:bg-[#059669] disabled:cursor-not-allowed disabled:bg-[#172033] disabled:text-[#6B7280]"
            >
              Approve
            </Button>
            <Button
              disabled={isCompleted}
              className="h-11 rounded-[10px] bg-[#F59E0B] px-5 text-[#111827] hover:bg-[#D97706] disabled:cursor-not-allowed disabled:bg-[#172033] disabled:text-[#6B7280]"
            >
              Hold Review
            </Button>
            <Button
              disabled={isCompleted}
              className="h-11 rounded-[10px] bg-[#EF4444] px-5 text-white hover:bg-[#DC2626] disabled:cursor-not-allowed disabled:bg-[#172033] disabled:text-[#6B7280]"
            >
              Reject / Block
            </Button>
            <Button
              disabled={isCompleted}
              className="h-11 rounded-[10px] border border-[#243047] bg-[#111827] px-5 text-[#E5E7EB] hover:bg-[#243047] disabled:cursor-not-allowed disabled:text-[#6B7280]"
            >
              {isCompleted ? "Already Completed" : "Mark Completed"}
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-[#243047] bg-[#111827] p-4">
      <p className="text-[13px] text-[#9CA3AF]">{label}</p>
      <p className="mt-2 truncate text-[15px] font-semibold text-[#E5E7EB]">
        {value}
      </p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[13px] text-[#9CA3AF]">{label}</p>
      <p className="mt-1 text-[15px] leading-6 text-[#E5E7EB]">{value}</p>
    </div>
  )
}

function ValidationRow({
  check,
  expected,
  actual,
  matched,
}: {
  check: string
  expected: string
  actual: string
  matched: boolean
}) {
  return (
    <TableRow className="border-[#243047] hover:bg-[#172033]/70">
      <TableCell className="px-4 text-[15px] font-medium text-[#E5E7EB]">
        {check}
      </TableCell>
      <TableCell className="text-[15px] text-[#9CA3AF]">{expected}</TableCell>
      <TableCell className="text-[15px] text-[#9CA3AF]">{actual}</TableCell>
      <TableCell>
        <StatusBadge
          label={matched ? "Match" : "Mismatch"}
          tone={matched ? "success" : "danger"}
        />
      </TableCell>
    </TableRow>
  )
}

function Flag({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-[10px] bg-[#172033] px-3 py-2">
      <span className="text-[13px] text-[#9CA3AF]">{label}</span>
      <StatusBadge label={active ? "Flagged" : "Clear"} tone={active ? "danger" : "success"} />
    </div>
  )
}
