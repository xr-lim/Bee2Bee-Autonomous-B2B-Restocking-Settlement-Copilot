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
import { getInvoices, getSuppliers } from "@/lib/data"
import type { Invoice, StatusTone } from "@/lib/types"

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
  const [invoices, suppliers] = await Promise.all([
    getInvoices(),
    getSuppliers(),
  ])
  const invoice = invoices.find((item) => item.id === id)

  if (!invoice) {
    notFound()
  }

  const supplier = suppliers.find((item) => item.id === invoice.supplierId)
  const isCompleted = invoice.approvalState === "Completed"
  const shouldProcessInvoice =
    invoice.processingStatus === "idle" &&
    (!invoice.extractedText || !invoice.aiLastAnalyzedAt)
  const isProcessingInvoice = invoice.processingStatus != null && invoice.processingStatus !== "idle"
  const usedFallbackValidation =
    !invoice.aiLastAnalyzedAt &&
    invoice.riskReason.toLowerCase().startsWith("fallback validation only:")
  const invoiceReasoning = buildInvoiceReasoning(invoice, supplier)
  const validationChecks =
    invoice.validationChecks && invoice.validationChecks.length > 0
      ? invoice.validationChecks
      : [
          {
            check: "Amount",
            expected:
              invoice.expectedAmountLabel ??
              `${invoice.currency} ${invoice.negotiatedAmount.toLocaleString("en-US")}`,
            actual: `${invoice.currency} ${invoice.amount.toLocaleString("en-US")}`,
            state: invoice.flags.amountMismatch ? "mismatch" : "match",
          },
          {
            check: "Quantity",
            expected: invoice.expectedQuantity.toLocaleString("en-US"),
            actual: invoice.invoiceQuantity.toLocaleString("en-US"),
            state:
              invoice.expectedQuantity === invoice.invoiceQuantity
                ? "match"
                : "mismatch",
          },
          {
            check: "Supplier Info",
            expected: invoice.expectedSupplierName ?? supplier?.name ?? "Unknown supplier",
            actual: supplier?.name ?? "Unknown supplier",
            state: invoice.flags.supplierInconsistency ? "mismatch" : "match",
          },
          {
            check: "Currency",
            expected: invoice.expectedCurrency ?? "MYR",
            actual: invoice.currency,
            state:
              (invoice.expectedCurrency ?? "MYR").trim().toLowerCase() ===
              invoice.currency.trim().toLowerCase()
                ? "match"
                : "mismatch",
          },
        ] satisfies NonNullable<Invoice["validationChecks"]>
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

      <div className="space-y-7 xl:space-y-8">
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

        <section className="grid gap-7 xl:gap-8 lg:grid-cols-[1fr_400px]">
          <main className="space-y-7">
            <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
            <CardHeader className="border-b border-[#243047] p-5">
              <CardTitle className="text-[18px] font-semibold text-[#E5E7EB]">
                Invoice Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-[300px_1fr] gap-7 p-6">
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
              <div className="space-y-5">
                <InfoRow label="File Name" value={invoice.fileName} />
                <InfoRow label="Source Type" value={invoice.sourceType} />
                <InfoRow label="File Size" value={invoice.fileSize} />
                <InfoRow label="Validation Status" value={invoice.validationStatus} />
                <div className="rounded-[12px] border border-[#243047] bg-[#172033] p-5">
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
            <CardHeader className="border-b border-[#243047] p-5">
              <CardTitle className="text-[18px] font-semibold text-[#E5E7EB]">
                Check Result
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#243047] hover:bg-transparent">
                    <TableHead className="px-5 py-3 text-[13px] text-[#9CA3AF]">
                      Check
                    </TableHead>
                    <TableHead className="py-3 text-[13px] text-[#9CA3AF]">
                      Expected
                    </TableHead>
                    <TableHead className="py-3 text-[13px] text-[#9CA3AF]">
                      Invoice
                    </TableHead>
                    <TableHead className="py-3 text-[13px] text-[#9CA3AF]">
                      Result
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validationChecks.map((check) => (
                    <ValidationRow
                      key={`${check.check}-${check.expected}-${check.actual}`}
                      check={check.check}
                      expected={check.expected}
                      actual={check.actual}
                      state={check.state}
                    />
                  ))}
                </TableBody>
              </Table>
              <div className="border-t border-[#243047] p-5">
                <p className="text-[13px] font-medium text-[#9CA3AF]">
                  Issues to Review
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

        <aside className="space-y-7">
          <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
            <CardHeader className="border-b border-[#243047] p-5">
              <CardTitle className="text-[18px] font-semibold text-[#E5E7EB]">
                Risk Analysis Panel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <StatusBadge label={invoice.riskLevel} tone={riskTone[invoice.riskLevel]} />
              {!invoice.aiLastAnalyzedAt ? (
                <div className="rounded-[12px] border border-[#243047] bg-[#172033] p-5">
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
              <div className="rounded-[12px] border border-[#243047] bg-[#172033] p-5">
                <p className="text-[13px] font-medium text-[#9CA3AF]">
                  Review summary
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
                    No issues detected.
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

        <section className="rounded-[14px] border border-[#3B82F6]/40 bg-[#172033] p-6 shadow-[0_16px_40px_rgba(59,130,246,0.08)]">
          <div className="grid grid-cols-[1fr_auto] items-center gap-6">
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
      </div>
    </>
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

  const rowClassName =
    state === "mismatch"
      ? "border-[#7F1D1D]/60 bg-[#7F1D1D]/18 shadow-[inset_4px_0_0_rgba(239,68,68,0.8)] hover:bg-[#7F1D1D]/24"
      : "border-[#243047] hover:bg-[#172033]/70"

  return (
    <TableRow className={rowClassName}>
      <TableCell className="px-5 py-4 text-[15px] font-medium text-[#E5E7EB]">
        {check}
      </TableCell>
      <TableCell className="py-4 text-[15px] text-[#9CA3AF]">
        {expected}
      </TableCell>
      <TableCell className="py-4 text-[15px] text-[#9CA3AF]">
        {actual}
      </TableCell>
      <TableCell className="py-4">
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
