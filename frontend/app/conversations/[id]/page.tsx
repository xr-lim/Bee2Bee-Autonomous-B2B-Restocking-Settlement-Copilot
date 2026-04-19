import Link from "next/link"
import {
  AlertTriangle,
  Bot,
  CircleStop,
  FileImage,
  FileText,
  ImageIcon,
  Languages,
  Mail,
  Mic,
  Paperclip,
  ReceiptText,
} from "lucide-react"
import { notFound } from "next/navigation"

import { PageHeader } from "@/components/layout/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  mockConversations,
  mockInvoices,
  mockNegotiationMessages,
  mockProducts,
  mockSuppliers,
} from "@/lib/mock-data"
import type {
  Conversation,
  Invoice,
  NegotiationMessage,
  NegotiationState,
  OrderSummary,
  Product,
  StatusTone,
  StockStatus,
} from "@/lib/types"

const invoiceRiskTone: Record<Invoice["riskLevel"], StatusTone> = {
  "Low Risk": "success",
  "Medium Risk": "warning",
  "High Risk": "danger",
}

const invoiceApprovalTone: Record<Invoice["approvalState"], StatusTone> = {
  "Waiting Approval": "ai",
  "Needs Review": "warning",
  Blocked: "danger",
  Completed: "success",
}

const languageLabel: Record<
  NonNullable<NegotiationMessage["language"]>,
  { short: string; full: string }
> = {
  EN: { short: "EN", full: "English" },
  ZH: { short: "中文", full: "Chinese" },
  JA: { short: "日本語", full: "Japanese" },
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

const messageTone: Record<NegotiationMessage["type"], StatusTone> = {
  "supplier-message": "default",
  "ai-interpretation": "ai",
  "merchant-action": "success",
  "ai-recommendation": "warning",
}

const attachmentIcon = {
  email: Mail,
  screenshot: FileImage,
  image: ImageIcon,
  pdf: FileText,
  voice: Mic,
}

const stockStatusTone: Record<StockStatus, StatusTone> = {
  healthy: "success",
  "near-threshold": "warning",
  "below-threshold": "danger",
  "batch-candidate": "ai",
}

const stockStatusLabel: Record<StockStatus, string> = {
  healthy: "Healthy",
  "near-threshold": "Near Threshold",
  "below-threshold": "Below Threshold",
  "batch-candidate": "Batch Candidate",
}

export function generateStaticParams() {
  return mockConversations.map((conversation) => ({ id: conversation.id }))
}

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const conversation = mockConversations.find((item) => item.id === id)

  if (!conversation) {
    notFound()
  }

  const supplier = mockSuppliers.find((item) => item.id === conversation.supplierId)
  const linkedProducts = conversation.linkedSkus
    .map((sku) => mockProducts.find((product) => product.sku === sku))
    .filter((product): product is Product => Boolean(product))
  const messages = mockNegotiationMessages.filter(
    (item) => item.conversationId === conversation.id
  )
  const linkedInvoice = mockInvoices.find((invoice) =>
    conversation.linkedSkus.includes(invoice.productSku)
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

      <section className="grid grid-cols-[300px_1fr_340px] gap-6">
        <aside className="space-y-4">
          <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
            <CardHeader className="border-b border-[#243047] p-4">
              <CardTitle className="text-[16px] font-semibold text-[#E5E7EB]">
                Conversation Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <InfoRow label="Supplier" value={supplier?.name ?? "Unknown supplier"} />
              <InfoRow label="Source Type" value={conversation.source} />
              <InfoRow label="Target Price Range" value={conversation.targetPriceRange} />
              <InfoRow label="Created Date" value={conversation.createdDate} />
              <div>
                <p className="text-[12px] text-[#9CA3AF]">Current State</p>
                <div className="mt-2">
                  <StatusBadge
                    label={conversation.negotiationState}
                    tone={stateTone[conversation.negotiationState]}
                  />
                </div>
              </div>
              <div>
                <p className="text-[12px] text-[#9CA3AF]">Linked SKU IDs</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {conversation.linkedSkus.map((sku) => (
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
              <div>
                <p className="text-[12px] text-[#9CA3AF]">Linked Products</p>
                <div className="mt-2 space-y-2">
                  {linkedProducts.map((product) => (
                    <p key={product?.sku} className="text-[14px] text-[#E5E7EB]">
                      {product?.name}
                    </p>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
            <CardHeader className="border-b border-[#243047] p-4">
              <CardTitle className="text-[16px] font-semibold text-[#E5E7EB]">
                Linked Product Panel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {linkedProducts.map((product) => (
                <div
                  key={product?.sku}
                  className="rounded-[10px] border border-[#243047] bg-[#172033] p-3"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[14px] font-medium text-[#E5E7EB]">
                        {product?.sku}
                      </p>
                      <p className="text-[12px] text-[#9CA3AF]">{product?.name}</p>
                    </div>
                    {product ? (
                      <StatusBadge
                        label={stockStatusLabel[product.status]}
                        tone={stockStatusTone[product.status]}
                      />
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[12px] text-[#9CA3AF]">
                    <span>Stock: {product?.stockOnHand}</span>
                    <span>AI threshold: {product?.aiThreshold}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>

        <main>
          <Card className="flex h-[1300px] flex-col rounded-[14px] border border-[#243047] bg-[#0F1728] py-0 shadow-none ring-0">
            <CardHeader className="shrink-0 border-b border-[#243047] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-[16px] font-semibold text-[#E5E7EB]">
                    Negotiation Thread
                  </CardTitle>
                  <p className="mt-1 text-[12px] text-[#9CA3AF]">
                    Z.AI negotiating autonomously with {supplier?.name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge label="Z.AI live" tone="ai" />
                  <Button
                    type="button"
                    className="h-8 rounded-[10px] bg-[#EF4444] px-3 text-[12px] text-white hover:bg-[#DC2626]"
                  >
                    <CircleStop className="size-3.5" aria-hidden="true" />
                    Interrupt
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              <div className="shrink-0 border-b border-[#243047] px-5 py-3 text-center text-[11px] font-medium uppercase tracking-wider text-[#6B7280]">
                PO PDF dispatched to supplier · Z.AI running negotiation loop
              </div>

              {conversation.aiExtraction.supplierLanguage !== "English" ? (
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#243047] bg-[#8B5CF6]/5 px-5 py-2.5">
                  <div className="flex items-center gap-2">
                    <Languages
                      className="size-4 text-[#C4B5FD]"
                      aria-hidden="true"
                    />
                    <span className="text-[12px] text-[#E5E7EB]">
                      Supplier communicates in{" "}
                      <span className="font-semibold text-[#C4B5FD]">
                        {conversation.aiExtraction.supplierLanguage}
                      </span>
                      . Z.AI is auto-translating and replying in the same
                      language.
                    </span>
                  </div>
                  <StatusBadge label="Auto-translate ON" tone="ai" />
                </div>
              ) : null}

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
                {messages.map((message) => {
                  const invoice = message.invoiceId
                    ? mockInvoices.find((item) => item.id === message.invoiceId)
                    : undefined

                  return (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      invoice={invoice}
                    />
                  )
                })}

                <div className="ml-8 max-w-[86%] rounded-[14px] border border-[#8B5CF6]/30 bg-[#111827] p-4 shadow-lg shadow-black/10">
                  <div className="mb-3 flex items-center gap-2">
                    <StatusBadge label="Z.AI autonomous draft" tone="ai" />
                    <span className="text-[12px] text-[#9CA3AF]">
                      auto-send queued
                    </span>
                  </div>
                  <p className="text-[14px] leading-6 text-[#E5E7EB]">
                    We can accept the split delivery only if freight is capped and
                    the second shipment quantity is confirmed. If volume increases
                    to the AI recommended bundle, can you meet the target range of{" "}
                    {conversation.targetPriceRange}?
                  </p>
                  <div className="mt-4 rounded-[10px] border border-[#243047] bg-[#172033] p-3">
                    <p className="text-[12px] font-medium text-[#C4B5FD]">
                      Z.AI automation rationale
                    </p>
                    <p className="mt-1 text-[12px] leading-5 text-[#9CA3AF]">
                      {conversation.nextAction.negotiationSummary}
                    </p>
                  </div>
                  <p className="mt-4 text-[12px] text-[#9CA3AF]">
                    No approval required. Z.AI continues automatically unless the
                    operator interrupts.
                  </p>
                </div>
              </div>

              <div className="shrink-0 border-t border-[#243047] bg-[#0B1020] p-4">
                <textarea
                  className="mb-3 min-h-[72px] w-full resize-none rounded-[10px] border border-[#243047] bg-[#172033] p-3 text-[14px] text-[#E5E7EB] outline-none placeholder:text-[#6B7280] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
                  placeholder="Optional operator note. Use Interrupt to stop Z.AI before it sends."
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="h-9 rounded-[10px] border-[#243047] bg-[#172033] text-[#E5E7EB] hover:bg-[#243047]"
                    >
                      <ImageIcon className="size-4" aria-hidden="true" />
                      Image
                    </Button>
                    <Button
                      variant="outline"
                      className="h-9 rounded-[10px] border-[#243047] bg-[#172033] text-[#E5E7EB] hover:bg-[#243047]"
                    >
                      <FileText className="size-4" aria-hidden="true" />
                      PDF
                    </Button>
                    <Button
                      variant="outline"
                      className="h-9 rounded-[10px] border-[#243047] bg-[#172033] text-[#E5E7EB] hover:bg-[#243047]"
                    >
                      <Mic className="size-4" aria-hidden="true" />
                      Voice
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button className="h-10 rounded-[10px] bg-[#172033] px-4 text-[#E5E7EB] hover:bg-[#243047]">
                      View Z.AI Analysis
                    </Button>
                    <Button className="h-10 rounded-[10px] bg-[#EF4444] px-4 text-white hover:bg-[#DC2626]">
                      <CircleStop className="size-4" aria-hidden="true" />
                      Interrupt & Take Over
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>

        <aside className="space-y-4">
          <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
            <CardHeader className="border-b border-[#243047] p-4">
              <CardTitle className="text-[16px] font-semibold text-[#E5E7EB]">
                AI Extraction Panel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              <InfoRow label="Extracted Price" value={conversation.aiExtraction.extractedPrice} />
              <InfoRow
                label="Extracted Quantity"
                value={conversation.aiExtraction.extractedQuantity}
              />
              <InfoRow
                label="Delivery Estimate"
                value={conversation.aiExtraction.deliveryEstimate}
              />
              <InfoRow
                label="Supplier Language"
                value={conversation.aiExtraction.supplierLanguage}
              />
              <InfoRow
                label="Detected Intent"
                value={conversation.aiExtraction.detectedIntent}
              />
              <div>
                <p className="text-[12px] text-[#9CA3AF]">Missing Fields</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {conversation.aiExtraction.missingFields.length > 0 ? (
                    conversation.aiExtraction.missingFields.map((field) => (
                      <StatusBadge key={field} label={field} tone="warning" />
                    ))
                  ) : (
                    <StatusBadge label="None" tone="success" />
                  )}
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[12px] text-[#9CA3AF]">
                    Confidence Score
                  </span>
                  <span className="text-[14px] font-semibold text-[#E5E7EB]">
                    {conversation.aiExtraction.confidenceScore}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#172033]">
                  <div
                    className="h-2 rounded-full bg-[#8B5CF6]"
                    style={{
                      width: `${conversation.aiExtraction.confidenceScore}%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
            <CardHeader className="border-b border-[#243047] p-4">
              <CardTitle className="text-[16px] font-semibold text-[#E5E7EB]">
                Next Action Panel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <div className="rounded-[14px] border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 p-4">
                <p className="text-[12px] font-medium text-[#C4B5FD]">
                  Recommended next step
                </p>
                <p className="mt-2 text-[14px] leading-6 text-[#E5E7EB]">
                  {conversation.nextAction.recommendedNextStep}
                </p>
              </div>
              <InfoRow
                label="Negotiation Summary"
                value={conversation.nextAction.negotiationSummary}
              />
              <div>
                <p className="text-[12px] text-[#9CA3AF]">Linked Invoice Status</p>
                <div className="mt-2 flex items-center gap-2">
                  <StatusBadge
                    label={conversation.nextAction.linkedInvoiceStatus}
                    tone="warning"
                  />
                  {linkedInvoice ? (
                    <Link
                      href={`/invoice-management/${linkedInvoice.id}`}
                      className="text-[12px] font-medium text-[#3B82F6] hover:text-[#93C5FD]"
                    >
                      Open invoice
                    </Link>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </section>
    </>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] text-[#9CA3AF]">{label}</p>
      <p className="mt-1 text-[14px] leading-6 text-[#E5E7EB]">{value}</p>
    </div>
  )
}

function MessageBubble({
  message,
  invoice,
}: {
  message: NegotiationMessage
  invoice?: Invoice
}) {
  const isSupplier = message.type === "supplier-message"
  const isMerchant = message.type === "merchant-action"

  return (
    <div
      className={
        isSupplier
          ? "ml-auto flex max-w-[78%] items-start gap-3"
          : "mr-auto flex max-w-[84%] items-start gap-3"
      }
    >
      {!isSupplier ? (
        <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#8B5CF6]/20 text-[#C4B5FD]">
          <Bot className="size-4" aria-hidden="true" />
        </div>
      ) : null}
      <div
        className={
          isSupplier
            ? "rounded-[14px] border border-[#243047] bg-[#273044] p-4"
            : isMerchant
              ? "rounded-[14px] border border-[#10B981]/30 bg-[#10B981]/10 p-4"
              : "rounded-[14px] border border-[#243047] bg-[#111827] p-4"
        }
      >
        <div className="mb-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <StatusBadge
              label={message.type.replace(/-/g, " ")}
              tone={messageTone[message.type]}
            />
            {message.language && message.language !== "EN" ? (
              <StatusBadge
                label={languageLabel[message.language].short}
                tone="ai"
                className="gap-1"
              />
            ) : null}
          </div>
          <span className="text-[12px] text-[#6B7280]">
            {message.author} / {message.sentiment}
          </span>
        </div>
        <p
          className={
            message.language && message.language !== "EN"
              ? "text-[14px] leading-6 text-[#E5E7EB]"
              : "text-[14px] leading-6 text-[#E5E7EB]"
          }
          lang={
            message.language === "ZH"
              ? "zh"
              : message.language === "JA"
                ? "ja"
                : undefined
          }
        >
          {message.body}
        </p>
        {message.translation ? (
          <div className="mt-3 rounded-[10px] border border-dashed border-[#8B5CF6]/30 bg-[#8B5CF6]/5 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[#C4B5FD]">
              <Languages className="size-3" aria-hidden="true" />
              Z.AI translation · EN
            </div>
            <p className="text-[12px] leading-5 text-[#9CA3AF]">
              {message.translation}
            </p>
          </div>
        ) : null}
        {invoice ? (
          <SupplierInvoiceFrame
            invoice={invoice}
            attachmentType={message.attachmentType}
            attachmentLabel={message.attachmentLabel}
          />
        ) : message.attachmentType ? (
          <AttachmentPreview
            type={message.attachmentType}
            label={message.attachmentLabel ?? "Attachment"}
            orderSummary={message.orderSummary}
          />
        ) : null}
      </div>
      {isSupplier ? (
        <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#273044] text-[11px] font-semibold text-[#CBD5E1]">
          AP
        </div>
      ) : null}
    </div>
  )
}

function SupplierInvoiceFrame({
  invoice,
  attachmentType,
  attachmentLabel,
}: {
  invoice: Invoice
  attachmentType?: NegotiationMessage["attachmentType"]
  attachmentLabel?: string
}) {
  const isImage = attachmentType === "image"
  const AttachmentIcon = isImage ? ImageIcon : FileText
  const amountDisplay = `${invoice.currency} ${invoice.amount.toLocaleString(
    "en-US"
  )}`
  const variance = invoice.amount - invoice.negotiatedAmount
  const varianceDisplay =
    variance === 0
      ? "Matches negotiated"
      : `${variance > 0 ? "+" : ""}${invoice.currency} ${variance.toLocaleString(
          "en-US"
        )} vs negotiated`

  return (
    <div className="mt-4 overflow-hidden rounded-[12px] border border-[#F59E0B]/40 bg-[#0B1220]">
      <div className="flex items-center justify-between gap-3 border-b border-[#243047] bg-[#F59E0B]/10 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <ReceiptText className="size-4 text-[#FBBF24]" aria-hidden="true" />
          <span className="text-[12px] font-semibold uppercase tracking-wider text-[#FBBF24]">
            Invoice received
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusBadge
            label={invoice.riskLevel}
            tone={invoiceRiskTone[invoice.riskLevel]}
          />
          <StatusBadge
            label={invoice.approvalState}
            tone={invoiceApprovalTone[invoice.approvalState]}
          />
        </div>
      </div>

      <div className="flex items-start gap-3 border-b border-[#243047] px-4 py-3">
        <div
          className={
            "flex size-12 shrink-0 items-center justify-center rounded-[10px] " +
            (isImage
              ? "bg-[#172033]"
              : "bg-[#F59E0B]/10 text-[#FBBF24]")
          }
        >
          {isImage ? (
            <div className="h-full w-full rounded-[10px] bg-[linear-gradient(135deg,#172033,#111827_45%,#243047)]" />
          ) : (
            <AttachmentIcon className="size-5" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-[#E5E7EB]">
            {attachmentLabel ?? invoice.fileName}
          </p>
          <p className="mt-0.5 text-[11px] text-[#9CA3AF]">
            {invoice.sourceType} · {invoice.fileSize} ·{" "}
            {invoice.validationStatus}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-0 border-b border-[#243047]">
        <InvoiceField label="Invoice #" value={invoice.invoiceNumber} />
        <InvoiceField label="Amount" value={amountDisplay} emphasis />
        <InvoiceField label="Due" value={invoice.dueDate} />
        <InvoiceField label="Payment" value={invoice.paymentTerms} />
      </div>

      <div className="px-4 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-[#9CA3AF]">
          Z.AI risk signal
        </p>
        <p className="mt-1 text-[12px] leading-5 text-[#E5E7EB]">
          {invoice.riskReason}
        </p>
        <p className="mt-1 text-[11px] text-[#9CA3AF]">{varianceDisplay}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#243047] bg-[#111827] px-4 py-3">
        <span className="text-[11px] text-[#9CA3AF]">
          Routed to Invoice Management · {invoice.id}
        </span>
        <Button
          asChild
          className="h-8 rounded-[10px] bg-[#3B82F6] px-3 text-[12px] text-white hover:bg-[#2563EB]"
        >
          <Link href={`/invoice-management/${invoice.id}`}>
            <ReceiptText className="size-3.5" aria-hidden="true" />
            Review
          </Link>
        </Button>
      </div>
    </div>
  )
}

function InvoiceField({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div className="border-r border-[#243047] px-4 py-3 last:border-r-0">
      <p className="text-[11px] text-[#9CA3AF]">{label}</p>
      <p
        className={
          emphasis
            ? "mt-1 truncate text-[14px] font-semibold text-[#FBBF24]"
            : "mt-1 truncate text-[13px] font-medium text-[#E5E7EB]"
        }
      >
        {value}
      </p>
    </div>
  )
}

function AttachmentPreview({
  type,
  label,
  orderSummary,
}: {
  type: NonNullable<NegotiationMessage["attachmentType"]>
  label: string
  orderSummary?: OrderSummary
}) {
  const Icon = attachmentIcon[type] ?? Paperclip
  const isVisual = type === "screenshot" || type === "image"
  const isPoPdf = type === "pdf" && Boolean(orderSummary)
  const showParsedBadge = !isPoPdf && type !== "email"

  return (
    <div className="mt-4 rounded-[12px] border border-[#243047] bg-[#111827] p-3">
      <div className="flex items-center justify-between gap-2 text-[12px] font-medium text-[#9CA3AF]">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-[#3B82F6]" aria-hidden="true" />
          {label}
        </div>
        <div className="flex items-center gap-1.5">
          {isPoPdf ? <StatusBadge label="Order List PDF" tone="ai" /> : null}
          {showParsedBadge ? (
            <StatusBadge label="Parsed by Z.AI" tone="success" />
          ) : null}
        </div>
      </div>
      {isVisual ? (
        <div className="mt-3 h-24 rounded-[10px] border border-[#243047] bg-[linear-gradient(135deg,#172033,#111827_45%,#243047)]" />
      ) : null}
      {type === "voice" ? (
        <div className="mt-3 rounded-[10px] bg-[#172033] p-3 text-[12px] leading-5 text-[#9CA3AF]">
          <span className="font-medium text-[#C4B5FD]">Transcription · </span>
          Z.AI parsed the voice note end-to-end and flagged the two conflicting
          delivery dates plus the conditional pallet price as supplier-side
          terms needing resolution.
        </div>
      ) : null}
      {isPoPdf ? <OrderPdfPreview summary={orderSummary!} /> : null}
    </div>
  )
}

function OrderPdfPreview({ summary }: { summary: OrderSummary }) {
  return (
    <div className="mt-3 overflow-hidden rounded-[10px] border border-[#243047] bg-[#0B1220]">
      <div className="flex items-start justify-between gap-3 border-b border-[#243047] px-4 py-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#9CA3AF]">
            Purchase order
          </p>
          <p className="mt-1 text-[14px] font-semibold text-[#E5E7EB]">
            {summary.poNumber}
          </p>
        </div>
        <div className="text-right text-[11px] text-[#9CA3AF]">
          <p>Issued {summary.issuedAt}</p>
          <p className="mt-1">Deliver by {summary.deliveryBy}</p>
        </div>
      </div>

      <div className="px-4 pt-3">
        <div className="grid grid-cols-[1.4fr_80px_110px_110px] gap-2 border-b border-[#243047] pb-2 text-[11px] font-medium uppercase tracking-wider text-[#6B7280]">
          <span>Item</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Unit Price</span>
          <span className="text-right">Line Total</span>
        </div>
        <div className="divide-y divide-[#243047]">
          {summary.items.map((item) => (
            <div
              key={item.sku}
              className="grid grid-cols-[1.4fr_80px_110px_110px] gap-2 py-2 text-[12px]"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-[#E5E7EB]">
                  {item.productName}
                </p>
                <p className="text-[11px] text-[#6B7280]">{item.sku}</p>
              </div>
              <span className="text-right text-[#E5E7EB]">
                {item.quantity.toLocaleString("en-US")} {item.unit}
                {item.quantity > 1 ? "s" : ""}
              </span>
              <span className="text-right text-[#E5E7EB]">
                {item.unitPrice}
              </span>
              <span className="text-right font-semibold text-[#E5E7EB]">
                {item.lineTotal}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 border-t border-[#243047] bg-[#111827] px-4 py-3 text-[12px]">
        <div>
          <p className="text-[11px] text-[#6B7280]">Subtotal</p>
          <p className="mt-1 font-semibold text-[#E5E7EB]">{summary.subtotal}</p>
        </div>
        <div>
          <p className="text-[11px] text-[#6B7280]">Payment terms</p>
          <p className="mt-1 font-semibold text-[#E5E7EB]">
            {summary.paymentTerms}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[#6B7280]">Total</p>
          <p className="mt-1 font-semibold text-[#C4B5FD]">{summary.total}</p>
        </div>
      </div>

      {summary.notes ? (
        <div className="border-t border-[#243047] px-4 py-3 text-[12px] leading-5 text-[#9CA3AF]">
          <span className="font-medium text-[#C4B5FD]">Note · </span>
          {summary.notes}
        </div>
      ) : null}
    </div>
  )
}

function buildPriorityReasons(
  conversation: Conversation,
  products: Product[],
  invoice?: Invoice
): string[] {
  const reasons: string[] = []

  products.forEach((product) => {
    const deficit = product.stockOnHand - product.aiThreshold
    if (deficit < 0) {
      reasons.push(
        `${product.name} stock ${Math.abs(deficit)} units below AI threshold (${product.stockOnHand}/${product.aiThreshold})`
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
              className={`inline-flex h-6 items-center rounded-[10px] border px-2.5 text-[11px] font-semibold uppercase tracking-wider ${accent.label}`}
            >
              {priority} priority
            </span>
            <span className={`text-[13px] font-semibold ${accent.heading}`}>
              Why this is {priority}
            </span>
            <span className="text-[12px] text-[#9CA3AF]">
              {reasons.length} signal{reasons.length > 1 ? "s" : ""} detected
              by Z.AI
            </span>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2">
            {reasons.map((reason) => (
              <li
                key={reason}
                className="flex items-start gap-2 text-[13px] leading-5 text-[#E5E7EB]"
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
