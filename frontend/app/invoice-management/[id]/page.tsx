import Link from "next/link"
import { notFound } from "next/navigation"

import { PageHeader } from "@/components/layout/page-header"
import { AiReasoningTrail } from "@/components/shared/ai-reasoning-trail"
import { InvoiceAiRetryButton } from "@/components/shared/invoice-ai-retry-button"
import { InvoiceFilePreview } from "@/components/shared/invoice-file-preview"
import { InvoiceProcessingTrigger } from "@/components/shared/invoice-ai-analysis-trigger"
import { InvoiceDecisionActions } from "@/components/shared/invoice-decision-actions"
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

export const dynamic = "force-dynamic"

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

type ValidationDisplayState = "match" | "mismatch" | "unchecked"

const PLACEHOLDER_REFERENCE_VALUES = new Set([
  "",
  "supplier master",
  "not provided",
  "unknown",
  "unknown supplier",
  "system reference unavailable",
])

function normalizeComparableValue(value?: string | null) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
}

function isPlaceholderReferenceValue(value?: string | null) {
  return PLACEHOLDER_REFERENCE_VALUES.has(normalizeComparableValue(value))
}

function validationDisplayState(
  expected: string,
  actual: string,
  matched: boolean
): ValidationDisplayState {
  if (isPlaceholderReferenceValue(expected)) {
    return "unchecked"
  }

  return matched ? "match" : "mismatch"
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
  const shouldProcessInvoice =
    invoice.processingStatus === "idle" &&
    (!invoice.extractedText || !invoice.aiLastAnalyzedAt)
  const isProcessingInvoice = invoice.processingStatus != null && invoice.processingStatus !== "idle"
  const usedFallbackValidation =
    !invoice.aiLastAnalyzedAt &&
    invoice.riskReason.toLowerCase().startsWith("fallback validation only:")
  const invoiceReasoning = buildInvoiceReasoning(invoice, supplier)
  const supplierExpectedValue =
    invoice.expectedSupplierName ?? supplier?.name ?? "Unknown supplier"
  const supplierActualValue = supplier?.name ?? "Unknown supplier"
  const bankDetailsExpectedValue = invoice.expectedBankDetails ?? "Supplier master"
  const bankDetailsActualValue = invoice.bankDetails
  const currencyExpectedValue = invoice.expectedCurrency ?? "MYR"
  const currencyActualValue = invoice.currency ?? "MYR"

  if (isProcessingInvoice) {
    return (
      <>
        <InvoiceProcessingTrigger
          invoiceId={invoice.id}
          shouldProcess={false}
          processingStatus={invoice.processingStatus}
        />

        <PageHeader
          eyebrow="Invoice detail"
          title={invoice.invoiceNumber}
          description={`${supplier?.name ?? "Unknown supplier"} / ${invoice.workflowId}`}
          actions={
            <Button
              asChild
              className="h-10 rounded-[10px] bg-[#3B82F6] px-4 text-white hover:bg-[#2563EB]"
            >
              <Link href="/invoice-management">Back to invoices</Link>
            </Button>
          }
        />

        <section className="rounded-[14px] border border-[#1D4ED8]/50 bg-[#172554] p-8 text-center shadow-[0_16px_40px_rgba(29,78,216,0.12)]">
          <p className="text-[15px] font-semibold text-[#DBEAFE]">
            Invoice is being processed. Please wait...
          </p>
          <p className="mt-3 text-[14px] leading-6 text-[#BFDBFE]">
            {invoice.processingStatus === "extracting"
              ? "OCR is extracting invoice text and repairing the initial structured fields."
              : "AI validation and risk analysis are currently running."}
          </p>
        </section>
      </>
    )
  }

  return (
    <>
      <InvoiceProcessingTrigger
        invoiceId={invoice.id}
        shouldProcess={shouldProcessInvoice}
        processingStatus={invoice.processingStatus}
      />

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
              <InvoiceFilePreview
                fileUrl={invoice.fileUrl}
                invoiceNumber={invoice.invoiceNumber}
                supplierName={supplier?.name ?? "Unknown supplier"}
                amount={invoice.amount}
                currency={invoice.currency}
                dueDate={invoice.dueDate}
                paymentTerms={invoice.paymentTerms}
                sourceType={invoice.sourceType}
              />
              <div className="space-y-4">
                <InfoRow label="File Name" value={invoice.fileName} />
                <InfoRow label="Source Type" value={invoice.sourceType} />
                <InfoRow label="File Size" value={invoice.fileSize} />
                <InfoRow label="Validation Status" value={invoice.validationStatus} />
                <div className="rounded-[12px] border border-[#243047] bg-[#172033] p-4">
                  <p className="text-[13px] text-[#9CA3AF]">Review context</p>
                  <p className="mt-2 text-[15px] leading-6 text-[#E5E7EB]">
                    Click the small preview card to pop up the original
                    uploaded invoice file on this page. Use the validation
                    section below to compare against negotiated terms.
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
                    expected={
                      invoice.expectedAmountLabel ??
                      `${invoice.currency} ${invoice.negotiatedAmount.toLocaleString("en-US")}`
                    }
                    actual={`${invoice.currency} ${invoice.amount.toLocaleString("en-US")}`}
                    state={
                      !invoice.flags.amountMismatch ? "match" : "mismatch"
                    }
                  />
                  <ValidationRow
                    check="Quantity"
                    expected={invoice.expectedQuantity.toLocaleString("en-US")}
                    actual={invoice.invoiceQuantity.toLocaleString("en-US")}
                    state={
                      invoice.expectedQuantity === invoice.invoiceQuantity
                        ? "match"
                        : "mismatch"
                    }
                  />
                  <ValidationRow
                    check="Supplier Info"
                    expected={supplierExpectedValue}
                    actual={supplierActualValue}
                    state={validationDisplayState(
                      supplierExpectedValue,
                      supplierActualValue,
                      !invoice.flags.supplierInconsistency
                    )}
                  />
                  <ValidationRow
                    check="Currency"
                    expected={currencyExpectedValue}
                    actual={currencyActualValue}
                    state={validationDisplayState(
                      currencyExpectedValue,
                      currencyActualValue,
                      normalizeComparableValue(currencyExpectedValue) ===
                        normalizeComparableValue(currencyActualValue)
                    )}
                  />
                  <ValidationRow
                    check="Bank Details"
                    expected={bankDetailsExpectedValue}
                    actual={bankDetailsActualValue}
                    state={validationDisplayState(
                      bankDetailsExpectedValue,
                      bankDetailsActualValue,
                      !invoice.flags.bankDetailsIssue &&
                        normalizeComparableValue(bankDetailsExpectedValue) ===
                          normalizeComparableValue(bankDetailsActualValue)
                    )}
                  />
                </TableBody>
              </Table>
              <div className="border-t border-[#243047] p-4">
                <p className="text-[13px] font-medium text-[#9CA3AF]">
                  Mismatch List
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {invoice.mismatches.length > 0 ? (
                    invoice.mismatches.map((mismatch, index) => (
                      <StatusBadge
                        key={`${mismatch}-${index}`}
                        label={mismatch}
                        tone="danger"
                      />
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
              {!invoice.aiLastAnalyzedAt ? (
                <div className="rounded-[12px] border border-[#243047] bg-[#172033] p-4">
                  <p className="text-[13px] font-medium text-[#9CA3AF]">
                    AI status
                  </p>
                  <p className="mt-2 text-[14px] leading-6 text-[#E5E7EB]">
                    {usedFallbackValidation
                      ? "The automatic AI attempt already ran once, but it fell back to rule-based validation. You can retry the live AI call here if the backend/model issue is now resolved."
                      : "This invoice does not have a completed AI analysis yet. The pipeline will try automatically when processing starts, and you can also retry the live AI call here."}
                  </p>
                  <div className="mt-3">
                    <InvoiceAiRetryButton
                      invoiceId={invoice.id}
                      disabled={isProcessingInvoice}
                    />
                  </div>
                </div>
              ) : null}
              <div className="rounded-[12px] border border-[#243047] bg-[#172033] p-4">
                <p className="text-[13px] font-medium text-[#9CA3AF]">
                  Issues detected
                </p>
                {invoice.issueSummaries.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-[14px] leading-6 text-[#E5E7EB]">
                    {invoice.issueSummaries.slice(0, 3).map((issue, index) => (
                      <li key={`${issue}-${index}`} className="flex gap-2">
                        <span className="text-[#F59E0B]">•</span>
                        <span>{issue}</span>
                      </li>
                    ))}
                    {invoice.issueSummaries.length > 3 ? (
                      <li className="text-[13px] text-[#9CA3AF]">
                        +{invoice.issueSummaries.length - 3} more
                      </li>
                    ) : null}
                  </ul>
                ) : (
                  <p className="mt-2 text-[14px] leading-6 text-[#86EFAC]">
                    No AI issues detected.
                  </p>
                )}
              </div>
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
          <InvoiceDecisionActions
            invoiceId={invoice.id}
            isCompleted={isCompleted}
            approvalState={invoice.approvalState}
          />
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
  state,
}: {
  check: string
  expected: string
  actual: string
  state: ValidationDisplayState
}) {
  const badge =
    state === "match"
      ? { label: "Match", tone: "success" as const }
      : state === "mismatch"
        ? { label: "Mismatch", tone: "danger" as const }
        : { label: "Not checked", tone: "default" as const }

  return (
    <TableRow className="border-[#243047] hover:bg-[#172033]/70">
      <TableCell className="px-4 text-[15px] font-medium text-[#E5E7EB]">
        {check}
      </TableCell>
      <TableCell className="text-[15px] text-[#9CA3AF]">{expected}</TableCell>
      <TableCell className="text-[15px] text-[#9CA3AF]">{actual}</TableCell>
      <TableCell>
        <StatusBadge label={badge.label} tone={badge.tone} />
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
