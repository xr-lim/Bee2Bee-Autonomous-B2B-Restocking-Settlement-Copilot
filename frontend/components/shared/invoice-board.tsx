"use client"

import Link from "next/link"
import { ArrowRight, Inbox } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { EmptyState } from "@/components/shared/empty-state"
import { FilterToolbar } from "@/components/shared/filter-toolbar"
import { InvoiceProcessingTrigger } from "@/components/shared/invoice-ai-analysis-trigger"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { Invoice, StatusTone, Supplier } from "@/lib/types"

type InvoiceBoardProps = {
  invoices: Invoice[]
  suppliers: Supplier[]
}

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

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  timeZone: "UTC",
})

function supplierName(suppliers: Supplier[], supplierId: string) {
  return (
    suppliers.find((supplier) => supplier.id === supplierId)?.name ??
    "Unknown supplier"
  )
}

export function InvoiceBoard({ invoices, suppliers }: InvoiceBoardProps) {
  const [query, setQuery] = useState("")
  const [riskFilter, setRiskFilter] = useState("all")

  const filteredInvoices = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return invoices.filter((invoice) => {
      const haystack = [
        invoice.id,
        invoice.invoiceNumber,
        invoice.workflowId,
        invoice.approvalState,
        invoice.validationStatus,
        invoice.riskLevel,
        invoice.currency,
        invoice.amount.toString(),
        invoice.orderId ?? "",
        invoice.orderStatus ?? "",
        invoice.workflowState ?? "",
        invoice.linkedSkus.join(" "),
        supplierName(suppliers, invoice.supplierId),
      ]
        .join(" ")
        .toLowerCase()

      const matchesSearch = !keyword || haystack.includes(keyword)
      const matchesRisk = riskFilter === "all" || invoice.riskLevel === riskFilter
      return matchesSearch && matchesRisk
    })
  }, [invoices, query, riskFilter, suppliers])

  return (
    <>
      <FilterToolbar
        searchPlaceholder="Search invoices, suppliers, SKU, workflow, amount, or approval state..."
        searchValue={query}
        onSearchChange={setQuery}
        filterLabel="Invoice risk"
        filterValue={riskFilter}
        onFilterChange={setRiskFilter}
        filterOptions={[
          { label: "All risk levels", value: "all" },
          { label: "Low risk", value: "Low Risk" },
          { label: "Medium risk", value: "Medium Risk" },
          { label: "High risk", value: "High Risk" },
        ]}
      />

      <section className="grid grid-cols-3 gap-4">
        {approvalLanes.map((lane) => {
          const invoicesByLane = filteredInvoices.filter(
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
                      description="This queue is clear with the current filters."
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
  const [localProcessingLabel, setLocalProcessingLabel] = useState<string | null>(null)
  const shouldProcessInvoice =
    invoice.processingStatus === "idle" &&
    (!invoice.extractedText || !invoice.aiLastAnalyzedAt)

  useEffect(() => {
    if (invoice.processingStatus === "extracting") {
      setLocalProcessingLabel("Extracting...")
      return
    }

    if (invoice.processingStatus === "analyzing") {
      setLocalProcessingLabel("Analyzing...")
      return
    }

    if (invoice.aiLastAnalyzedAt) {
      setLocalProcessingLabel(null)
    }
  }, [invoice.aiLastAnalyzedAt, invoice.processingStatus])

  const processingLabel =
    invoice.processingStatus === "extracting"
      ? "Extracting..."
      : invoice.processingStatus === "analyzing"
        ? "Analyzing..."
        : localProcessingLabel
  const isProcessing = Boolean(processingLabel)
  const processingDescription =
    processingLabel === "Extracting..."
      ? "OCR is extracting invoice text and repairing core fields from the uploaded file."
      : processingLabel === "Analyzing..."
        ? "Text extraction is complete. AI validation and risk analysis are running now."
        : null
  const amountLabel =
    isProcessing && invoice.amount === 0
      ? "Awaiting OCR"
      : `${invoice.currency} ${invoice.amount.toLocaleString("en-US")}`

  return (
    <article className="rounded-[12px] border border-[#243047] bg-[#172033] p-4 transition hover:border-[#3B82F6]/70 hover:bg-[#1B263C]">
      <InvoiceProcessingTrigger
        invoiceId={invoice.id}
        shouldProcess={shouldProcessInvoice}
        processingStatus={invoice.processingStatus}
        onStarted={() => {
          setLocalProcessingLabel(
            invoice.extractedText ? "Analyzing..." : "Extracting..."
          )
        }}
        onCompleted={(ok) => {
          if (!ok) {
            setLocalProcessingLabel(null)
          }
        }}
      />

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
          {amountLabel}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {processingLabel ? (
          <StatusBadge label={processingLabel} tone="ai" />
        ) : null}
        {!isProcessing ? (
          <>
            <StatusBadge
              label={invoice.riskLevel}
              tone={riskTone[invoice.riskLevel]}
            />
            <StatusBadge
              label={invoice.validationStatus}
              tone={validationTone[invoice.validationStatus]}
            />
          </>
        ) : null}
      </div>

      {isProcessing ? (
        <div className="mt-4 rounded-[10px] border border-[#1D4ED8]/40 bg-[#0F1D3A] p-3">
          <p className="text-[13px] font-medium text-[#BFDBFE]">
            Invoice processing in progress
          </p>
          <p className="mt-2 text-[13px] leading-5 text-[#DBEAFE]">
            {processingDescription}
          </p>
        </div>
      ) : null}

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
        <div>
          <p className="text-[13px] text-[#6B7280]">Submitted Order</p>
          <p className="mt-1 text-[13px] font-medium text-[#E5E7EB]">
            {invoice.orderId
              ? `${invoice.orderId}${invoice.orderStatus ? ` · ${invoice.orderStatus}` : ""}`
              : invoice.workflowId ? "Pending negotiation" : "Not linked (Direct upload)"}
          </p>
        </div>
        <div>
          <p className="text-[13px] text-[#6B7280]">Workflow State</p>
          <p className="mt-1 text-[13px] font-medium text-[#E5E7EB]">
            {invoice.workflowState ?? "Awaiting workflow sync"}
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

      {!isProcessing ? (
        <Button
          asChild
          className="mt-4 h-9 w-full rounded-[10px] bg-[#111827] text-[#E5E7EB] hover:bg-[#243047]"
        >
          <Link
            href={`/invoice-management/${invoice.id}`}
            className="flex items-center justify-center gap-2"
          >
            Open Invoice
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      ) : null}
    </article>
  )
}
