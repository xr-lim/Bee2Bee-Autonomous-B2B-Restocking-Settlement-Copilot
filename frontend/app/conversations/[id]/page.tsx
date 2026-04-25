import Link from "next/link"
import { AlertTriangle, CircleStop } from "lucide-react"
import { notFound } from "next/navigation"

import { PageHeader } from "@/components/layout/page-header"
import { ConversationWorkspace } from "@/components/shared/conversation-workspace"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  getConversations,
  getInvoices,
  getProducts,
  getSuppliers,
} from "@/lib/data"
import type { Conversation, Invoice, Product } from "@/lib/types"

export const dynamic = "force-dynamic"

export async function generateStaticParams() {
  const conversations = await getConversations()
  return conversations.map((conversation) => ({ id: conversation.id }))
}

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [conversations, invoices, products, suppliers] = await Promise.all([
    getConversations(),
    getInvoices(),
    getProducts(),
    getSuppliers(),
  ])

  const conversation = conversations.find((item) => item.id === id)

  if (!conversation) {
    notFound()
  }

  const supplier = suppliers.find(
    (item) => item.id === conversation.supplierId
  )
  const linkedProducts = conversation.linkedSkus
    .map((sku) => products.find((product) => product.sku === sku))
    .filter((product): product is Product => Boolean(product))
  const linkedInvoice = invoices.find((invoice) =>
    conversation.linkedSkus.includes(invoice.productSku)
  )
  const invoicesById: Record<string, Invoice> = Object.fromEntries(
    invoices.map((invoice) => [invoice.id, invoice])
  )
  const priorityReasons =
    conversation.priority === "critical" || conversation.priority === "high"
      ? buildPriorityReasons(conversation, linkedProducts, linkedInvoice)
      : []

  return (
    <>
      <PageHeader
        eyebrow="Conversation workspace"
        title={conversation.subject}
        description={`${conversation.id} / ${supplier?.name ?? "Unknown supplier"}`}
        actions={
          <>
            <Button
              type="button"
              className="h-10 rounded-[10px] bg-[#EF4444] px-4 text-white hover:bg-[#DC2626]"
            >
              <CircleStop className="size-4" aria-hidden="true" />
              Stop Z.AI
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-10 rounded-[10px] border-[#243047] bg-[#172033] px-4 text-[#E5E7EB] hover:bg-[#243047]"
            >
              <Link href="/conversations">Back to conversations</Link>
            </Button>
          </>
        }
      />

      {priorityReasons.length > 0 ? (
        <PriorityBrief
          priority={conversation.priority as "critical" | "high"}
          reasons={priorityReasons}
        />
      ) : null}

      <ConversationWorkspace
        conversation={conversation}
        supplier={supplier}
        linkedProducts={linkedProducts}
        invoicesById={invoicesById}
        linkedInvoice={linkedInvoice}
      />
    </>
  )
}

function buildPriorityReasons(
  conversation: Conversation,
  products: Product[],
  invoice?: Invoice
): string[] {
  const reasons: string[] = []

  products.forEach((product) => {
    const deficit = product.stockOnHand - product.currentThreshold
    if (deficit < 0) {
      reasons.push(
        `${product.name} stock ${Math.abs(deficit)} units below current threshold (${product.stockOnHand}/${product.currentThreshold})`
      )
    }
  })

  if (conversation.negotiationState === "Escalated") {
    reasons.push("Negotiation escalated — merchant decision required")
  }

  const priceMatch = conversation.aiExtraction.extractedPrice.match(
    /\$(\d+(?:\.\d+)?)/
  )
  const rangeMatch = conversation.targetPriceRange.match(
    /\$(\d+(?:\.\d+)?)\s*-\s*\$(\d+(?:\.\d+)?)/
  )
  if (priceMatch && rangeMatch) {
    const extracted = Number(priceMatch[1])
    const ceiling = Number(rangeMatch[2])
    if (extracted > ceiling) {
      reasons.push(
        `Supplier price $${extracted.toFixed(2)} exceeds negotiated ceiling $${ceiling.toFixed(2)}`
      )
    }
  }

  if (conversation.aiExtraction.missingFields.length > 0) {
    reasons.push(
      `Supplier has not confirmed: ${conversation.aiExtraction.missingFields.join(", ")}`
    )
  }

  if (invoice) {
    if (invoice.approvalState === "Blocked") {
      reasons.push(`Linked invoice ${invoice.id} is Blocked in settlement`)
    } else if (invoice.riskLevel === "High Risk") {
      reasons.push(
        `Linked invoice ${invoice.id} flagged High Risk — ${invoice.riskReason}`
      )
    } else if (invoice.approvalState === "Needs Review") {
      reasons.push(`Linked invoice ${invoice.id} requires review`)
    }
  }

  if (conversation.linkedSkus.length > 1) {
    reasons.push(
      `Bundle negotiation affects ${conversation.linkedSkus.length} SKUs (${conversation.linkedSkus.join(", ")})`
    )
  }

  return reasons
}

function PriorityBrief({
  priority,
  reasons,
}: {
  priority: "critical" | "high"
  reasons: string[]
}) {
  const isCritical = priority === "critical"
  const accent = isCritical
    ? {
        border: "border-[#EF4444]/40",
        bg: "bg-[#EF4444]/5",
        label: "border-[#EF4444]/40 bg-[#EF4444]/10 text-[#FCA5A5]",
        iconBg: "bg-[#EF4444]/15 text-[#F87171]",
        heading: "text-[#FCA5A5]",
        dot: "bg-[#EF4444]",
      }
    : {
        border: "border-[#F59E0B]/40",
        bg: "bg-[#F59E0B]/5",
        label: "border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#FBBF24]",
        iconBg: "bg-[#F59E0B]/15 text-[#FBBF24]",
        heading: "text-[#FBBF24]",
        dot: "bg-[#F59E0B]",
      }

  return (
    <Card
      className={`rounded-[14px] border ${accent.border} ${accent.bg} py-0 shadow-none ring-0`}
    >
      <CardContent className="flex items-start gap-4 p-4">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-[10px] ${accent.iconBg}`}
        >
          <AlertTriangle className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex h-6 items-center rounded-[10px] border px-2.5 text-[13px] font-semibold uppercase tracking-wider ${accent.label}`}
            >
              {priority} priority
            </span>
            <span className={`text-[14px] font-semibold ${accent.heading}`}>
              Why this is {priority}
            </span>
            <span className="text-[13px] text-[#9CA3AF]">
              {reasons.length} signal{reasons.length > 1 ? "s" : ""} detected
              by Z.AI
            </span>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2">
            {reasons.map((reason) => (
              <li
                key={reason}
                className="flex items-start gap-2 text-[14px] leading-5 text-[#E5E7EB]"
              >
                <span
                  className={`mt-1.5 size-1.5 shrink-0 rounded-full ${accent.dot}`}
                />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
