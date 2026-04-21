import Link from "next/link"
import { Inbox } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
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
import { displayConversationSource } from "@/lib/conversation-source"
import {
  getConversations,
  getInvoices,
  getProducts,
  getSuppliers,
} from "@/lib/data"
import type {
  Conversation,
  Invoice,
  NegotiationState,
  Product,
  StatusTone,
  Supplier,
} from "@/lib/types"

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

function supplierName(suppliers: Supplier[], supplierId: string) {
  return (
    suppliers.find((supplier) => supplier.id === supplierId)?.name ??
    "Unknown supplier"
  )
}

function productName(products: Product[], sku: string) {
  return products.find((product) => product.sku === sku)?.name ?? sku
}

function linkedInvoiceStatus(invoices: Invoice[], conversation: Conversation) {
  const invoice = invoices.find((item) =>
    conversation.linkedSkus.includes(item.productSku)
  )

  return invoice?.status ?? "pending"
}

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  timeZone: "UTC",
})

export default async function ConversationsPage() {
  const [conversations, invoices, products, suppliers] = await Promise.all([
    getConversations(),
    getInvoices(),
    getProducts(),
    getSuppliers(),
  ])

  const sortedConversations = [...conversations].sort(
    (first, second) =>
      new Date(second.lastMessageAt).getTime() -
      new Date(first.lastMessageAt).getTime()
  )

  const statusGroups = [
    {
      title: "On Progress",
      description:
        "Z.AI is actively negotiating or waiting on supplier response.",
      tone: "ai" as StatusTone,
      match: (conversation: Conversation) =>
        ["Counter Offer Suggested", "Waiting Reply", "New Input"].includes(
          conversation.negotiationState
        ),
    },
    {
      title: "Need Review",
      description:
        "Messy input, missing fields, or escalation needs operator attention.",
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
    <>
      <PageHeader
        eyebrow="Supplier desk"
        title="Conversations"
        description="Track Z.AI supplier negotiation progress, linked SKUs, and invoice follow-up."
      />

      <section className="grid grid-cols-4 gap-4">
        {statusGroups.map((group) => {
          const conversations = sortedConversations.filter(group.match)

          return (
            <Card
              key={group.title}
              className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0"
            >
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
                  <StatusBadge label={`${conversations.length}`} tone={group.tone} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-4">
                {conversations.length > 0 ? (
                  conversations.map((conversation) => (
                    <ConversationMiniCard
                      key={conversation.id}
                      conversation={conversation}
                    />
                  ))
                ) : (
                  <EmptyState
                    icon={Inbox}
                    title="No conversations"
                    description="This queue is clear right now."
                    tone={group.tone}
                    compact
                  />
                )}
              </CardContent>
            </Card>
          )
        })}
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[22px] font-semibold text-[#E5E7EB]">
              All Conversations
            </h2>
            <p className="mt-1 text-[15px] text-[#9CA3AF]">
              Default sorted by latest update. Use search and filters to narrow by
              supplier, SKU, state, or source.
            </p>
          </div>
        </div>

        <FilterToolbar searchPlaceholder="Search conversations, suppliers, SKU, source, or state..." />

        <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-[#243047] hover:bg-transparent">
                  <TableHead className="px-4 text-[13px] text-[#9CA3AF]">
                    Conversation ID
                  </TableHead>
                  <TableHead className="text-[13px] text-[#9CA3AF]">
                    Supplier
                  </TableHead>
                  <TableHead className="text-[13px] text-[#9CA3AF]">
                    Linked SKU(s)
                  </TableHead>
                  <TableHead className="text-[13px] text-[#9CA3AF]">
                    Product
                  </TableHead>
                  <TableHead className="text-[13px] text-[#9CA3AF]">
                    Source
                  </TableHead>
                  <TableHead className="text-[13px] text-[#9CA3AF]">
                    Latest Message
                  </TableHead>
                  <TableHead className="text-[13px] text-[#9CA3AF]">
                    Status
                  </TableHead>
                  <TableHead className="text-[13px] text-[#9CA3AF]">
                    Last Updated
                  </TableHead>
                  <TableHead className="text-[13px] text-[#9CA3AF]">
                    Priority
                  </TableHead>
                  <TableHead className="text-[13px] text-[#9CA3AF]">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedConversations.map((conversation) => (
                  <TableRow
                    key={conversation.id}
                    className="border-[#243047] hover:bg-[#172033]/70"
                  >
                    <TableCell className="px-4 text-[13px] font-medium text-[#E5E7EB]">
                      {conversation.id}
                    </TableCell>
                    <TableCell className="text-[15px] text-[#E5E7EB]">
                      {supplierName(suppliers, conversation.supplierId)}
                    </TableCell>
                    <TableCell>
                      <SkuLinks skus={conversation.linkedSkus} />
                    </TableCell>
                    <TableCell className="max-w-[220px] whitespace-normal text-[15px] leading-5 text-[#9CA3AF]">
                      {conversation.linkedSkus
                        .map((sku) => productName(products, sku))
                        .join(", ")}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={displayConversationSource(conversation.source)}
                        tone="ai"
                      />
                    </TableCell>
                    <TableCell className="max-w-[300px] whitespace-normal text-[15px] leading-5 text-[#9CA3AF]">
                      {conversation.latestMessage}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={statusLabel(invoices, conversation)}
                        tone={stateTone[conversation.negotiationState]}
                      />
                    </TableCell>
                    <TableCell className="text-[13px] text-[#9CA3AF]">
                      {dateFormatter.format(new Date(conversation.lastMessageAt))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={conversation.priority}
                        tone={priorityTone[conversation.priority]}
                      />
                    </TableCell>
                    <TableCell>
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
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </>
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
      <div className="mt-3">
        <SkuChips skus={conversation.linkedSkus} />
      </div>
    </Link>
  )
}

function SkuChips({ skus }: { skus: string[] }) {
  return (
    <div className="flex max-w-[240px] flex-wrap gap-1.5">
      {skus.map((sku) => (
        <StatusBadge key={sku} label={sku} tone="default" />
      ))}
    </div>
  )
}

function SkuLinks({ skus }: { skus: string[] }) {
  return (
    <div className="flex max-w-[240px] flex-wrap gap-1.5">
      {skus.map((sku) => (
        <Link key={sku} href={`/inventory/${sku}`}>
          <StatusBadge label={sku} tone="default" className="hover:border-[#3B82F6] hover:text-[#93C5FD]" />
        </Link>
      ))}
    </div>
  )
}

function statusLabel(invoices: Invoice[], conversation: Conversation) {
  if (
    conversation.negotiationState === "Accepted" &&
    linkedInvoiceStatus(invoices, conversation) !== "paid"
  ) {
    return "Accepted, invoice need to approve"
  }

  if (conversation.negotiationState === "Closed") {
    return "Completed"
  }

  return conversation.negotiationState
}
