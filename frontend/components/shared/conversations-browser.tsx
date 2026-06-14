"use client"

import Link from "next/link"
import { MessageSquareText } from "lucide-react"
import { useMemo, useState } from "react"

import { EmptyState } from "@/components/shared/empty-state"
import { FilterToolbar } from "@/components/shared/filter-toolbar"
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
import type { Conversation, Invoice, Product, StatusTone, Supplier } from "@/lib/types"

type ConversationsBrowserProps = {
  conversations: Conversation[]
  invoices: Invoice[]
  products: Product[]
  suppliers: Supplier[]
}

type QueueTab = "progress" | "attention" | "invoice" | "completed"

const priorityTone: Record<string, StatusTone> = {
  critical: "danger",
  high: "warning",
  medium: "ai",
  low: "default",
}

function supplierName(suppliers: Supplier[], supplierId: string) {
  return (
    suppliers.find((supplier) => supplier.id === supplierId)?.name ??
    "Unknown supplier"
  )
}

function productLabel(products: Product[], linkedSkus: string[]) {
  const names = linkedSkus
    .map((sku) => products.find((product) => product.sku === sku)?.name ?? sku)
    .filter(Boolean)

  return names.length > 0 ? names.join(", ") : "Unassigned product"
}

function linkedInvoice(invoices: Invoice[], conversation: Conversation) {
  return (
    (conversation.linkedInvoiceId
      ? invoices.find((item) => item.id === conversation.linkedInvoiceId)
      : undefined) ??
    (conversation.workflowId
      ? invoices.find((item) => item.workflowId === conversation.workflowId)
      : undefined) ??
    invoices.find((item) => conversation.linkedSkus.includes(item.productSku))
  )
}

function conversationQueue(
  invoices: Invoice[],
  conversation: Conversation
): QueueTab {
  const invoice = linkedInvoice(invoices, conversation)
  const invoiceComplete =
    invoice?.status === "paid" || invoice?.approvalState === "Completed"

  if (conversation.negotiationState === "Closed" || invoiceComplete) {
    return "completed"
  }

  if (
    conversation.negotiationState === "Accepted" ||
    Boolean(conversation.submittedOrderId)
  ) {
    return "invoice"
  }

  if (
    conversation.negotiationState === "Needs Analysis" ||
    conversation.negotiationState === "Escalated"
  ) {
    return "attention"
  }

  return "progress"
}

function queueLabel(queue: QueueTab) {
  if (queue === "attention") return "Needs Attention"
  if (queue === "invoice") return "Ready for Invoice"
  if (queue === "completed") return "Completed"
  return "In Progress"
}

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  timeZone: "UTC",
})

export function ConversationsBrowser({
  conversations,
  invoices,
  products,
  suppliers,
}: ConversationsBrowserProps) {
  const [query, setQuery] = useState("")

  const sortedConversations = useMemo(
    () =>
      [...conversations].sort(
        (first, second) =>
          new Date(second.lastMessageAt).getTime() -
          new Date(first.lastMessageAt).getTime()
      ),
    [conversations]
  )

  const filteredConversations = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return sortedConversations.filter((conversation) => {
      const haystack = [
        supplierName(suppliers, conversation.supplierId),
        productLabel(products, conversation.linkedSkus),
        conversation.negotiationState,
        conversation.priority,
        conversation.linkedSkus.join(" "),
      ]
        .join(" ")
        .toLowerCase()

      return !keyword || haystack.includes(keyword)
    })
  }, [products, query, sortedConversations, suppliers])

  const queueTabs: Array<{ value: QueueTab; label: string }> = [
    { value: "progress", label: "In Progress" },
    { value: "attention", label: "Needs Attention" },
    { value: "invoice", label: "Ready for Invoice" },
    { value: "completed", label: "Completed" },
  ]

  return (
    <div className="space-y-5">
      <Tabs defaultValue="progress" className="gap-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <TabsList
            variant="line"
            className="w-full justify-start gap-2 overflow-x-auto rounded-2xl border border-[#243047] bg-[#111827] p-2"
          >
            {queueTabs.map((tab) => {
              const count = filteredConversations.filter(
                (conversation) => conversationQueue(invoices, conversation) === tab.value
              ).length
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
              searchPlaceholder="Search suppliers, products, or status..."
              searchValue={query}
              onSearchChange={setQuery}
            />
          </div>
        </div>

        {queueTabs.map((tab) => {
          const queueItems = filteredConversations.filter(
            (conversation) => conversationQueue(invoices, conversation) === tab.value
          )

          return (
            <TabsContent key={tab.value} value={tab.value} className="space-y-4">
              <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
                <CardContent className="flex items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <p className="text-[18px] font-semibold text-[#E5E7EB]">
                      {tab.label}
                    </p>
                    <p className="mt-1 text-[14px] text-[#9CA3AF]">
                      {tab.value === "invoice"
                        ? "Accepted deals waiting for invoice review or settlement."
                        : tab.value === "attention"
                          ? "Conversations that need operator review."
                          : tab.value === "completed"
                            ? "Closed conversations and settled orders."
                            : "Supplier conversations that are still moving."}
                    </p>
                  </div>
                  <StatusBadge
                    label={`${queueItems.length} item${queueItems.length === 1 ? "" : "s"}`}
                    tone={tab.value === "attention" ? "warning" : tab.value === "invoice" ? "success" : "default"}
                  />
                </CardContent>
              </Card>

              <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#243047] hover:bg-transparent">
                        <TableHead className="px-5 text-[12px] text-[#9CA3AF]">
                          Supplier
                        </TableHead>
                        <TableHead className="text-[12px] text-[#9CA3AF]">
                          Product
                        </TableHead>
                        <TableHead className="text-[12px] text-[#9CA3AF]">
                          Status
                        </TableHead>
                        <TableHead className="text-[12px] text-[#9CA3AF]">
                          Last Updated
                        </TableHead>
                        <TableHead className="text-[12px] text-[#9CA3AF]">
                          Priority
                        </TableHead>
                        <TableHead className="text-right text-[12px] text-[#9CA3AF]">
                          Action
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {queueItems.map((conversation) => (
                        <TableRow
                          key={conversation.id}
                          className="border-[#243047] hover:bg-[#172033]/70"
                        >
                          <TableCell className="px-5 py-4 text-[15px] font-medium text-[#E5E7EB]">
                            {supplierName(suppliers, conversation.supplierId)}
                          </TableCell>
                          <TableCell className="py-4 text-[14px] text-[#9CA3AF]">
                            {productLabel(products, conversation.linkedSkus)}
                          </TableCell>
                          <TableCell className="py-4">
                            <StatusBadge
                              label={queueLabel(conversationQueue(invoices, conversation))}
                              tone={
                                conversationQueue(invoices, conversation) === "attention"
                                  ? "warning"
                                  : conversationQueue(invoices, conversation) === "invoice"
                                    ? "success"
                                    : "default"
                              }
                            />
                          </TableCell>
                          <TableCell className="py-4 text-[13px] text-[#9CA3AF]">
                            {dateFormatter.format(new Date(conversation.lastMessageAt))}
                          </TableCell>
                          <TableCell className="py-4">
                            <StatusBadge
                              label={conversation.priority}
                              tone={priorityTone[conversation.priority]}
                            />
                          </TableCell>
                          <TableCell className="py-4 text-right">
                            <Button
                              asChild
                              variant="outline"
                              className="h-8 rounded-[10px] border-[#243047] bg-[#172033] text-[#E5E7EB] hover:bg-[#243047]"
                            >
                              <Link href={`/conversations/${conversation.id}`}>Open</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {queueItems.length === 0 ? (
                        <TableRow className="border-[#243047] hover:bg-transparent">
                          <TableCell colSpan={6} className="px-5 py-10">
                            <EmptyState
                              icon={MessageSquareText}
                              title="No conversations here"
                              description="This tab is clear with the current search."
                              compact
                            />
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
    </div>
  )
}
