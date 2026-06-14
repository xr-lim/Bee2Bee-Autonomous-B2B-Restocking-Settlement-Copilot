"use client"

import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowRight, Inbox } from "lucide-react"
import { useMemo, useState } from "react"

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
  const reduceMotion = useReducedMotion()
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
    <div className="space-y-4">
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

      <section className="grid gap-4 xl:grid-cols-3">
        {approvalLanes.map((lane, index) => {
          const invoicesByLane = filteredInvoices.filter(
            (invoice) => invoice.approvalState === lane.state
          )

          return (
            <motion.div
              key={lane.state}
              initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{
                duration: reduceMotion ? 0 : 0.22,
                delay: reduceMotion ? 0 : index * 0.05,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <Card
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
                    <AnimatePresence mode="popLayout" initial={false}>
                      {invoicesByLane.length > 0 ? (
                        invoicesByLane.map((invoice, cardIndex) => (
                          <motion.div
                            key={invoice.id}
                            layout
                            initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
                            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                            exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                            transition={{
                              duration: reduceMotion ? 0 : 0.18,
                              delay: reduceMotion ? 0 : cardIndex * 0.02,
                            }}
                          >
                            <InvoiceWorkCard invoice={invoice} suppliers={suppliers} />
                          </motion.div>
                        ))
                      ) : (
                        <motion.div
                          key={`${lane.state}-empty`}
                          initial={reduceMotion ? undefined : { opacity: 0 }}
                          animate={reduceMotion ? undefined : { opacity: 1 }}
                          exit={reduceMotion ? undefined : { opacity: 0 }}
                        >
                          <EmptyState
                            icon={Inbox}
                            title="No invoices"
                            description="This queue is clear with the current filters."
                            compact
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </section>
    </div>
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

  const processingLabel =
    invoice.processingStatus === "extracting"
      ? "Preparing"
      : invoice.processingStatus === "analyzing"
        ? "Checking"
        : invoice.aiLastAnalyzedAt
          ? null
          : localProcessingLabel

  return (
    <article className="rounded-[12px] border border-[#243047] bg-[#172033] p-4 transition hover:border-[#3B82F6]/70 hover:bg-[#1B263C]">
      <InvoiceProcessingTrigger
        invoiceId={invoice.id}
        shouldProcess={shouldProcessInvoice}
        processingStatus={invoice.processingStatus}
        onStarted={() => {
          setLocalProcessingLabel(invoice.extractedText ? "Checking" : "Preparing")
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
          {invoice.currency} {invoice.amount.toLocaleString("en-US")}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <StatusBadge
          label={processingLabel ?? invoice.riskLevel}
          tone={processingLabel ? "ai" : riskTone[invoice.riskLevel]}
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
