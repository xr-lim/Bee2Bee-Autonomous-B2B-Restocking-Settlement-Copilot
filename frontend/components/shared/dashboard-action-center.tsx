"use client"

import Link from "next/link"
import { ChevronDown, PackagePlus, ReceiptText } from "lucide-react"
import { useState } from "react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { Invoice, RestockRecommendation, Supplier, StatusTone } from "@/lib/types"
import { cn } from "@/lib/utils"

type ActionPanel = "restock" | "invoice"

const approvalTone: Record<Invoice["approvalState"], StatusTone> = {
  "Waiting Approval": "ai",
  "Needs Review": "warning",
  Blocked: "danger",
  Completed: "success",
}

const riskTone: Record<Invoice["riskLevel"], StatusTone> = {
  "Low Risk": "success",
  "Medium Risk": "warning",
  "High Risk": "danger",
}

export function DashboardActionCenter({
  invoices,
  restockRecommendations,
  suppliers,
}: {
  invoices: Invoice[]
  restockRecommendations: RestockRecommendation[]
  suppliers: Supplier[]
}) {
  const [activePanel, setActivePanel] = useState<ActionPanel | null>(null)
  const invoiceItems = invoices.filter((invoice) =>
    ["Waiting Approval", "Needs Review", "Blocked"].includes(
      invoice.approvalState
    )
  )
  const totalRestockQuantity = restockRecommendations.reduce(
    (total, item) => total + item.quantity,
    0
  )
  const actionInvoiceCount = invoiceItems.length

  function supplierName(supplierId: string) {
    return (
      suppliers.find((supplier) => supplier.id === supplierId)?.name ??
      "Unknown supplier"
    )
  }

  function togglePanel(panel: ActionPanel) {
    setActivePanel((current) => (current === panel ? null : panel))
  }

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => togglePanel("restock")}
          className={cn(
            "group rounded-[14px] border border-[#243047] bg-[#111827] p-4 text-left transition hover:border-[#8B5CF6]/70 hover:bg-[#172033]",
            activePanel === "restock" && "border-[#8B5CF6]/70 bg-[#172033]"
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-[10px] bg-[#8B5CF6]/10 text-[#C4B5FD]">
                <PackagePlus className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[12px] font-medium uppercase tracking-wider text-[#8B5CF6]">
                  Restock Action
                </p>
                <h2 className="mt-1 text-[16px] font-semibold text-[#E5E7EB]">
                  {restockRecommendations.length} SKUs need restock
                </h2>
                <p className="mt-1 text-[12px] text-[#9CA3AF]">
                  Suggested quantity: {totalRestockQuantity.toLocaleString("en-US")} units
                </p>
              </div>
            </div>
            <ChevronDown
              className={cn(
                "size-5 text-[#6B7280] transition group-hover:text-[#C4B5FD]",
                activePanel === "restock" && "rotate-180 text-[#C4B5FD]"
              )}
              aria-hidden="true"
            />
          </div>
        </button>

        <button
          type="button"
          onClick={() => togglePanel("invoice")}
          className={cn(
            "group rounded-[14px] border border-[#243047] bg-[#111827] p-4 text-left transition hover:border-[#3B82F6]/70 hover:bg-[#172033]",
            activePanel === "invoice" && "border-[#3B82F6]/70 bg-[#172033]"
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-[10px] bg-[#3B82F6]/10 text-[#93C5FD]">
                <ReceiptText className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[12px] font-medium uppercase tracking-wider text-[#3B82F6]">
                  Invoice Follow-up
                </p>
                <h2 className="mt-1 text-[16px] font-semibold text-[#E5E7EB]">
                  {actionInvoiceCount} invoices need action
                </h2>
                <p className="mt-1 text-[12px] text-[#9CA3AF]">
                  Waiting approval, review, and blocked invoices only.
                </p>
              </div>
            </div>
            <ChevronDown
              className={cn(
                "size-5 text-[#6B7280] transition group-hover:text-[#93C5FD]",
                activePanel === "invoice" && "rotate-180 text-[#93C5FD]"
              )}
              aria-hidden="true"
            />
          </div>
        </button>
      </div>

      {activePanel === "restock" ? (
        <RestockList restockRecommendations={restockRecommendations} />
      ) : null}
      {activePanel === "invoice" ? (
        <InvoiceList invoiceItems={invoiceItems} supplierName={supplierName} />
      ) : null}
    </section>
  )
}

function RestockList({
  restockRecommendations,
}: {
  restockRecommendations: RestockRecommendation[]
}) {
  return (
    <Card className="rounded-[14px] border border-[#8B5CF6]/35 bg-[#111827] py-0 shadow-none ring-0">
      <CardContent className="p-4">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-[16px] font-semibold text-[#E5E7EB]">
              Restock Recommendations
            </h3>
            <p className="mt-1 text-[12px] text-[#9CA3AF]">
              Expand only when you want to review product-level action details.
            </p>
          </div>
          <StatusBadge label="Z.AI ready" tone="ai" />
        </div>
        <div className="grid gap-3">
          {restockRecommendations.map((item) => (
            <article
              key={item.id}
              className="grid grid-cols-[1.2fr_120px_160px_160px_190px] items-center gap-3 rounded-[12px] border border-[#243047] bg-[#172033] p-3"
            >
              <div>
                <p className="text-[14px] font-semibold text-[#E5E7EB]">
                  {item.productName}
                </p>
                <p className="mt-1 text-[12px] text-[#9CA3AF]">
                  {item.sku} / {item.supplier}
                </p>
              </div>
              <Metric label="Stock" value={item.currentStock.toString()} />
              <Metric label="Quantity" value={item.quantity.toLocaleString("en-US")} />
              <Metric label="Target Price" value={item.targetPrice} />
              <div className="flex justify-end gap-2">
                <Button
                  asChild
                  className="h-9 rounded-[10px] bg-[#3B82F6] px-3 text-white hover:bg-[#2563EB]"
                >
                  <Link href={`/inventory/${item.sku}`}>
                    Review & restock
                  </Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function InvoiceList({
  invoiceItems,
  supplierName,
}: {
  invoiceItems: Invoice[]
  supplierName: (supplierId: string) => string
}) {
  return (
    <Card className="rounded-[14px] border border-[#3B82F6]/35 bg-[#111827] py-0 shadow-none ring-0">
      <CardContent className="p-4">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-[16px] font-semibold text-[#E5E7EB]">
              Invoice Visibility
            </h3>
            <p className="mt-1 text-[12px] text-[#9CA3AF]">
              Review only invoices that need a merchant or finance decision.
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            className="h-9 rounded-[10px] border-[#243047] bg-[#172033] px-3 text-[#E5E7EB] hover:bg-[#243047]"
          >
            <Link href="/invoice-management">Active invoices</Link>
          </Button>
        </div>
        <div className="grid gap-3">
          {invoiceItems.map((invoice) => (
            <article
              key={invoice.id}
              className="grid grid-cols-[160px_1fr_160px_170px_120px] items-center gap-3 rounded-[12px] border border-[#243047] bg-[#172033] p-3"
            >
              <div>
                <p className="text-[14px] font-semibold text-[#E5E7EB]">
                  {invoice.id}
                </p>
                <p className="mt-1 text-[12px] text-[#9CA3AF]">
                  {invoice.workflowId}
                </p>
              </div>
              <div>
                <p className="text-[14px] font-medium text-[#E5E7EB]">
                  {supplierName(invoice.supplierId)}
                </p>
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
              <Metric
                label="Amount"
                value={`${invoice.currency} ${invoice.amount.toLocaleString("en-US")}`}
              />
              <div className="flex flex-wrap gap-1.5">
                <StatusBadge
                  label={invoice.approvalState}
                  tone={approvalTone[invoice.approvalState]}
                />
                <StatusBadge
                  label={invoice.riskLevel}
                  tone={riskTone[invoice.riskLevel]}
                />
              </div>
              <Button
                asChild
                className="h-9 rounded-[10px] bg-[#111827] px-3 text-[#E5E7EB] hover:bg-[#243047]"
              >
                <Link href={`/invoice-management/${invoice.id}`}>Open</Link>
              </Button>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] text-[#6B7280]">{label}</p>
      <p className="mt-1 truncate text-[14px] font-semibold text-[#E5E7EB]">
        {value}
      </p>
    </div>
  )
}
