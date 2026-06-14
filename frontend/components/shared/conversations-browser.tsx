"use client"

import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Inbox } from "lucide-react"
import { useMemo, useState } from "react"

import { EmptyState } from "@/components/shared/empty-state"
import { FilterToolbar } from "@/components/shared/filter-toolbar"
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
import type {
  Conversation,
  Invoice,
  NegotiationState,
  Product,
  StatusTone,
  Supplier,
} from "@/lib/types"

type ConversationsBrowserProps = {
  conversations: Conversation[]
  invoices: Invoice[]
  products: Product[]
  suppliers: Supplier[]
}

const priorityTone: Record<string, StatusTone> = {
  critical: "danger",
  high: "warning",
  medium: "ai",
  low: "default",
}

const stateTone: Record<NegotiationState, StatusTone> = {
  "New Input": "default",
  "Needs Analysis": "warning",
  "Counter Offer Suggested": "ai",
  "Waiting Reply": "default",
  Accepted: "success",
  Escalated: "danger",
  Closed: "success",
}

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

function productLabel(products: Product[], linkedSkus: string[]) {
  const names = linkedSkus
    .map((sku) => products.find((product) => product.sku === sku)?.name ?? sku)
    .filter(Boolean)

  return names.length > 0 ? names.join(", ") : "Unassigned product"
}

function linkedInvoiceStatus(invoices: Invoice[], conversation: Conversation) {
  const invoice =
    (conversation.linkedInvoiceId
      ? invoices.find((item) => item.id === conversation.linkedInvoiceId)
      : undefined) ??
    (conversation.workflowId
      ? invoices.find((item) => item.workflowId === conversation.workflowId)
      : undefined) ??
    invoices.find((item) => conversation.linkedSkus.includes(item.productSku))

  return invoice?.status ?? "pending"
}

function statusLabel(invoices: Invoice[], conversation: Conversation) {
  if (
    conversation.negotiationState === "Accepted" &&
    linkedInvoiceStatus(invoices, conversation) !== "paid"
  ) {
    return "Ready for Invoice"
  }

  if (conversation.negotiationState === "Closed") {
    return "Completed"
  }

  return conversation.negotiationState
}

export function ConversationsBrowser({
  conversations,
  invoices,
  products,
  suppliers,
}: ConversationsBrowserProps) {
  const reduceMotion = useReducedMotion()
  const [query, setQuery] = useState("")
  const [stateFilter, setStateFilter] = useState("all")

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

      const matchesSearch = !keyword || haystack.includes(keyword)
      const matchesState =
        stateFilter === "all" || conversation.negotiationState === stateFilter
      return matchesSearch && matchesState
    })
  }, [products, query, sortedConversations, stateFilter, suppliers])

  const statusGroups = [
    {
      title: "On Progress",
      description: "AI is actively negotiating or waiting on supplier response.",
      tone: "ai" as StatusTone,
      match: (conversation: Conversation) =>
        ["Counter Offer Suggested", "Waiting Reply", "New Input"].includes(
          conversation.negotiationState
        ),
    },
    {
      title: "Need Review",
      description: "Messy input, missing fields, or escalation needs operator attention.",
      tone: "warning" as StatusTone,
      match: (conversation: Conversation) =>
        ["Needs Analysis", "Escalated"].includes(conversation.negotiationState),
    },
    {
      title: "Accepted, Invoice Need To Approve",
      description: "Supplier terms accepted and invoice approval is still pending.",
      tone: "success" as StatusTone,
      match: (conversation: Conversation) =>
        conversation.negotiationState === "Accepted" &&
        linkedInvoiceStatus(invoices, conversation) !== "paid",
    },
    {
      title: "Completed",
      description: "Negotiation and invoice follow-up are closed.",
      tone: "default" as StatusTone,
      match: (conversation: Conversation) =>
        conversation.negotiationState === "Closed" ||
        linkedInvoiceStatus(invoices, conversation) === "paid",
    },
  ]

  return (
    <div className="space-y-6">
      <FilterToolbar
        searchPlaceholder="Search suppliers, products, SKU, or status..."
        searchValue={query}
        onSearchChange={setQuery}
        filterLabel="Conversation state"
        filterValue={stateFilter}
        onFilterChange={setStateFilter}
        filterOptions={[
          { label: "All states", value: "all" },
          { label: "New Input", value: "New Input" },
          { label: "Needs Analysis", value: "Needs Analysis" },
          { label: "Counter Offer", value: "Counter Offer Suggested" },
          { label: "Waiting Reply", value: "Waiting Reply" },
          { label: "Accepted", value: "Accepted" },
          { label: "Escalated", value: "Escalated" },
          { label: "Closed", value: "Closed" },
        ]}
      />

      <section className="grid gap-4 xl:grid-cols-4">
        {statusGroups.map((group, index) => {
          const groupedConversations = filteredConversations.filter(group.match)

          return (
            <motion.div
              key={group.title}
              initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{
                duration: reduceMotion ? 0 : 0.22,
                delay: reduceMotion ? 0 : index * 0.04,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <Card className="h-full rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
                <CardHeader className="border-b border-[#243047] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-[18px] font-semibold text-[#E5E7EB]">
                        {group.title}
                      </CardTitle>
                      <p className="mt-1 text-[13px] leading-5 text-[#9CA3AF]">
                        {group.description}
                      </p>
                    </div>
                    <StatusBadge
                      label={`${groupedConversations.length}`}
                      tone={group.tone}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {groupedConversations.length > 0 ? (
                      groupedConversations.map((conversation, cardIndex) => (
                        <motion.div
                          key={conversation.id}
                          layout
                          initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
                          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                          exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                          transition={{
                            duration: reduceMotion ? 0 : 0.18,
                            delay: reduceMotion ? 0 : cardIndex * 0.02,
                          }}
                        >
                          <ConversationMiniCard conversation={conversation} />
                        </motion.div>
                      ))
                    ) : (
                      <motion.div
                        key={`${group.title}-empty`}
                        initial={reduceMotion ? undefined : { opacity: 0 }}
                        animate={reduceMotion ? undefined : { opacity: 1 }}
                        exit={reduceMotion ? undefined : { opacity: 0 }}
                      >
                        <EmptyState
                          icon={Inbox}
                          title="No conversations"
                          description="This queue is clear with the current filters."
                          tone={group.tone}
                          compact
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-[20px] font-semibold text-[#E5E7EB]">
            All Conversations
          </h2>
          <p className="mt-1 text-[14px] text-[#9CA3AF]">
            Showing {filteredConversations.length} of {conversations.length} conversations.
          </p>
        </div>

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
                {filteredConversations.map((conversation) => (
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
                        label={statusLabel(invoices, conversation)}
                        tone={stateTone[conversation.negotiationState]}
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
                {filteredConversations.length === 0 ? (
                  <TableRow className="border-[#243047] hover:bg-transparent">
                    <TableCell
                      colSpan={6}
                      className="px-5 py-10 text-center text-[14px] text-[#9CA3AF]"
                    >
                      No conversations match the current search and filter.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function ConversationMiniCard({ conversation }: { conversation: Conversation }) {
  return (
    <Link
      href={`/conversations/${conversation.id}`}
      className="block rounded-[10px] border border-[#243047] bg-[#172033] p-3 transition-colors hover:border-[#3B82F6] hover:bg-[#1B263A]"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-[14px] font-semibold text-[#E5E7EB]">
          {conversation.id}
        </span>
        <StatusBadge
          label={conversation.priority}
          tone={priorityTone[conversation.priority]}
        />
      </div>
      <p className="line-clamp-2 text-[13px] leading-5 text-[#9CA3AF]">
        {conversation.subject}
      </p>
      <div className="mt-3 flex max-w-[240px] flex-wrap gap-1.5">
        {conversation.linkedSkus.map((sku) => (
          <StatusBadge key={sku} label={sku} tone="default" />
        ))}
      </div>
    </Link>
  )
}
