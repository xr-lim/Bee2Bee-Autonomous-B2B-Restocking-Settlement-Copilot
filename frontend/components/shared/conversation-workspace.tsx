"use client"

import Link from "next/link"
import {
  Bot,
  FileImage,
  FileText,
  ImageIcon,
  Languages,
  Mail,
  Maximize2,
  Mic,
  Paperclip,
  Pause,
  Play,
  ReceiptText,
  ZoomIn,
} from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useCallback, useMemo, useState, useEffect, useRef } from "react"
import { io } from "socket.io-client"

import { AiReasoningTrail } from "@/components/shared/ai-reasoning-trail"
import { StatusBadge } from "@/components/shared/status-badge"
import { displayConversationSource } from "@/lib/conversation-source"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  buildConversationReasoning,
  getEvidenceSourceMessageId,
  type ExtractionField,
} from "@/lib/ai-reasoning"
import type {
  Conversation,
  Invoice,
  NegotiationMessage,
  NegotiationState,
  OrderSummary,
  Product,
  StatusTone,
  Supplier,
} from "@/lib/types"
import { cn } from "@/lib/utils"

type MessageWithFileUrl = NegotiationMessage & { file_url?: string | null }
const fileUrlFor = (message: NegotiationMessage) =>
  (message as MessageWithFileUrl).file_url ?? undefined

function splitThinking(body: string) {
  try {
    const safeBody = typeof body === "string" ? body : ""
    const thinkingMatches = Array.from(
      safeBody.matchAll(/<thinking>([\s\S]*?)<\/thinking>/gi)
    )
    const thinking = thinkingMatches
      .map((match) => (match[1] ?? "").trim())
      .filter(Boolean)
      .join("\n\n")

    const stripped = safeBody
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
      .trim()

    return {
      thinking,
      visible: stripped.length > 0 ? stripped : "Processing deal details...",
    }
  } catch {
    return { thinking: "", visible: "Processing deal details..." }
  }
}

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

type PreviewTarget = {
  message: NegotiationMessage
  invoice?: Invoice
}

type ConversationWorkspaceProps = {
  conversation: Conversation
  supplier?: Supplier
  linkedProducts: Product[]
  invoicesById: Record<string, Invoice>
  linkedInvoice?: Invoice
}

export function ConversationWorkspace({
  conversation,
  supplier,
  linkedProducts,
  invoicesById,
  linkedInvoice,
}: ConversationWorkspaceProps) {
  type SocketMessagePayload = {
    room_id?: string
    sender?: string
    content?: string
    file_url?: string | null
    file_name?: string | null
    file_type?: string | null
  }

  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null)
  const [preview, setPreview] = useState<PreviewTarget | null>(null)
  const [pulseMessageId, setPulseMessageId] = useState<string | null>(null)
  const [pdfInlineOpen, setPdfInlineOpen] = useState<Record<string, boolean>>({})

  const [liveMessages, setLiveMessages] = useState<MessageWithFileUrl[]>([])
  const [isWaitingForAI, setIsWaitingForAI] = useState(false)
  const seenMessageSignaturesRef = useRef<Set<string>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const autoStartAttemptedRef = useRef(false)
  const imageUploadInputRef = useRef<HTMLInputElement>(null)
  const pdfUploadInputRef = useRef<HTMLInputElement>(null)

  // Negotiation state
  const [isNegotiating, setIsNegotiating] = useState(false)
  const [supplierReply, setSupplierReply] = useState("")
  const [isSendingReply, setIsSendingReply] = useState(false)

  const isConversationComplete = useMemo(() => {
    const stateRaw =
      String((conversation as unknown as { state?: string }).state ?? "").trim()
    const normalizedState = stateRaw.toLowerCase()
    return (
      normalizedState === "completed" ||
      normalizedState === "closed" ||
      conversation.negotiationState === "Closed"
    )
  }, [conversation])

  const shouldAutoStartNegotiation = useMemo(
    () =>
      !isConversationComplete &&
      (conversation.negotiationState === "New Input" ||
        conversation.negotiationState === "Needs Analysis"),
    [conversation.negotiationState, isConversationComplete]
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [liveMessages.length])

  useEffect(() => {
    const newSocket = io("http://localhost:8000", { transports: ["websocket"] })

    newSocket.on("connect", () => {
      newSocket.emit("join_room_event", {
        room_id: conversation.id,
        role: "merchant_dashboard",
      })
    })

    newSocket.on("receive_message", (data: SocketMessagePayload) => {
      const sender = String(data?.sender ?? "")
      if (sender.toLowerCase() === "system") return

      const isAiSender =
        /\b(ai|assistant|bot)\b/i.test(sender) || /z\.ai/i.test(sender)
      const isSupplierSender =
        sender.toLowerCase().includes("supplier") ||
        (supplier?.name ? sender.toLowerCase() === supplier.name.toLowerCase() : false)

      if (isAiSender) {
        setIsWaitingForAI(false)
      }

      let attachmentType: "image" | "pdf" | undefined = undefined
      if (data?.file_url) {
        if (String(data.file_type ?? "").includes("image")) attachmentType = "image"
        else if (String(data.file_type ?? "").includes("pdf")) attachmentType = "pdf"
      }

      const content =
        typeof data?.content === "string" && data.content.trim().length > 0
          ? data.content.trim()
          : attachmentType === "image"
            ? "Uploaded an image"
            : attachmentType === "pdf"
              ? "Uploaded a document"
              : "New message"

      const signature = [
        sender.toLowerCase(),
        content,
        String(data?.file_url ?? ""),
        String(data?.file_name ?? ""),
      ].join("|")
      if (seenMessageSignaturesRef.current.has(signature)) return
      seenMessageSignaturesRef.current.add(signature)

    setLiveMessages((prev) => [
        ...prev,
        {
          id: `live-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          conversationId: conversation.id,
          supplierId: conversation.supplierId,
          type: isAiSender
            ? "ai-recommendation"
            : isSupplierSender
              ? "supplier-message"
              : "merchant-action",
          author: isAiSender ? "ai" : isSupplierSender ? "supplier" : "merchant",
          sentiment: "neutral",
          body: content,
          language: "EN",
          createdAt: new Date().toISOString(),
          attachmentType,
          attachmentLabel:
            typeof data?.file_name === "string" ? data.file_name : undefined,
          file_url: data?.file_url ?? null,
        },
      ])
    })

    return () => { newSocket.disconnect() }
  }, [conversation.id, conversation.supplierId, supplier?.name])

  const handleStartNegotiation = useCallback(async () => {
    if (isConversationComplete) return
    setIsWaitingForAI(true)
    setIsNegotiating(true)
    try {
      const response = await fetch("http://localhost:8000/api/v1/negotiation/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversation_id: conversation.id,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => "")
        throw new Error(
          `Failed to start negotiation: ${response.status} ${response.statusText}${
            errorText ? `\n${errorText}` : ""
          }`
        )
      }

      try {
        const result = await response.json()
        console.log("Negotiation started:", result)
      } catch {
        // Backend might reply with an empty body or non-JSON; don't crash the UI.
      }
    } catch (error) {
      autoStartAttemptedRef.current = false
      console.error("Failed to start negotiation:", error)
      alert("Failed to start negotiation. Check console for details.")
      setIsWaitingForAI(false)
    } finally {
      setIsNegotiating(false)
    }
  }, [conversation.id, isConversationComplete])

  useEffect(() => {
    if (!shouldAutoStartNegotiation || autoStartAttemptedRef.current) return
    autoStartAttemptedRef.current = true
    void handleStartNegotiation()
  }, [handleStartNegotiation, shouldAutoStartNegotiation])

  const handleSendSupplierReply = async () => {
    if (!supplierReply.trim()) return
    if (isConversationComplete) return

    setIsWaitingForAI(true)

    const optimisticContent = supplierReply.trim()
    const optimisticSignature = ["supplier", optimisticContent, "", ""].join("|")
    seenMessageSignaturesRef.current.add(optimisticSignature)
    setLiveMessages((prev) => [
      ...prev,
      {
        id: `local-supplier-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        conversationId: conversation.id,
        supplierId: conversation.supplierId,
        type: "supplier-message",
        author: "supplier",
        sentiment: "neutral",
        body: optimisticContent,
        language: "EN",
        createdAt: new Date().toISOString(),
      },
    ])

    setIsSendingReply(true)
    try {
      const response = await fetch("http://localhost:8000/api/v1/negotiation/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversation_id: conversation.id,
          supplier_message: optimisticContent,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => "")
        throw new Error(
          `Failed to send reply: ${response.status} ${response.statusText}${
            errorText ? `\n${errorText}` : ""
          }`
        )
      }

      try {
        const result = await response.json()
        console.log("Supplier reply processed:", result)
      } catch {
        // Backend might reply with an empty body or non-JSON; don't crash the UI.
      }
      setSupplierReply("")
    } catch (error) {
      console.error("Failed to send supplier reply:", error)
      alert("Failed to send reply. Check console for details.")
      setIsWaitingForAI(false)
    } finally {
      setIsSendingReply(false)
    }
  }

  const handleSendSupplierFile = useCallback(
    async (file: File | null) => {
      if (!file || isConversationComplete) return

      setIsWaitingForAI(true)
      setIsSendingReply(true)

      try {
        const uploadForm = new FormData()
        uploadForm.append("file", file)

        const uploadResponse = await fetch("http://localhost:8000/api/v1/chat/upload", {
          method: "POST",
          body: uploadForm,
        })

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text().catch(() => "")
          throw new Error(
            `Failed to upload file: ${uploadResponse.status} ${uploadResponse.statusText}${
              errorText ? `\n${errorText}` : ""
            }`
          )
        }

        const uploadResult = await uploadResponse.json()
        const response = await fetch("http://localhost:8000/api/v1/negotiation/webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversation_id: conversation.id,
            supplier_message: null,
            file_url: uploadResult.file_url,
            file_name: uploadResult.file_name,
            file_type: uploadResult.file_type,
          }),
        })

        if (!response.ok) {
          const errorText = await response.text().catch(() => "")
          throw new Error(
            `Failed to send attachment: ${response.status} ${response.statusText}${
              errorText ? `\n${errorText}` : ""
            }`
          )
        }

        try {
          await response.json()
        } catch {
          // Backend might reply with an empty body or non-JSON; don't crash the UI.
        }
      } catch (error) {
        console.error("Failed to send supplier attachment:", error)
        alert("Failed to send attachment. Check console for details.")
        setIsWaitingForAI(false)
      } finally {
        setIsSendingReply(false)
      }
    },
    [conversation.id, isConversationComplete]
  )

  const openPreview = useCallback(
    (target: PreviewTarget) => setPreview(target),
    []
  )
  const closePreview = useCallback(() => setPreview(null), [])

  const handleFieldHover = useCallback(
    (field: ExtractionField | null) => {
      if (!field) {
        setHighlightedMessageId(null)
        return
      }
      const id = getEvidenceSourceMessageId(liveMessages, field)
      if (id) {
        setHighlightedMessageId(id)
      }
    },
    [liveMessages]
  )

  const handleAttachmentClick = useCallback(
    (message: NegotiationMessage) => {
      const invoice = message.invoiceId
        ? invoicesById[message.invoiceId]
        : undefined

      if (message.attachmentType === "pdf" && message.orderSummary) {
        setPdfInlineOpen((current) => ({
          ...current,
          [message.id]: !current[message.id],
        }))
        setPulseMessageId(message.id)
        window.setTimeout(() => setPulseMessageId(null), 900)
        return
      }

      openPreview({ message, invoice })
    },
    [invoicesById, openPreview]
  )

  return (
    <>
      <section className="grid grid-cols-[300px_1fr] gap-6">
        <aside className="space-y-4">
          <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
            <CardHeader className="border-b border-[#243047] p-4">
              <CardTitle className="text-[18px] font-semibold text-[#E5E7EB]">
                Conversation Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <InfoRow
                label="Supplier"
                value={supplier?.name ?? "Unknown supplier"}
              />
              <InfoRow
                label="Source Type"
                value={displayConversationSource(conversation.source)}
              />
              <InfoRow
                label="Target Price Range"
                value={conversation.targetPriceRange}
              />
              <InfoRow
                label="Created Date"
                value={conversation.createdDate}
              />
              <div>
                <p className="text-[13px] text-[#9CA3AF]">Current State</p>
                <div className="mt-2">
                  <StatusBadge
                    label={conversation.negotiationState}
                    tone={stateTone[conversation.negotiationState]}
                  />
                </div>
              </div>
              <div>
                <p className="text-[13px] text-[#9CA3AF]">Linked SKU IDs</p>
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
                <p className="text-[13px] text-[#9CA3AF]">Linked Products</p>
                <div className="mt-2 space-y-2">
                  {linkedProducts.map((product) => (
                    <p
                      key={product.sku}
                      className="text-[15px] text-[#E5E7EB]"
                    >
                      {product.name}
                    </p>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
            <CardHeader className="border-b border-[#243047] p-4">
              <CardTitle className="text-[18px] font-semibold text-[#E5E7EB]">
                Linked Product Panel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {linkedProducts.map((product) => (
                <div
                  key={product.sku}
                  className="rounded-[10px] border border-[#243047] bg-[#172033] p-3"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[15px] font-medium text-[#E5E7EB]">
                        {product.sku}
                      </p>
                      <p className="text-[13px] text-[#9CA3AF]">
                        {product.name}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[13px] text-[#9CA3AF]">
                    <span>Stock: {product.stockOnHand}</span>
                    <span>Threshold: {product.currentThreshold}</span>
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
                  <CardTitle className="text-[18px] font-semibold text-[#E5E7EB]">
                    Negotiation Thread
                  </CardTitle>
                  <p className="mt-1 text-[13px] text-[#9CA3AF]">
                    Z.AI negotiating autonomously with {supplier?.name}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <StatusBadge
                    label={
                      isConversationComplete
                        ? "Negotiation Complete"
                        : isNegotiating || isWaitingForAI
                          ? "Negotiation Active"
                          : conversation.negotiationState
                    }
                    tone={
                      isConversationComplete
                        ? "success"
                        : isNegotiating || isWaitingForAI
                          ? "ai"
                          : stateTone[conversation.negotiationState]
                    }
                  />
                  {conversation.submittedOrderId ? (
                    <StatusBadge
                      label={`Order ${conversation.submittedOrderStatus ?? "Created"}`}
                      tone="success"
                    />
                  ) : null}
                  {conversation.linkedInvoiceId ? (
                    <StatusBadge label="Invoice Received" tone="warning" />
                  ) : null}
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex min-h-0 flex-1 flex-col p-0">
              {conversation.aiExtraction.supplierLanguage !== "English" ? (
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#243047] bg-[#8B5CF6]/5 px-5 py-2.5">
                  <div className="flex items-center gap-2">
                    <Languages
                      className="size-4 text-[#C4B5FD]"
                      aria-hidden="true"
                    />
                    <span className="text-[13px] text-[#E5E7EB]">
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
                {liveMessages.map((message) => {
                  const invoice = message.invoiceId
                    ? invoicesById[message.invoiceId]
                    : undefined
                  return (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      invoice={invoice}
                      isHighlighted={highlightedMessageId === message.id}
                      isPulsing={pulseMessageId === message.id}
                      inlinePdfExpanded={Boolean(pdfInlineOpen[message.id])}
                      onAttachmentClick={() => handleAttachmentClick(message)}
                    />
                  )
                })}

                {isWaitingForAI ? (
                  <div className="ml-8 max-w-[86%] rounded-[14px] border border-[#243047] bg-[#111827] p-3">
                    <div className="flex items-center gap-2 text-[14px] text-[#9CA3AF]">
                      <span className="inline-flex size-2 animate-pulse rounded-full bg-[#8B5CF6]" />
                      <span>typing...</span>
                    </div>
                  </div>
                ) : null}
                <div ref={messagesEndRef} />
              </div>

              {/* Supplier Reply Section */}
              <div className="shrink-0 border-t border-[#243047] bg-[#0B1020] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-[13px] font-medium text-[#9CA3AF]">Test Supplier Reply</span>
                  <StatusBadge label="Development Mode" tone="warning" />
                </div>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={supplierReply}
                    onChange={(e) => setSupplierReply(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendSupplierReply()}
                    placeholder="Enter supplier's counter-offer or response..."
                    className="flex-1 rounded-[10px] border border-[#243047] bg-[#172033] px-3 py-2 text-[14px] text-[#E5E7EB] outline-none placeholder:text-[#6B7280] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
                    disabled={isSendingReply || isConversationComplete}
                  />
                  <Button
                    onClick={handleSendSupplierReply}
                    disabled={isSendingReply || isConversationComplete || !supplierReply.trim()}
                    className="h-9 rounded-[10px] bg-[#3B82F6] px-4 text-[13px] text-white hover:bg-[#2563EB] disabled:opacity-50"
                  >
                    {isSendingReply ? "Sending..." : "Send Reply"}
                  </Button>
                </div>
              </div>

              <div className="shrink-0 border-t border-[#243047] bg-[#0B1020] p-4">
                <input
                  ref={imageUploadInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null
                    void handleSendSupplierFile(file)
                    event.currentTarget.value = ""
                  }}
                />
                <input
                  ref={pdfUploadInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null
                    void handleSendSupplierFile(file)
                    event.currentTarget.value = ""
                  }}
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => imageUploadInputRef.current?.click()}
                      disabled={isSendingReply || isConversationComplete}
                      className="h-9 rounded-[10px] border-[#243047] bg-[#172033] text-[#E5E7EB] hover:bg-[#243047]"
                    >
                      <ImageIcon className="size-4" aria-hidden="true" />
                      Image
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => pdfUploadInputRef.current?.click()}
                      disabled={isSendingReply || isConversationComplete}
                      className="h-9 rounded-[10px] border-[#243047] bg-[#172033] text-[#E5E7EB] hover:bg-[#243047]"
                    >
                      <FileText className="size-4" aria-hidden="true" />
                      PDF
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </section>

      <EvidenceSheet
        preview={preview}
        supplier={supplier}
        onClose={closePreview}
      />
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

function HoverableField({
  label,
  value,
  onHover,
  onLeave,
}: {
  label: string
  value: string
  onHover: () => void
  onLeave: () => void
}) {
  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onFocus={onHover}
      onBlur={onLeave}
      tabIndex={0}
      className="group -m-2 rounded-[10px] p-2 outline-none transition-colors hover:bg-[#172033]/60 focus-visible:bg-[#172033]/60 focus-visible:ring-1 focus-visible:ring-[#8B5CF6]/40"
    >
      <p className="flex items-center gap-1.5 text-[13px] text-[#9CA3AF]">
        {label}
        <span
          aria-hidden="true"
          className="hidden size-1 rounded-full bg-[#8B5CF6] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:inline-block"
        />
      </p>
      <p className="mt-1 text-[15px] leading-6 text-[#E5E7EB]">{value}</p>
    </div>
  )
}

function MessageBubble({
  message,
  invoice,
  isHighlighted,
  isPulsing,
  inlinePdfExpanded,
  onAttachmentClick,
}: {
  message: NegotiationMessage
  invoice?: Invoice
  isHighlighted: boolean
  isPulsing: boolean
  inlinePdfExpanded: boolean
  onAttachmentClick: () => void
}) {
  const isSupplier = message.type === "supplier-message"
  const isMerchant = message.type === "merchant-action"
  const { thinking, visible } = splitThinking(message.body)

  return (
    <motion.div
      layout
      animate={{
        boxShadow: isHighlighted
          ? "0 0 0 2px rgba(139,92,246,0.55), 0 0 36px rgba(139,92,246,0.18)"
          : "0 0 0 0 rgba(139,92,246,0)",
        scale: isPulsing ? 1.01 : 1,
      }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(
        "rounded-[14px]",
        isSupplier
          ? "ml-auto flex w-fit max-w-[78%] items-start gap-3"
          : "mr-auto flex w-fit max-w-[84%] items-start gap-3"
      )}
    >
      {!isSupplier ? (
        <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#8B5CF6]/20 text-[#C4B5FD]">
          <Bot className="size-4" aria-hidden="true" />
        </div>
      ) : null}
      <div
        className={cn(
          "rounded-[14px] p-4 transition-colors",
          isSupplier
            ? "border border-[#243047] bg-[#273044]"
            : isMerchant
              ? "border border-[#10B981]/30 bg-[#10B981]/10"
              : "border border-[#243047] bg-[#111827]",
          isHighlighted && "border-[#8B5CF6]/60"
        )}
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
            {isHighlighted ? (
              <StatusBadge label="Evidence source" tone="ai" />
            ) : null}
          </div>
          <span className="text-[13px] text-[#6B7280]">
            {message.author} / {message.sentiment}
          </span>
        </div>
        {visible ? (
          <p
            className="text-[15px] leading-6 text-[#E5E7EB]"
            lang={
              message.language === "ZH"
                ? "zh"
                : message.language === "JA"
                  ? "ja"
                  : undefined
            }
          >
            {visible}
          </p>
        ) : null}

        {thinking ? (
          <details className="mt-3 rounded-[10px] border border-[#243047] bg-[#0B1220] p-3">
            <summary className="cursor-pointer select-none text-[13px] font-medium text-[#9CA3AF]">
              AI Reasoning
            </summary>
            <pre className="mt-2 whitespace-pre-wrap text-[13px] leading-5 text-[#E5E7EB]">
              {thinking}
            </pre>
          </details>
        ) : null}
        {message.translation ? (
          <div className="mt-3 rounded-[10px] border border-dashed border-[#8B5CF6]/30 bg-[#8B5CF6]/5 p-3">
            <div className="mb-1 flex items-center gap-1.5 text-[13px] font-medium uppercase tracking-wider text-[#C4B5FD]">
              <Languages className="size-3" aria-hidden="true" />
              Z.AI translation · EN
            </div>
            <p className="text-[13px] leading-5 text-[#9CA3AF]">
              {message.translation}
            </p>
          </div>
        ) : null}
        {invoice ? (
          <SupplierInvoiceFrame
            invoice={invoice}
            attachmentType={message.attachmentType}
            attachmentLabel={message.attachmentLabel}
            fileUrl={fileUrlFor(message)}
            onClick={onAttachmentClick}
          />
        ) : message.attachmentType ? (
            <AttachmentPreview
            type={message.attachmentType}
            label={message.attachmentLabel ?? "Attachment"}
            orderSummary={message.orderSummary}
            fileUrl={fileUrlFor(message)}
            inlinePdfExpanded={inlinePdfExpanded}
            onClick={onAttachmentClick}
          />
        ) : null}
      </div>
      {isSupplier ? (
        <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#273044] text-[13px] font-semibold text-[#CBD5E1]">
          AP
        </div>
      ) : null}
    </motion.div>
  )
}

function SupplierInvoiceFrame({
  invoice,
  attachmentType,
  attachmentLabel,
  fileUrl,
  onClick,
}: {
  invoice: Invoice
  attachmentType?: NegotiationMessage["attachmentType"]
  attachmentLabel?: string
  fileUrl?: string
  onClick: () => void
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
          <span className="text-[13px] font-semibold uppercase tracking-wider text-[#FBBF24]">
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

      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-start gap-3 border-b border-[#243047] px-4 py-3 text-left transition-colors hover:bg-[#172033]/60"
      >
        <div
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-[10px] overflow-hidden bg-[#172033]",
            !fileUrl && "bg-[#F59E0B]/10 text-[#FBBF24]"
          )}
        >
          {fileUrl && isImage ? (
            <img src={fileUrl} alt="Thumbnail" className="w-full h-full object-cover" />
          ) : (
            <AttachmentIcon className="size-5" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-[#E5E7EB]">
            {attachmentLabel ?? invoice.fileName}
          </p>
          <p className="mt-0.5 text-[13px] text-[#9CA3AF]">
            {invoice.sourceType} · {invoice.fileSize} ·{" "}
            {invoice.validationStatus}
          </p>
        </div>
        <span className="flex items-center gap-1 text-[13px] font-medium text-[#93C5FD]">
          <Maximize2 className="size-3" aria-hidden="true" />
          Preview
        </span>
      </button>

      <div className="grid grid-cols-4 gap-0 border-b border-[#243047]">
        <InvoiceField label="Invoice #" value={invoice.invoiceNumber} />
        <InvoiceField label="Amount" value={amountDisplay} emphasis />
        <InvoiceField label="Due" value={invoice.dueDate} />
        <InvoiceField label="Payment" value={invoice.paymentTerms} />
      </div>

      <div className="px-4 py-3">
        <p className="text-[13px] font-medium uppercase tracking-wider text-[#9CA3AF]">
          Z.AI risk signal
        </p>
        <p className="mt-1 text-[13px] leading-5 text-[#E5E7EB]">
          {invoice.riskReason}
        </p>
        <p className="mt-1 text-[13px] text-[#9CA3AF]">{varianceDisplay}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#243047] bg-[#111827] px-4 py-3">
        <span className="text-[13px] text-[#9CA3AF]">
          Routed to Invoice Management · {invoice.id}
        </span>
        <Button
          asChild
          className="h-8 rounded-[10px] bg-[#3B82F6] px-3 text-[13px] text-white hover:bg-[#2563EB]"
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
      <p className="text-[13px] text-[#9CA3AF]">{label}</p>
      <p
        className={
          emphasis
            ? "mt-1 truncate text-[15px] font-semibold text-[#FBBF24]"
            : "mt-1 truncate text-[14px] font-medium text-[#E5E7EB]"
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
  fileUrl,
  inlinePdfExpanded,
  onClick,
}: {
  type: NonNullable<NegotiationMessage["attachmentType"]>
  label: string
  orderSummary?: OrderSummary
  fileUrl?: string
  inlinePdfExpanded: boolean
  onClick: () => void
}) {
  const Icon = attachmentIcon[type] ?? Paperclip
  const isVisual = type === "screenshot" || type === "image"
  const isPoPdf = type === "pdf" && Boolean(orderSummary)
  const showParsedBadge = !isPoPdf && type !== "email"

  const clickHint =
    type === "image" || type === "screenshot"
      ? "Open image preview"
      : type === "voice"
        ? "Open transcript drawer"
        : type === "pdf"
          ? isPoPdf
            ? inlinePdfExpanded
              ? "Hide PO preview"
              : "Expand PO preview"
            : "Open PDF preview"
          : "Open email preview"

  return (
    <div className="mt-4 overflow-hidden rounded-[12px] border border-[#243047] bg-[#111827]">
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[13px] font-medium text-[#9CA3AF] transition-colors hover:bg-[#172033]/60"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Icon
            className="size-4 shrink-0 text-[#3B82F6]"
            aria-hidden="true"
          />
          <span className="truncate text-[#E5E7EB]">{label}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isPoPdf ? <StatusBadge label="Order List PDF" tone="ai" /> : null}
          {showParsedBadge ? (
            <StatusBadge label="Parsed by Z.AI" tone="success" />
          ) : null}
          <span className="flex items-center gap-1 text-[13px] font-medium text-[#93C5FD]">
            {type === "image" || type === "screenshot" ? (
              <ZoomIn className="size-3" aria-hidden="true" />
            ) : (
              <Maximize2 className="size-3" aria-hidden="true" />
            )}
            {clickHint}
          </span>
        </div>
      </button>
      {isVisual ? (
        <button
          type="button"
          onClick={onClick}
          className="block h-36 w-full border-t border-[#243047] bg-[linear-gradient(135deg,#172033,#111827_45%,#243047)] transition-opacity hover:opacity-90 overflow-hidden relative"
          aria-label={`Preview ${label}`}
        >
          {fileUrl && (
             <img src={fileUrl} alt={label} className="w-full h-full object-cover" />
          )}
        </button>
      ) : null}
      {type === "voice" ? (
        <button
          type="button"
          onClick={onClick}
          className="flex w-full items-center gap-3 border-t border-[#243047] bg-[#172033] px-3 py-3 text-left text-[13px] leading-5 text-[#9CA3AF] transition-colors hover:bg-[#1C2744]"
        >
          <Waveform />
          <span>
            <span className="font-medium text-[#C4B5FD]">Transcription · </span>
            Click to open full transcript drawer.
          </span>
        </button>
      ) : null}
      <AnimatePresence initial={false}>
        {isPoPdf && inlinePdfExpanded && orderSummary ? (
          <motion.div
            key="po-inline"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.24, ease: [0.16, 1, 0.3, 1] },
              opacity: { duration: 0.15 },
            }}
            style={{ overflow: "hidden" }}
          >
            <OrderPdfPreview summary={orderSummary} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function Waveform() {
  const bars = [4, 7, 5, 9, 6, 12, 8, 10, 5, 13, 7, 11, 4, 9, 6]
  return (
    <div className="flex h-8 items-end gap-0.5" aria-hidden="true">
      {bars.map((height, index) => (
        <span
          key={index}
          className="w-0.5 rounded-full bg-[#8B5CF6]/60"
          style={{ height: `${height * 2}px` }}
        />
      ))}
    </div>
  )
}

function OrderPdfPreview({ summary }: { summary: OrderSummary }) {
  return (
    <div className="border-t border-[#243047] bg-[#0B1220]">
      <div className="flex items-start justify-between gap-3 border-b border-[#243047] px-4 py-3">
        <div>
          <p className="text-[13px] font-medium uppercase tracking-wider text-[#9CA3AF]">
            Purchase order
          </p>
          <p className="mt-1 text-[15px] font-semibold text-[#E5E7EB]">
            {summary.poNumber}
          </p>
        </div>
        <div className="text-right text-[13px] text-[#9CA3AF]">
          <p>Issued {summary.issuedAt}</p>
          <p className="mt-1">Deliver by {summary.deliveryBy}</p>
        </div>
      </div>
      <div className="px-4 pt-3">
        <div className="grid grid-cols-[1.4fr_80px_110px_110px] gap-2 border-b border-[#243047] pb-2 text-[13px] font-medium uppercase tracking-wider text-[#6B7280]">
          <span>Item</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Unit Price</span>
          <span className="text-right">Line Total</span>
        </div>
        <div className="divide-y divide-[#243047]">
          {summary.items.map((item) => (
            <div
              key={item.sku}
              className="grid grid-cols-[1.4fr_80px_110px_110px] gap-2 py-2 text-[13px]"
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-[#E5E7EB]">
                  {item.productName}
                </p>
                <p className="text-[13px] text-[#6B7280]">{item.sku}</p>
              </div>
              <span className="text-right text-[#E5E7EB]">
                {item.quantity.toLocaleString("en-US")} {item.unit}
                {item.quantity > 1 ? "s" : ""}
              </span>
              <span className="text-right text-[#E5E7EB]">{item.unitPrice}</span>
              <span className="text-right font-semibold text-[#E5E7EB]">
                {item.lineTotal}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 border-t border-[#243047] bg-[#111827] px-4 py-3 text-[13px]">
        <div>
          <p className="text-[13px] text-[#6B7280]">Subtotal</p>
          <p className="mt-1 font-semibold text-[#E5E7EB]">{summary.subtotal}</p>
        </div>
        <div>
          <p className="text-[13px] text-[#6B7280]">Payment terms</p>
          <p className="mt-1 font-semibold text-[#E5E7EB]">
            {summary.paymentTerms}
          </p>
        </div>
        <div>
          <p className="text-[13px] text-[#6B7280]">Total</p>
          <p className="mt-1 font-semibold text-[#C4B5FD]">{summary.total}</p>
        </div>
      </div>
      {summary.notes ? (
        <div className="border-t border-[#243047] px-4 py-3 text-[13px] leading-5 text-[#9CA3AF]">
          <span className="font-medium text-[#C4B5FD]">Note · </span>
          {summary.notes}
        </div>
      ) : null}
    </div>
  )
}

function EvidenceSheet({
  preview,
  supplier,
  onClose,
}: {
  preview: PreviewTarget | null
  supplier?: Supplier
  onClose: () => void
}) {
  const open = Boolean(preview)

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <SheetContent
        side="right"
        className="!max-w-xl border-l border-[#243047] bg-[#0B1220] text-[#E5E7EB] sm:!max-w-xl"
      >
        {preview ? (
          <EvidenceBody preview={preview} supplier={supplier} />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function EvidenceBody({
  preview,
  supplier,
}: {
  preview: PreviewTarget
  supplier?: Supplier
}) {
  const { message, invoice } = preview
  const type = message.attachmentType
  const fileUrl = fileUrlFor(message)

  const title = invoice
    ? `Invoice · ${invoice.invoiceNumber}`
    : message.attachmentLabel ?? "Attachment preview"
  const subtitle = invoice
    ? `${invoice.fileName} · ${invoice.sourceType} · ${invoice.fileSize}`
    : `${supplier?.name ?? message.author} · ${type ?? "attachment"}`

  return (
    <>
      <SheetHeader className="border-b border-[#243047] px-5 pb-4 pt-5">
        <SheetTitle className="text-[18px] font-semibold text-[#E5E7EB]">
          {title}
        </SheetTitle>
        <SheetDescription className="text-[13px] text-[#9CA3AF]">
          {subtitle}
        </SheetDescription>
      </SheetHeader>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-6 pt-4">
        {fileUrl && (type === "image" || type === "screenshot") ? (
          <ImagePreviewBody message={message} />
        ) : null}

        {fileUrl && type === "pdf" ? (
          <PdfPreviewBody message={message} />
        ) : null}

        {invoice ? (
          <InvoiceDocumentPreview invoice={invoice} supplier={supplier} />
        ) : null}

        {!fileUrl && (type === "image" || type === "screenshot") ? (
          <ImagePreviewBody message={message} />
        ) : null}

        {!fileUrl && type === "pdf" && !invoice ? (
          <PdfPreviewBody message={message} />
        ) : null}

        {type === "voice" ? <VoicePreviewBody message={message} /> : null}

        {type === "email" ? (
          <EmailPreviewBody message={message} supplier={supplier} />
        ) : null}

        <EvidenceMetaCard message={message} />
      </div>
    </>
  )
}

function EvidenceMetaCard({ message }: { message: NegotiationMessage }) {
  return (
    <div className="rounded-[12px] border border-[#243047] bg-[#111827] p-4">
      <p className="text-[13px] font-medium uppercase tracking-wider text-[#9CA3AF]">
        Source message
      </p>
      <p className="mt-2 text-[14px] leading-6 text-[#E5E7EB]">
        {message.body}
      </p>
      {message.translation ? (
        <div className="mt-3 rounded-[10px] border border-dashed border-[#8B5CF6]/30 bg-[#8B5CF6]/5 p-3">
          <p className="text-[13px] font-medium uppercase tracking-wider text-[#C4B5FD]">
            Z.AI translation
          </p>
          <p className="mt-1 text-[13px] leading-5 text-[#9CA3AF]">
            {message.translation}
          </p>
        </div>
      ) : null}
    </div>
  )
}

function ImagePreviewBody({ message }: { message: NegotiationMessage }) {
  const fileUrl = fileUrlFor(message)

  return (
    <div className="rounded-[12px] border border-[#243047] bg-[#0F1728] p-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[10px] border border-[#243047] bg-[linear-gradient(135deg,#172033,#111827_40%,#243047_80%,#1F2A44)] flex items-center justify-center">
        {fileUrl ? (
           <img src={fileUrl} alt={message.attachmentLabel || "Preview"} className="w-full h-full object-contain bg-black/40" />
        ) : (
          <div className="absolute inset-x-6 bottom-5 flex flex-col gap-2">
            <span className="h-3 w-2/3 rounded bg-[#334155]/60" />
            <span className="h-3 w-1/2 rounded bg-[#334155]/60" />
            <span className="h-3 w-3/4 rounded bg-[#334155]/60" />
          </div>
        )}
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
        <div className="absolute inset-x-4 top-4 flex items-center justify-between text-[13px] text-white z-10 font-medium drop-shadow-md">
          <span className="truncate max-w-[70%]">{message.attachmentLabel || "Image Attachment"}</span>
          <span className="font-mono bg-black/40 px-2 py-1 rounded">IMAGE</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[13px] text-[#9CA3AF]">
        <span>Auto-detected: Document metadata</span>
        <span>Confidence: High</span>
      </div>
    </div>
  )
}

function PdfPreviewBody({ message }: { message: NegotiationMessage }) {
  const fileUrl = fileUrlFor(message)

  return (
    <div className="rounded-[12px] border border-[#243047] bg-[#0F1728] p-4">
      {fileUrl ? (
        <div className="w-full aspect-[1/1.414] rounded-[10px] overflow-hidden border border-[#243047] bg-white">
          <iframe
            src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0`}
            className="w-full h-full border-none"
            title="PDF Preview"
          />
        </div>
      ) : (
        <div className="space-y-3">
          {[0, 1].map((index) => (
            <div
              key={index}
              className="rounded-[10px] border border-[#243047] bg-[#F8FAFC] p-5 text-[#111827]"
            >
              <div className="mb-4 flex items-center justify-between border-b border-[#CBD5E1] pb-2">
                <span className="text-[13px] font-semibold uppercase tracking-wider">
                  {message.attachmentLabel ?? "Document"} · page {index + 1}
                </span>
                <span className="text-[12px] text-[#64748B]">A4</span>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-3/4 rounded bg-[#CBD5E1]" />
                <div className="h-3 w-2/3 rounded bg-[#CBD5E1]" />
                <div className="h-3 w-5/6 rounded bg-[#CBD5E1]" />
                <div className="h-3 w-1/2 rounded bg-[#CBD5E1]" />
                <div className="mt-4 h-3 w-1/3 rounded bg-[#CBD5E1]" />
                <div className="h-3 w-4/5 rounded bg-[#CBD5E1]" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function VoicePreviewBody({ message }: { message: NegotiationMessage }) {
  const [playing, setPlaying] = useState(false)

  const transcriptSegments = [
    {
      time: "00:02",
      text: "We can add the rice to the protein bar truck.",
      tag: null,
    },
    {
      time: "00:06",
      text: "Maybe Apr 25, or maybe Apr 30 — let me confirm with logistics.",
      tag: "Delivery conflict",
    },
    {
      time: "00:11",
      text: "Price stays at sixteen ten if full pallet is committed.",
      tag: "Conditional price",
    },
    {
      time: "00:16",
      text: "Bundle discount will need a supervisor review on our side.",
      tag: "Missing field",
    },
  ]

  return (
    <div className="rounded-[12px] border border-[#243047] bg-[#0F1728] p-4">
      <div className="flex items-center gap-3 rounded-[10px] border border-[#243047] bg-[#172033] px-3 py-3">
        <Button
          type="button"
          onClick={() => setPlaying((value) => !value)}
          className="h-9 w-9 rounded-full bg-[#8B5CF6] p-0 text-white hover:bg-[#7C3AED]"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <Pause className="size-4" aria-hidden="true" />
          ) : (
            <Play className="size-4" aria-hidden="true" />
          )}
        </Button>
        <div className="flex-1">
          <p className="text-[13px] font-medium text-[#E5E7EB]">
            {message.attachmentLabel ?? "voice-note.m4a"}
          </p>
          <div className="mt-2 flex h-8 items-end gap-0.5">
            {[
              4, 7, 5, 9, 6, 12, 8, 10, 5, 13, 7, 11, 4, 9, 6, 10, 6, 4, 8, 5,
              11, 7, 9, 6, 4, 12, 8, 10, 5, 7,
            ].map((height, index) => (
              <motion.span
                key={index}
                className="w-0.5 rounded-full bg-[#8B5CF6]/70"
                animate={{
                  scaleY: playing ? [1, 1.6, 0.9, 1.3, 1] : 1,
                }}
                transition={{
                  duration: 1.4,
                  repeat: playing ? Infinity : 0,
                  delay: index * 0.03,
                }}
                style={{ height: `${height * 2}px`, originY: 1 }}
              />
            ))}
          </div>
        </div>
        <span className="font-mono text-[13px] text-[#9CA3AF]">00:22</span>
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-[13px] font-medium uppercase tracking-wider text-[#9CA3AF]">
          Transcript
        </p>
        {transcriptSegments.map((segment) => (
          <div
            key={segment.time}
            className="flex gap-3 rounded-[10px] border border-[#243047] bg-[#111827] p-3"
          >
            <span className="font-mono text-[13px] text-[#6B7280]">
              {segment.time}
            </span>
            <div className="flex-1">
              <p className="text-[14px] leading-5 text-[#E5E7EB]">
                {segment.text}
              </p>
              {segment.tag ? (
                <span className="mt-1 inline-flex items-center rounded-[6px] border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 px-1.5 py-0.5 text-[12px] font-medium text-[#C4B5FD]">
                  {segment.tag}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmailPreviewBody({
  message,
  supplier,
}: {
  message: NegotiationMessage
  supplier?: Supplier
}) {
  return (
    <div className="rounded-[12px] border border-[#243047] bg-[#0F1728] p-4">
      <div className="rounded-[10px] border border-[#243047] bg-[#F8FAFC] p-4 text-[#111827]">
        <div className="space-y-1 border-b border-[#E2E8F0] pb-2 text-[13px]">
          <p>
            <span className="font-semibold">From:</span>{" "}
            {supplier?.name ?? "Supplier"} &lt;sales@supplier.example&gt;
          </p>
          <p>
            <span className="font-semibold">To:</span> procurement@bee2bee.example
          </p>
          <p>
            <span className="font-semibold">Subject:</span>{" "}
            {message.attachmentLabel ?? "Re: Replenishment terms"}
          </p>
        </div>
        <p className="mt-3 text-[13px] leading-5">{message.body}</p>
      </div>
    </div>
  )
}

function InvoiceDocumentPreview({
  invoice,
  supplier,
}: {
  invoice: Invoice
  supplier?: Supplier
}) {
  return (
    <div className="rounded-[12px] border border-[#243047] bg-[#0F1728] p-4">
      <div className="rounded-[10px] border border-[#243047] bg-[#F8FAFC] p-5 text-[#111827]">
        <div className="mb-4 flex items-start justify-between border-b border-[#CBD5E1] pb-3">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-wider text-[#64748B]">
              Invoice
            </p>
            <p className="text-[18px] font-semibold">
              {invoice.invoiceNumber}
            </p>
          </div>
          <div className="text-right text-[13px] text-[#64748B]">
            <p>{supplier?.name ?? "Supplier"}</p>
            <p>Due {invoice.dueDate}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <div>
            <p className="text-[#64748B]">Bill to</p>
            <p className="font-semibold">Bee2Bee Procurement</p>
          </div>
          <div className="text-right">
            <p className="text-[#64748B]">Payment terms</p>
            <p className="font-semibold">{invoice.paymentTerms}</p>
          </div>
        </div>
        <div className="mt-4 border-t border-[#CBD5E1] pt-3">
          <div className="grid grid-cols-[1fr_80px_110px] gap-2 border-b border-[#CBD5E1] pb-1.5 text-[12px] font-semibold uppercase tracking-wider text-[#64748B]">
            <span>Item</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Amount</span>
          </div>
          <div className="grid grid-cols-[1fr_80px_110px] gap-2 border-b border-[#E2E8F0] py-2 text-[13px]">
            <span>{invoice.linkedSkus.join(", ")}</span>
            <span className="text-right">
              {invoice.invoiceQuantity.toLocaleString("en-US")}
            </span>
            <span className="text-right">
              {invoice.currency} {invoice.subtotal.toLocaleString("en-US")}
            </span>
          </div>
          <div className="mt-2 flex justify-end gap-6 text-[13px]">
            <span className="text-[#64748B]">Total</span>
            <span className="font-semibold">
              {invoice.currency} {invoice.amount.toLocaleString("en-US")}
            </span>
          </div>
        </div>
        <div className="mt-4 rounded-[8px] bg-[#F1F5F9] p-3 text-[12px] text-[#64748B]">
          Remit to: {invoice.bankDetails}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[13px] text-[#9CA3AF]">
        <span>Validation: {invoice.validationStatus}</span>
        <span>Confidence: {invoice.riskConfidence}%</span>
      </div>
    </div>
  )
}
