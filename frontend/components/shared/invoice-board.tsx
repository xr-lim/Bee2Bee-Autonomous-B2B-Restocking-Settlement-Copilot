"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { useMemo, useState } from "react"

import { FilterToolbar } from "@/components/shared/filter-toolbar"
import { InvoiceProcessingTrigger } from "@/components/shared/invoice-ai-analysis-trigger"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Invoice, StatusTone, Supplier } from "@/lib/types"

type InvoiceBoardProps = {
  invoices: Invoice[]
  suppliers: Supplier[]
}

type InvoiceTab = "ready" | "review" | "issue" | "completed"

const riskTone: Record<Invoice["riskLevel"], StatusTone> = {
  "Low Risk": "success",
  "Medium Risk": "warning",
  "High Risk": "danger",
}

function supplierName(suppliers: Supplier[], supplierId: string) {
  return (
    suppliers.find((supplier) => supplier.id === supplierId)?.name ??
    "Unknown supplier"
  )
}

function invoiceTab(invoice: Invoice): InvoiceTab {
  if (invoice.approvalState === "Completed") return "completed"
  if (invoice.approvalState === "Blocked") return "issue"
  if (invoice.approvalState === "Needs Review") return "review"
  return "ready"
}

function invoiceStatusLabel(invoice: Invoice) {
  if (invoice.approvalState === "Blocked") return "Issue Found"
  if (invoice.approvalState === "Needs Review") return "Needs Review"
  if (invoice.approvalState === "Completed") return "Completed"
  return "Ready for Approval"
}

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  timeZone: "UTC",
})

export function InvoiceBoard({ invoices, suppliers }: InvoiceBoardProps) {
  const [query, setQuery] = useState("")
  const [riskFilter, setRiskFilter] = useState("all")

  const filteredInvoices = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return invoices.filter((invoice) => {
      const haystack = [
        invoice.invoiceNumber,
        invoice.currency,
        invoice.amount.toString(),
        invoice.linkedSkus.join(" "),
        supplierName(suppliers, invoice.supplierId),
        invoiceStatusLabel(invoice),
      ]
        .join(" ")
        .toLowerCase()

      const matchesSearch = !keyword || haystack.includes(keyword)
      const matchesRisk = riskFilter === "all" || invoice.riskLevel === riskFilter
      return matchesSearch && matchesRisk
    })
  }, [invoices, query, riskFilter, suppliers])

  const tabs: Array<{ value: InvoiceTab; label: string }> = [
    { value: "ready", label: "Ready for Approval" },
    { value: "review", label: "Needs Review" },
    { value: "issue", label: "Issue Found" },
    { value: "completed", label: "Completed" },
  ]

  return (
    <Tabs defaultValue="ready" className="gap-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <TabsList
          variant="line"
          className="w-full justify-start gap-2 overflow-x-auto rounded-2xl border border-[#243047] bg-[#111827] p-2"
        >
          {tabs.map((tab) => {
            const count = filteredInvoices.filter((invoice) => invoiceTab(invoice) === tab.value)
              .length
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-xl px-4 py-2 text-[#94A3B8] data-active:bg-[#172033] data-active:text-[#F8FAFC]"
              >
                {tab.label} ({count})
              </TabsTrigger>
            )
          })}
        </TabsList>

        <div className="xl:min-w-[360px]">
          <FilterToolbar
            searchPlaceholder="Search invoices, suppliers, or SKU..."
            searchValue={query}
            onSearchChange={setQuery}
            filterLabel="Risk"
            filterValue={riskFilter}
            onFilterChange={setRiskFilter}
            filterOptions={[
              { label: "All risk levels", value: "all" },
              { label: "Low risk", value: "Low Risk" },
              { label: "Medium risk", value: "Medium Risk" },
              { label: "High risk", value: "High Risk" },
            ]}
          />
        </div>
      </div>

      {tabs.map((tab) => {
        const invoicesByTab = filteredInvoices.filter(
          (invoice) => invoiceTab(invoice) === tab.value
        )

        return (
          <TabsContent key={tab.value} value={tab.value}>
            <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#243047] hover:bg-transparent">
                      <TableHead className="px-5 text-[12px] text-[#9CA3AF]">
                        Supplier
                      </TableHead>
                      <TableHead className="text-[12px] text-[#9CA3AF]">
                        Invoice
                      </TableHead>
                      <TableHead className="text-[12px] text-[#9CA3AF]">
                        Amount
                      </TableHead>
                      <TableHead className="text-[12px] text-[#9CA3AF]">
                        Status
                      </TableHead>
                      <TableHead className="text-[12px] text-[#9CA3AF]">
                        Risk
                      </TableHead>
                      <TableHead className="text-[12px] text-[#9CA3AF]">
                        Updated
                      </TableHead>
                      <TableHead className="text-right text-[12px] text-[#9CA3AF]">
                        Action
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoicesByTab.map((invoice) => (
                      <InvoiceRow key={invoice.id} invoice={invoice} suppliers={suppliers} />
                    ))}
                    {invoicesByTab.length === 0 ? (
                      <TableRow className="border-[#243047] hover:bg-transparent">
                        <TableCell
                          colSpan={7}
                          className="px-5 py-10 text-center text-[14px] text-[#9CA3AF]"
                        >
                          No invoices in this view.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )
      })}
    </Tabs>
  )
}

function InvoiceRow({
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
    <TableRow className="border-[#243047] hover:bg-[#172033]/70">
      <TableCell className="px-5 py-4">
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
        <p className="text-[15px] font-medium text-[#E5E7EB]">
          {supplierName(suppliers, invoice.supplierId)}
        </p>
        <p className="mt-1 text-[12px] text-[#6B7280]">
          {invoice.linkedSkus[0] ?? "Direct upload"}
        </p>
      </TableCell>
      <TableCell className="py-4">
        <p className="text-[14px] font-medium text-[#E5E7EB]">{invoice.invoiceNumber}</p>
        <p className="mt-1 text-[12px] text-[#6B7280]">{invoice.fileName}</p>
      </TableCell>
      <TableCell className="py-4 text-[14px] font-medium text-[#E5E7EB]">
        {invoice.currency} {invoice.amount.toLocaleString("en-US")}
      </TableCell>
      <TableCell className="py-4">
        <StatusBadge
          label={processingLabel ?? invoiceStatusLabel(invoice)}
          tone={processingLabel ? "ai" : invoice.approvalState === "Blocked" ? "danger" : invoice.approvalState === "Needs Review" ? "warning" : invoice.approvalState === "Completed" ? "success" : "ai"}
        />
      </TableCell>
      <TableCell className="py-4">
        <StatusBadge label={invoice.riskLevel} tone={riskTone[invoice.riskLevel]} />
      </TableCell>
      <TableCell className="py-4 text-[13px] text-[#9CA3AF]">
        {dateFormatter.format(new Date(invoice.lastUpdated))}
      </TableCell>
      <TableCell className="py-4 text-right">
        <Button
          asChild
          variant="outline"
          className="h-8 rounded-[10px] border-[#243047] bg-[#172033] text-[#E5E7EB] hover:bg-[#243047]"
        >
          <Link href={`/invoice-management/${invoice.id}`} className="inline-flex items-center gap-2">
            Open
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  )
}
