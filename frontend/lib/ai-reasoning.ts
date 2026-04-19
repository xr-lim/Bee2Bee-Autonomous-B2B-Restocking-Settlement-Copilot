import type { ReasoningSignal } from "@/components/shared/ai-reasoning-trail"
import type {
  Conversation,
  Invoice,
  NegotiationMessage,
  Product,
  Supplier,
  ThresholdChangeRequest,
} from "@/lib/types"

export function buildThresholdReasoning(
  request: ThresholdChangeRequest,
  product?: Product
): {
  signals: ReasoningSignal[]
  confidence: number
  decision: string
} {
  const signals: ReasoningSignal[] = []
  const delta = request.proposedThreshold - request.currentThreshold
  const direction = delta >= 0 ? "raise" : "lower"
  const directionLabel =
    delta >= 0 ? "Raise threshold" : "Reduce threshold"

  signals.push({
    kind: delta >= 0 ? "velocity-up" : "velocity-down",
    label: `${directionLabel} by ${Math.abs(delta)} units`,
    detail: `Z.AI proposes ${request.currentThreshold} → ${request.proposedThreshold} (${
      request.changePercent >= 0 ? "+" : ""
    }${request.changePercent}%).`,
    tone: delta >= 0 ? "risk" : "positive",
  })

  switch (request.trigger) {
    case "demand-spike":
      signals.push({
        kind: "promotion",
        label: "Demand spike detected",
        detail:
          "Forecast demand trending above baseline — Z.AI attributes this to a seasonal or promo uplift signal.",
        tone: "risk",
      })
      break
    case "demand-drop":
      signals.push({
        kind: "velocity-down",
        label: "30D velocity dropped",
        detail:
          "Sell-through slowed post-promo; lowering threshold frees working capital with no stockout risk.",
        tone: "positive",
      })
      break
    case "lead-time-shift":
      signals.push({
        kind: "lead-time",
        label: "Supplier lead time slipped",
        detail:
          "Primary supplier lead time stretched — threshold must cover the extra buffer days.",
        tone: "risk",
      })
      break
    case "bundle-opportunity":
      signals.push({
        kind: "bundle",
        label: "Bundle window with primary supplier",
        detail:
          "Raising threshold unlocks a same-supplier pallet discount on an adjacent SKU.",
        tone: "ai",
      })
      break
    case "new-product":
      signals.push({
        kind: "signal",
        label: "New product bootstrap",
        detail:
          "Merchant-supplied initial threshold is being tuned using category priors; awaiting 2 weeks of live signal.",
        tone: "ai",
      })
      break
  }

  if (product) {
    if (product.stockOnHand < product.aiThreshold) {
      const gap = product.aiThreshold - product.stockOnHand
      signals.push({
        kind: "stockout",
        label: "Stockout risk present",
        detail: `Current stock ${product.stockOnHand} sits ${gap} units under the existing AI threshold.`,
        tone: "risk",
      })
    }

    if (product.trend30d !== 0) {
      signals.push({
        kind: product.trend30d >= 0 ? "velocity-up" : "velocity-down",
        label: `30-day trend ${product.trend30d >= 0 ? "+" : ""}${product.trend30d}%`,
        detail:
          product.trend30d >= 0
            ? "Velocity accelerating versus 30-day rolling baseline."
            : "Velocity decelerating versus 30-day rolling baseline.",
        tone: product.trend30d >= 0 ? "risk" : "positive",
      })
    }

    if (product.suppliers && product.suppliers.length > 1) {
      const preferred =
        product.suppliers.find((option) => option.preferred) ??
        product.suppliers[0]
      signals.push({
        kind: "lead-time",
        label: `Preferred supplier lead time ${preferred.leadTimeDays}d`,
        detail: `Z.AI weighs ${product.suppliers.length} supplier options; preferred lead time drives the buffer calculation.`,
        tone: "neutral",
      })
    }
  }

  const confidence = computeThresholdConfidence(request, product)
  const decision = `${directionLabel} from ${request.currentThreshold} to ${request.proposedThreshold}. Trigger: ${formatTriggerLabel(
    request.trigger
  )}.`

  void direction
  return { signals, confidence, decision }
}

function computeThresholdConfidence(
  request: ThresholdChangeRequest,
  product?: Product
) {
  let base = 78
  if (request.trigger === "demand-spike") base += 6
  if (request.trigger === "lead-time-shift") base += 8
  if (request.trigger === "bundle-opportunity") base += 4
  if (request.trigger === "demand-drop") base += 5
  if (request.trigger === "new-product") base -= 18
  if (product && Math.abs(product.trend30d) > 20) base += 3
  return Math.max(42, Math.min(97, base))
}

function formatTriggerLabel(trigger: ThresholdChangeRequest["trigger"]) {
  switch (trigger) {
    case "demand-spike":
      return "Demand spike"
    case "demand-drop":
      return "Demand drop"
    case "lead-time-shift":
      return "Supplier lead time shift"
    case "bundle-opportunity":
      return "Bundle opportunity"
    case "new-product":
      return "New product bootstrap"
  }
}

export function buildInvoiceReasoning(
  invoice: Invoice,
  supplier?: Supplier
): {
  signals: ReasoningSignal[]
  confidence: number
  decision: string
} {
  const signals: ReasoningSignal[] = []
  const variance = invoice.amount - invoice.negotiatedAmount

  if (invoice.flags.amountMismatch || variance > 0) {
    signals.push({
      kind: "price",
      label: `Amount variance ${variance >= 0 ? "+" : ""}${invoice.currency} ${variance.toLocaleString(
        "en-US"
      )}`,
      detail: `Invoice ${invoice.currency} ${invoice.amount.toLocaleString(
        "en-US"
      )} vs negotiated ${invoice.currency} ${invoice.negotiatedAmount.toLocaleString("en-US")}.`,
      tone: variance > 0 ? "risk" : "positive",
    })
  } else {
    signals.push({
      kind: "price",
      label: "Amount matches negotiated",
      detail: `Invoice total aligns with negotiated amount of ${invoice.currency} ${invoice.negotiatedAmount.toLocaleString(
        "en-US"
      )}.`,
      tone: "positive",
    })
  }

  if (invoice.expectedQuantity !== invoice.invoiceQuantity) {
    signals.push({
      kind: "field",
      label: "Quantity mismatch",
      detail: `Expected ${invoice.expectedQuantity.toLocaleString(
        "en-US"
      )}, invoice shows ${invoice.invoiceQuantity.toLocaleString("en-US")}.`,
      tone: "risk",
    })
  } else {
    signals.push({
      kind: "field",
      label: "Quantity matches PO",
      detail: `Invoice quantity ${invoice.invoiceQuantity.toLocaleString(
        "en-US"
      )} equals expected.`,
      tone: "positive",
    })
  }

  if (invoice.flags.bankDetailsIssue) {
    signals.push({
      kind: "signal",
      label: "Bank details diverge from master",
      detail: `Remittance ${invoice.bankDetails} does not match supplier master on file${
        supplier ? ` for ${supplier.name}` : ""
      }.`,
      tone: "risk",
    })
  }

  if (invoice.flags.missingFields) {
    signals.push({
      kind: "field",
      label: "Missing fields detected",
      detail:
        invoice.mismatches.length > 0
          ? invoice.mismatches.join(" · ")
          : "Required invoice fields were not populated.",
      tone: "risk",
    })
  }

  if (invoice.flags.supplierInconsistency) {
    signals.push({
      kind: "signal",
      label: "Supplier identity inconsistent",
      detail: "Supplier profile on the invoice conflicts with the PO header.",
      tone: "risk",
    })
  }

  if (invoice.sourceType === "Image") {
    signals.push({
      kind: "history",
      label: "Source is an image scan",
      detail:
        "OCR was applied before structured fields were extracted; confidence is slightly lower than digital PDF sources.",
      tone: "neutral",
    })
  }

  signals.push({
    kind: "history",
    label: `Validation outcome: ${invoice.validationStatus}`,
    detail: invoice.riskReason,
    tone:
      invoice.validationStatus === "Validated"
        ? "positive"
        : invoice.validationStatus === "Mismatch Detected"
          ? "risk"
          : "neutral",
  })

  const decision = `Risk classified as ${invoice.riskLevel.toLowerCase()} → ${invoice.approvalState}. ${invoice.riskReason}`

  return { signals, confidence: invoice.riskConfidence, decision }
}

export function buildConversationReasoning(
  conversation: Conversation,
  products: Product[]
): {
  signals: ReasoningSignal[]
  confidence: number
  decision: string
} {
  const signals: ReasoningSignal[] = []

  signals.push({
    kind: "field",
    label: `Extracted price: ${conversation.aiExtraction.extractedPrice}`,
    detail: `Target range on file is ${conversation.targetPriceRange}.`,
    tone: priceTone(conversation),
  })

  signals.push({
    kind: "field",
    label: `Extracted quantity: ${conversation.aiExtraction.extractedQuantity}`,
    detail: `Intent detected: ${conversation.aiExtraction.detectedIntent}.`,
    tone: "neutral",
  })

  signals.push({
    kind: "lead-time",
    label: `Delivery estimate: ${conversation.aiExtraction.deliveryEstimate}`,
    detail:
      conversation.aiExtraction.deliveryEstimate.toLowerCase().includes("or")
        ? "Supplier proposed multiple delivery dates — Z.AI flagged the conflict for operator review."
        : "Single delivery date confirmed; no scheduling conflict detected.",
    tone: conversation.aiExtraction.deliveryEstimate
      .toLowerCase()
      .includes("or")
      ? "risk"
      : "positive",
  })

  if (
    conversation.aiExtraction.supplierLanguage.toLowerCase() !== "english"
  ) {
    signals.push({
      kind: "language",
      label: `Supplier language: ${conversation.aiExtraction.supplierLanguage}`,
      detail:
        "Z.AI auto-translated the thread before extracting fields; both sides continue in the supplier's language.",
      tone: "ai",
    })
  }

  if (conversation.aiExtraction.missingFields.length > 0) {
    signals.push({
      kind: "signal",
      label: `Missing fields (${conversation.aiExtraction.missingFields.length})`,
      detail: conversation.aiExtraction.missingFields.join(" · "),
      tone: "risk",
    })
  }

  products.forEach((product) => {
    if (product.stockOnHand < product.aiThreshold) {
      const gap = product.aiThreshold - product.stockOnHand
      signals.push({
        kind: "stockout",
        label: `${product.name} ${gap} units below threshold`,
        detail: `Stock on hand ${product.stockOnHand} / AI threshold ${product.aiThreshold}. Stockout risk feeds urgency score.`,
        tone: "risk",
      })
    }
  })

  const decision = `${conversation.nextAction.recommendedNextStep}`

  return {
    signals,
    confidence: conversation.aiExtraction.confidenceScore,
    decision,
  }
}

function priceTone(conversation: Conversation): ReasoningSignal["tone"] {
  const priceMatch = conversation.aiExtraction.extractedPrice.match(
    /\$(\d+(?:\.\d+)?)/
  )
  const rangeMatch = conversation.targetPriceRange.match(
    /\$(\d+(?:\.\d+)?)\s*-\s*\$(\d+(?:\.\d+)?)/
  )
  if (!priceMatch || !rangeMatch) return "neutral"
  const extracted = Number(priceMatch[1])
  const floor = Number(rangeMatch[1])
  const ceiling = Number(rangeMatch[2])
  if (extracted > ceiling) return "risk"
  if (extracted >= floor) return "positive"
  return "ai"
}

export type ExtractionField =
  | "extractedPrice"
  | "extractedQuantity"
  | "deliveryEstimate"
  | "supplierLanguage"
  | "detectedIntent"
  | "missingFields"

export function getEvidenceSourceMessageId(
  messages: NegotiationMessage[],
  field: ExtractionField
): string | undefined {
  if (!messages.length) return undefined
  const supplierMessages = messages.filter(
    (message) => message.type === "supplier-message"
  )
  const aiMessages = messages.filter(
    (message) =>
      message.type === "ai-interpretation" ||
      message.type === "ai-recommendation"
  )

  switch (field) {
    case "extractedPrice":
    case "extractedQuantity":
      return (
        supplierMessages.find((message) => message.attachmentType)?.id ??
        supplierMessages[0]?.id
      )
    case "deliveryEstimate":
      return (
        supplierMessages.find(
          (message) =>
            message.attachmentType === "voice" ||
            /deliver|apr|ship|route|pallet/i.test(message.body)
        )?.id ?? supplierMessages[0]?.id
      )
    case "supplierLanguage":
      return (
        supplierMessages.find((message) => message.language && message.language !== "EN")?.id ??
        supplierMessages[0]?.id
      )
    case "detectedIntent":
      return aiMessages[0]?.id ?? supplierMessages[0]?.id
    case "missingFields":
      return (
        aiMessages.find((message) => /missing|freight|cap|confirm/i.test(message.body))?.id ??
        aiMessages[0]?.id
      )
    default:
      return supplierMessages[0]?.id
  }
}
