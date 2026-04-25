import "server-only"

export type InvoiceAnalysisIssue = {
  type:
    | "amount_mismatch"
    | "missing_field"
    | "bank_mismatch"
    | "suspicious_value"
    | "other"
  description: string
  severity: "low" | "medium" | "high"
}

export type InvoiceAnalysisParsedLineItem = {
  description: string | null
  unitPrice: number | null
  quantity: number | null
  lineTotal: number | null
}

export type InvoiceAnalysisParsedFields = {
  invoiceNumber: string | null
  supplierName: string | null
  amount: number | null
  currency: string | null
  quantity: number | null
  unitPrice: number | null
  subtotal: number | null
  paymentTerms: string | null
  bankDetails: string | null
  lineItems: InvoiceAnalysisParsedLineItem[]
}

export type InvoiceAnalysisResult = {
  parsedInvoiceFields: InvoiceAnalysisParsedFields
  riskLevel: "low" | "medium" | "high"
  issues: InvoiceAnalysisIssue[]
  summary: string
  confidence: number
  parserReliability?: "low" | "medium" | "high"
  rejectedValues?: string[]
}

export type InvoiceAnalysisLineItem = {
  productId: string
  sku: string
  quantity: number
  unitPrice: number
  subtotal: number
  baselineUnitPrice?: number | null
}

export type InvoiceAnalysisInvoiceData = {
  id: string
  invoiceNumber: string
  workflowId?: string | null
  supplierId?: string | null
  supplierName?: string | null
  sourceType: string
  currency: string
  amount: number
  quantity?: number | null
  paymentTerms?: string | null
  bankDetails?: string | null
  extractedTextSnippet?: string | null
  lineItems: InvoiceAnalysisLineItem[]
}

export type InvoiceAnalysisExpectedData = {
  workflowState?: string | null
  conversationState?: string | null
  expectedSupplierId?: string | null
  expectedSupplierName?: string | null
  expectedQuantity?: number | null
  targetUnitPriceMin?: number | null
  targetUnitPriceMax?: number | null
  expectedAmountMin?: number | null
  expectedAmountMax?: number | null
  expectedBankDetails?: string | null
  expectedPaymentTerms?: string | null
  referenceInvoiceNumber?: string | null
  latestQuotedUnitPrice?: number | null
  latestQuotedQuantity?: number | null
  unresolvedFields?: string[]
  supplierReliabilityScore?: number | null
}

const MONEY_REGEX =
  /(?:[A-Z]{3}|US\$|S\$|RM|RMB|CNH|CNY|JPY|GBP|EUR|THB|IDR|£|€|¥|\$)\s*\d[\d,]*(?:\.\d{2})?|\b\d[\d,]*\.\d{2}\b/gi
const FALLBACK_NOISE_LINE_REGEX =
  /\b(invoice|subtotal|sub total|grand total|total due|amount due|tax|discount|balance due|payment terms|bank|swift|account|iban|routing|paypal|invoice no|accnumber|acc holder|company name|invoice date)\b/i

function backendApiBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_BACKEND_API_URL ??
    process.env.BACKEND_API_URL ??
    "http://127.0.0.1:8000"
  ).replace(/\/$/, "")
}

function serializeDebugPayload(value: unknown) {
  try {
    return JSON.stringify(value)
  } catch {
    return "[unserializable]"
  }
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.82
  }

  const normalized = value > 1 ? value / 100 : value
  return Math.max(0, Math.min(1, normalized))
}

function cleanText(value?: string | null) {
  return value?.trim().toLowerCase() ?? ""
}

function compactSpaces(value?: string | null) {
  return value?.trim().replace(/\s+/g, " ") ?? ""
}

function normalizeWhitespace(value: string) {
  return value
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function parseNetDays(value?: string | null): number | null {
  if (!value) return null
  const match = value.match(/net\s+(\d+)/i)
  return match ? Number(match[1]) : null
}

function formatCurrency(value: number, currency: string) {
  return `${currency} ${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function actualQuantity(invoiceData: InvoiceAnalysisInvoiceData) {
  if (typeof invoiceData.quantity === "number") {
    return invoiceData.quantity
  }

  return invoiceData.lineItems.reduce((total, line) => total + line.quantity, 0)
}

function averageUnitPrice(invoiceData: InvoiceAnalysisInvoiceData) {
  const quantity = actualQuantity(invoiceData)
  if (!quantity) return null
  return invoiceData.amount / quantity
}

function addIssue(issues: InvoiceAnalysisIssue[], issue: InvoiceAnalysisIssue) {
  const normalizedDescription = cleanText(issue.description)
  const exists = issues.some(
    (item) =>
      item.type === issue.type &&
      cleanText(item.description) === normalizedDescription
  )

  if (!exists) {
    issues.push(issue)
  }
}

function toPositiveNumber(value: unknown) {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/,/g, "").trim())
        : Number.NaN

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null
  }

  return Math.round(numeric * 100) / 100
}

function isReasonableUnitPrice(value?: number | null) {
  return value != null && value >= 1 && value <= 10_000
}

function isReasonableQuantity(value?: number | null) {
  return value != null && value > 0 && value <= 100
}

function looksLikeMeaningfulDescription(value?: string | null) {
  const normalized = compactSpaces(value)
  if (!normalized || normalized.length < 4) return false
  if (!/[a-z]/i.test(normalized)) return false
  if (FALLBACK_NOISE_LINE_REGEX.test(normalized)) return false
  return true
}

function normalizeCurrency(value: unknown): InvoiceAnalysisParsedFields["currency"] {
  if (typeof value !== "string") return null
  const upper = value.trim().toUpperCase()
  if (!upper) return null
  if (upper === "$") return "USD"
  if (upper === "RM") return "MYR"
  if (upper === "S$") return "SGD"
  if (upper === "£") return "GBP"
  if (upper === "€") return "EUR"
  if (upper === "¥") return null
  if (upper === "RMB" || upper === "CNH") return "CNY"

  const codeMatch = upper.match(/\b([A-Z]{3})\b/)
  return codeMatch ? codeMatch[1] : null
}

function inferCurrencyFromText(value?: string | null): InvoiceAnalysisParsedFields["currency"] {
  const normalized = compactSpaces(value)
  if (!normalized) return null
  if (/\bEUR\b|€/i.test(normalized)) return "EUR"
  if (/\bGBP\b|£/i.test(normalized)) return "GBP"
  if (/\bJPY\b/i.test(normalized)) return "JPY"
  if (/\bCNY\b|\bRMB\b|\bCNH\b/i.test(normalized)) return "CNY"
  if (/\bTHB\b/i.test(normalized)) return "THB"
  if (/\bIDR\b/i.test(normalized)) return "IDR"
  if (/\bMYR\b|\bRM\b/i.test(normalized)) return "MYR"
  if (/\bSGD\b|\bS\$/i.test(normalized)) return "SGD"
  if (/\bUSD\b|\bUS\$/i.test(normalized) || normalized.includes("$")) return "USD"
  return null
}

function parseMoneyToken(
  token?: string | null,
  fallbackCurrency?: string | null
): { amount: number; currency: InvoiceAnalysisParsedFields["currency"] } | null {
  if (!token) return null

  const currency = inferCurrencyFromText(token) ?? normalizeCurrency(fallbackCurrency)
  const numericMatch = token.match(/\d[\d,]*(?:\.\d{2})?/)
  const amount = numericMatch ? toPositiveNumber(numericMatch[0]) : null

  if (amount == null) return null
  return {
    amount,
    currency,
  }
}

function parseLabeledMoney(
  text: string,
  labels: string[],
  fallbackCurrency?: string | null
) {
  for (const label of labels) {
    const regex = new RegExp(
      `${label}[^\\n\\dA-Z$RM£€¥]{0,20}((?:[A-Z]{3}|US\\$|S\\$|RM|£|€|¥|\\$)?\\s*\\d[\\d,]*(?:\\.\\d{2})?)`,
      "i"
    )
    const match = text.match(regex)
    if (!match) continue

    const parsed = parseMoneyToken(match[1], fallbackCurrency)
    if (parsed) {
      return parsed
    }
  }

  return null
}

function normalizeParsedLineItem(
  value: unknown
): InvoiceAnalysisParsedLineItem | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const item = value as Record<string, unknown>
  const description =
    typeof item.description === "string" && compactSpaces(item.description)
      ? compactSpaces(item.description)
      : null
  const unitPrice = toPositiveNumber(item.unitPrice)
  const quantity = toPositiveNumber(item.quantity)
  const lineTotal = toPositiveNumber(item.lineTotal)

  if (!description && unitPrice == null && quantity == null && lineTotal == null) {
    return null
  }

  return {
    description,
    unitPrice,
    quantity,
    lineTotal,
  }
}

function emptyParsedFields(): InvoiceAnalysisParsedFields {
  return {
    invoiceNumber: null,
    supplierName: null,
    amount: null,
    currency: null,
    quantity: null,
    unitPrice: null,
    subtotal: null,
    paymentTerms: null,
    bankDetails: null,
    lineItems: [],
  }
}

function parseInvoiceNumberFromText(text: string) {
  const patterns = [
    /\b(?:invoice\s*(?:no|number|#)|inv\s*(?:no|#))\s*[:#-]?\s*([A-Z0-9][A-Z0-9./-]{2,})/i,
    /\bno\.\s*([A-Z0-9][A-Z0-9./-]{2,})/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      return compactSpaces(match[1]).replace(/[.,]$/, "")
    }
  }

  return null
}

function parsePaymentTermsFromText(text: string) {
  const match = text.match(
    /\b(net\s*\d{1,3}|due\s+on\s+receipt|cash\s+on\s+delivery|cod|immediate payment)\b/i
  )
  return match ? compactSpaces(match[1]) : null
}

function parseBankDetailsFromText(text: string) {
  const lines = normalizeWhitespace(text)
    .split("\n")
    .map((line) => compactSpaces(line))
    .filter(Boolean)

  const bankStartIndex = lines.findIndex((line) =>
    /\b(bank|beneficiary|account|acc(?:ount)?\s*(?:no|number)?|iban|swift|routing)\b/i.test(
      line
    )
  )

  if (bankStartIndex === -1) {
    return null
  }

  const bankLines = [lines[bankStartIndex]]
  for (let index = bankStartIndex + 1; index < lines.length && bankLines.length < 4; index += 1) {
    const line = lines[index]
    if (
      /\b(bank|beneficiary|account|acc(?:ount)?\s*(?:no|number)?|iban|swift|routing)\b/i.test(
        line
      ) ||
      /^[A-Z0-9 -]{6,}$/i.test(line)
    ) {
      bankLines.push(line)
      continue
    }

    break
  }

  return bankLines.join(" | ")
}

function parseSupplierNameFromText(text: string) {
  const normalized = normalizeWhitespace(text)
  const lines = normalized
    .split("\n")
    .map((line) => compactSpaces(line))
    .filter(Boolean)

  const labeledPatterns = [
    /\b(?:supplier|vendor|from|remit to)\s*[:#-]?\s*([A-Z][A-Z0-9&.,'()\/ -]{2,})/i,
  ]

  for (const pattern of labeledPatterns) {
    const match = normalized.match(pattern)
    if (match?.[1]) {
      return compactSpaces(match[1])
    }
  }

  const fallbackLine = lines.find((line, index) => {
    if (index > 5) return false
    return (
      /[a-z]/i.test(line) &&
      !/\b(invoice|date|bill to|ship to|payment terms|grand total|subtotal|amount due)\b/i.test(
        line
      ) &&
      line.length >= 4
    )
  })

  return fallbackLine ?? null
}

function parseLineItemsFromText(
  text: string,
  fallbackCurrency?: string | null
): InvoiceAnalysisParsedLineItem[] {
  const lines = normalizeWhitespace(text)
    .split("\n")
    .map((line) => compactSpaces(line))
    .filter(Boolean)

  const items: InvoiceAnalysisParsedLineItem[] = []

  for (const line of lines) {
    if (FALLBACK_NOISE_LINE_REGEX.test(line)) {
      continue
    }

    const moneyMatches = [...line.matchAll(MONEY_REGEX)]
    const parsedMoney = moneyMatches
      .map((match) => parseMoneyToken(match[0], fallbackCurrency))
      .filter(
        (
          item
        ): item is { amount: number; currency: InvoiceAnalysisParsedFields["currency"] } =>
          Boolean(item)
      )

    if (parsedMoney.length < 2) {
      continue
    }

    const unitPrice = parsedMoney[0]?.amount ?? null
    const lineTotal = parsedMoney.at(-1)?.amount ?? null
    if (!isReasonableUnitPrice(unitPrice) || lineTotal == null) {
      continue
    }

    const firstMoneyIndex = moneyMatches[0]?.index ?? 0
    const firstMoneyEnd =
      firstMoneyIndex + (moneyMatches[0]?.[0]?.length ?? 0)
    const lastMoneyIndex = moneyMatches.at(-1)?.index ?? firstMoneyIndex
    const description = compactSpaces(line.slice(0, firstMoneyIndex)) || null
    if (!looksLikeMeaningfulDescription(description)) {
      continue
    }

    const quantitySegment = line.slice(firstMoneyEnd, lastMoneyIndex)
    const quantityMatches = [
      ...quantitySegment.matchAll(/\b\d{1,4}\b/g),
    ].map((match) => Number(match[0]))

    if (quantityMatches.length !== 1) {
      continue
    }

    const quantity = quantityMatches[0]
    if (!isReasonableQuantity(quantity)) {
      continue
    }

    if (
      Math.abs(unitPrice * quantity - lineTotal) >
      Math.max(1, lineTotal * 0.05)
    ) {
      continue
    }

    items.push({
      description,
      unitPrice,
      quantity,
      lineTotal,
    })
  }

  return items
}

type FallbackParsedFieldsAssessment = {
  parsedFields: InvoiceAnalysisParsedFields
  reliability: "low" | "medium" | "high"
  rejectedValues: string[]
}

function assessFallbackParsedFields(
  invoiceData: InvoiceAnalysisInvoiceData,
  expectedData: InvoiceAnalysisExpectedData,
  parsedFields: InvoiceAnalysisParsedFields
): FallbackParsedFieldsAssessment {
  const rejectedValues: string[] = []

  const trustedLineItems = parsedFields.lineItems.filter((item, index) => {
    const isReasonable =
      looksLikeMeaningfulDescription(item.description) &&
      isReasonableUnitPrice(item.unitPrice) &&
      isReasonableQuantity(item.quantity) &&
      item.lineTotal != null &&
      Math.abs((item.unitPrice ?? 0) * (item.quantity ?? 0) - item.lineTotal) <=
        Math.max(1, item.lineTotal * 0.05)

    if (!isReasonable) {
      rejectedValues.push(`Rejected fallback line item ${index + 1} as OCR noise.`)
    }

    return isReasonable
  })

  let trustedQuantity =
    trustedLineItems.length > 0
      ? trustedLineItems.reduce((total, item) => total + (item.quantity ?? 0), 0)
      : null

  if (
    trustedQuantity != null &&
    expectedData.expectedQuantity != null &&
    trustedQuantity > 100 &&
    trustedQuantity > expectedData.expectedQuantity * 2
  ) {
    rejectedValues.push(
      `Rejected fallback quantity ${trustedQuantity} because it is far above expected quantity ${expectedData.expectedQuantity}.`
    )
    trustedQuantity = null
  }

  const trustedUnitPrice = (() => {
    const candidate =
      trustedLineItems[0]?.unitPrice ?? parsedFields.unitPrice ?? null
    if (!isReasonableUnitPrice(candidate)) {
      if (candidate != null) {
        rejectedValues.push(
          `Rejected fallback unit price ${candidate} because it is outside the allowed range.`
        )
      }
      return null
    }
    return candidate
  })()

  const trustedBankDetails =
    parsedFields.bankDetails &&
    /\b(bank|beneficiary|account|acc(?:ount)?|iban|swift|routing)\b/i.test(
      parsedFields.bankDetails
    )
      ? parsedFields.bankDetails
      : null

  if (parsedFields.bankDetails && !trustedBankDetails) {
    rejectedValues.push(
      "Rejected fallback bank details because they did not contain enough remittance markers."
    )
  }

  const trustedSubtotal =
    parsedFields.subtotal != null && parsedFields.subtotal > 0
      ? parsedFields.subtotal
      : trustedLineItems.length > 0
        ? trustedLineItems.reduce((total, item) => total + (item.lineTotal ?? 0), 0)
        : null

  const trustedAmount =
    parsedFields.amount != null && parsedFields.amount > 0
      ? parsedFields.amount
      : trustedSubtotal

  const sanitizedParsedFields: InvoiceAnalysisParsedFields = {
    invoiceNumber: parsedFields.invoiceNumber,
    supplierName: looksLikeMeaningfulDescription(parsedFields.supplierName)
      ? parsedFields.supplierName
      : null,
    amount: trustedAmount,
    currency: parsedFields.currency,
    quantity: trustedQuantity,
    unitPrice: trustedUnitPrice,
    subtotal: trustedSubtotal,
    paymentTerms: parsedFields.paymentTerms,
    bankDetails: trustedBankDetails,
    lineItems: trustedLineItems,
  }

  let reliabilityScore = 0
  if (sanitizedParsedFields.amount != null) reliabilityScore += 2
  if (sanitizedParsedFields.quantity != null) reliabilityScore += 2
  if (trustedLineItems.length > 0) reliabilityScore += 2
  if (sanitizedParsedFields.bankDetails) reliabilityScore += 1
  if (sanitizedParsedFields.paymentTerms) reliabilityScore += 1
  if (rejectedValues.length > 0) reliabilityScore -= 2
  if (!trustedLineItems.length && parsedFields.lineItems.length > 0) reliabilityScore -= 1
  if (
    expectedData.expectedQuantity != null &&
    sanitizedParsedFields.quantity != null &&
    sanitizedParsedFields.quantity > 100 &&
    sanitizedParsedFields.quantity > expectedData.expectedQuantity * 2
  ) {
    reliabilityScore -= 2
  }

  const reliability =
    reliabilityScore >= 5 ? "high" : reliabilityScore >= 3 ? "medium" : "low"

  console.info(
    "[Invoice Fallback] Assessed parsed fields",
    serializeDebugPayload({
      invoiceId: invoiceData.id,
      reliability,
      parsedFields: sanitizedParsedFields,
      rejectedValues,
    })
  )

  return {
    parsedFields: sanitizedParsedFields,
    reliability,
    rejectedValues,
  }
}

function inferParsedFieldsFromExtractedText(
  invoiceData: InvoiceAnalysisInvoiceData
): InvoiceAnalysisParsedFields {
  const text = normalizeWhitespace(invoiceData.extractedTextSnippet ?? "")
  if (!text) {
    return emptyParsedFields()
  }

  const currencyHint = inferCurrencyFromText(text) ?? normalizeCurrency(invoiceData.currency)
  const lineItems = parseLineItemsFromText(text, currencyHint)
  const subtotalFromLines = lineItems.reduce(
    (total, line) => total + (line.lineTotal ?? 0),
    0
  )
  const quantityFromLines = lineItems.reduce(
    (total, line) => total + (line.quantity ?? 0),
    0
  )
  const labeledTotal = parseLabeledMoney(
    text,
    ["grand total", "total due", "amount due", "invoice total", "balance due", "total"],
    currencyHint
  )
  const labeledSubtotal = parseLabeledMoney(
    text,
    ["sub total", "subtotal"],
    currencyHint
  )

  const unitPrice =
    lineItems.find((line) => line.unitPrice != null)?.unitPrice ??
    (quantityFromLines > 0 && labeledSubtotal?.amount
      ? Math.round((labeledSubtotal.amount / quantityFromLines) * 100) / 100
      : null)

  return {
    invoiceNumber: parseInvoiceNumberFromText(text),
    supplierName: parseSupplierNameFromText(text),
    amount: labeledTotal?.amount ?? (subtotalFromLines > 0 ? subtotalFromLines : null),
    currency:
      labeledTotal?.currency ??
      labeledSubtotal?.currency ??
      currencyHint ??
      normalizeCurrency(invoiceData.currency),
    quantity:
      quantityFromLines > 0
        ? quantityFromLines
        : lineItems.length === 0
          ? null
          : null,
    unitPrice,
    subtotal:
      labeledSubtotal?.amount ?? (subtotalFromLines > 0 ? subtotalFromLines : null),
    paymentTerms: parsePaymentTermsFromText(text),
    bankDetails: parseBankDetailsFromText(text),
    lineItems,
  }
}

function normalizeParsedFields(
  value: unknown,
  fallbackCurrency?: string | null
): InvoiceAnalysisParsedFields {
  if (!value || typeof value !== "object") {
    return emptyParsedFields()
  }

  const fields = value as Record<string, unknown>
  const lineItems = Array.isArray(fields.lineItems)
    ? fields.lineItems
        .map((item) => normalizeParsedLineItem(item))
        .filter((item): item is InvoiceAnalysisParsedLineItem => Boolean(item))
    : []

  return {
    invoiceNumber:
      typeof fields.invoiceNumber === "string" && compactSpaces(fields.invoiceNumber)
        ? compactSpaces(fields.invoiceNumber)
        : null,
    supplierName:
      typeof fields.supplierName === "string" && compactSpaces(fields.supplierName)
        ? compactSpaces(fields.supplierName)
        : null,
    amount: toPositiveNumber(fields.amount),
    currency:
      normalizeCurrency(fields.currency) ?? normalizeCurrency(fallbackCurrency) ?? null,
    quantity: toPositiveNumber(fields.quantity),
    unitPrice: toPositiveNumber(fields.unitPrice),
    subtotal: toPositiveNumber(fields.subtotal),
    paymentTerms:
      typeof fields.paymentTerms === "string" && compactSpaces(fields.paymentTerms)
        ? compactSpaces(fields.paymentTerms)
        : null,
    bankDetails:
      typeof fields.bankDetails === "string" && compactSpaces(fields.bankDetails)
        ? compactSpaces(fields.bankDetails)
        : null,
    lineItems,
  }
}

function mergeParsedFields(
  primary: InvoiceAnalysisParsedFields,
  secondary: InvoiceAnalysisParsedFields
): InvoiceAnalysisParsedFields {
  return {
    invoiceNumber: primary.invoiceNumber ?? secondary.invoiceNumber,
    supplierName: primary.supplierName ?? secondary.supplierName,
    amount: primary.amount ?? secondary.amount,
    currency: primary.currency ?? secondary.currency,
    quantity: primary.quantity ?? secondary.quantity,
    unitPrice: primary.unitPrice ?? secondary.unitPrice,
    subtotal: primary.subtotal ?? secondary.subtotal,
    paymentTerms: primary.paymentTerms ?? secondary.paymentTerms,
    bankDetails: primary.bankDetails ?? secondary.bankDetails,
    lineItems:
      primary.lineItems.length > 0
        ? primary.lineItems.map((item, index) => ({
            description: item.description ?? secondary.lineItems[index]?.description ?? null,
            unitPrice: item.unitPrice ?? secondary.lineItems[index]?.unitPrice ?? null,
            quantity: item.quantity ?? secondary.lineItems[index]?.quantity ?? null,
            lineTotal: item.lineTotal ?? secondary.lineItems[index]?.lineTotal ?? null,
          }))
        : secondary.lineItems,
  }
}

export function applyParsedFieldsToInvoiceData(
  invoiceData: InvoiceAnalysisInvoiceData,
  parsedFields: InvoiceAnalysisParsedFields
): InvoiceAnalysisInvoiceData {
  const repairedCurrency =
    parsedFields.currency ?? normalizeCurrency(invoiceData.currency) ?? "USD"
  const parsedLineItems = parsedFields.lineItems.filter(
    (item) =>
      item.quantity != null ||
      item.unitPrice != null ||
      item.lineTotal != null ||
      item.description != null
  )

  const lineItems =
    parsedLineItems.length > 0
      ? parsedLineItems.map((item, index) => {
          const currentLine = invoiceData.lineItems[index]
          return {
            productId: currentLine?.productId ?? `parsed-line-${index + 1}`,
            sku:
              currentLine?.sku ??
              item.description ??
              `Parsed line ${index + 1}`,
            quantity:
              item.quantity != null
                ? Number(item.quantity)
                : currentLine?.quantity ?? 0,
            unitPrice:
              item.unitPrice != null
                ? Number(item.unitPrice)
                : currentLine?.unitPrice ?? 0,
            subtotal:
              item.lineTotal != null
                ? Number(item.lineTotal)
                : currentLine?.subtotal ??
                  (item.quantity != null && item.unitPrice != null
                    ? Number((item.quantity * item.unitPrice).toFixed(2))
                    : 0),
            baselineUnitPrice: currentLine?.baselineUnitPrice ?? null,
          }
        })
      : invoiceData.lineItems

  const aggregatedQuantity =
    parsedFields.quantity ??
    (lineItems.length > 0
      ? lineItems.reduce((total, line) => total + Number(line.quantity || 0), 0)
      : invoiceData.quantity ?? null)
  const aggregatedSubtotal =
    parsedFields.subtotal ??
    (lineItems.length > 0
      ? lineItems.reduce((total, line) => total + Number(line.subtotal || 0), 0)
      : null)
  const repairedAmount = parsedFields.amount ?? aggregatedSubtotal ?? invoiceData.amount

  return {
    ...invoiceData,
    invoiceNumber: parsedFields.invoiceNumber ?? invoiceData.invoiceNumber,
    supplierName: parsedFields.supplierName ?? invoiceData.supplierName ?? null,
    currency: repairedCurrency,
    amount: repairedAmount,
    quantity: aggregatedQuantity ?? invoiceData.quantity ?? null,
    paymentTerms: parsedFields.paymentTerms ?? invoiceData.paymentTerms ?? null,
    bankDetails: parsedFields.bankDetails ?? invoiceData.bankDetails ?? null,
    lineItems,
  }
}

export async function analyzeInvoiceWithAI(
  invoiceData: InvoiceAnalysisInvoiceData,
  expectedData: InvoiceAnalysisExpectedData
): Promise<InvoiceAnalysisResult> {
  const url = `${backendApiBaseUrl()}/api/v1/ai/invoice-analysis`
  console.info(
    "🚀 Calling AI...",
    serializeDebugPayload({
      url,
      invoiceId: invoiceData.id,
      invoiceNumber: invoiceData.invoiceNumber,
      workflowId: invoiceData.workflowId ?? null,
    })
  )
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      invoice_data: invoiceData,
      expected_data: expectedData,
    }),
  })
  console.info(
    "[Invoice AI] Response status",
    serializeDebugPayload({
      invoiceId: invoiceData.id,
      status: response.status,
      ok: response.ok,
    })
  )

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "detail" in payload
        ? String(payload.detail)
        : "Invoice AI analysis request failed."
    console.error(
      "[Invoice AI] Request failed",
      serializeDebugPayload({
        invoiceId: invoiceData.id,
        status: response.status,
        detail,
        payload,
      })
    )
    throw new Error(detail)
  }

  console.info(
    "[Invoice AI] Parsed response",
    serializeDebugPayload({
      invoiceId: invoiceData.id,
      payload,
    })
  )

  const heuristicFields = inferParsedFieldsFromExtractedText(invoiceData)
  const parsedInvoiceFields = mergeParsedFields(
    normalizeParsedFields(payload?.parsedInvoiceFields, invoiceData.currency),
    heuristicFields
  )

  return {
    parsedInvoiceFields,
    riskLevel:
      payload?.riskLevel === "high" || payload?.riskLevel === "medium"
        ? payload.riskLevel
        : "low",
    issues: Array.isArray(payload?.issues)
      ? payload.issues
          .map((item: Record<string, unknown>) => ({
            type:
              item?.type === "amount_mismatch" ||
              item?.type === "missing_field" ||
              item?.type === "bank_mismatch" ||
              item?.type === "suspicious_value"
                ? item.type
                : "other",
            description:
              typeof item?.description === "string"
                ? item.description
                : "Unspecified invoice analysis issue.",
            severity:
              item?.severity === "high" || item?.severity === "medium"
                ? item.severity
                : "low",
          }))
          .filter((item: InvoiceAnalysisIssue) => item.description.length > 0)
      : [],
    summary:
      typeof payload?.summary === "string" && payload.summary.trim().length > 0
        ? payload.summary.trim()
        : "Invoice analysis completed.",
    confidence: normalizeConfidence(payload?.confidence),
    parserReliability: "high",
    rejectedValues: [],
  }
}

export function analyzeInvoiceWithFallback(
  invoiceData: InvoiceAnalysisInvoiceData,
  expectedData: InvoiceAnalysisExpectedData
): InvoiceAnalysisResult {
  const rawParsedFields = inferParsedFieldsFromExtractedText(invoiceData)
  const fallbackAssessment = assessFallbackParsedFields(
    invoiceData,
    expectedData,
    rawParsedFields
  )
  const parsedInvoiceFields = fallbackAssessment.parsedFields
  const repairedInvoiceData =
    fallbackAssessment.reliability === "low"
      ? invoiceData
      : applyParsedFieldsToInvoiceData(invoiceData, parsedInvoiceFields)
  const issues: InvoiceAnalysisIssue[] = []
  const quantity = actualQuantity(repairedInvoiceData)
  const avgUnitPrice = averageUnitPrice(repairedInvoiceData)
  const unresolvedFields = expectedData.unresolvedFields ?? []

  if (!repairedInvoiceData.supplierId && !repairedInvoiceData.supplierName) {
    addIssue(issues, {
      type: "missing_field",
      description: "Supplier information is missing from the parsed invoice data.",
      severity: "high",
    })
  }

  if (!compactSpaces(repairedInvoiceData.bankDetails)) {
    addIssue(issues, {
      type: "missing_field",
      description: "Bank details are missing from the invoice.",
      severity: "high",
    })
  }

  if (!compactSpaces(repairedInvoiceData.paymentTerms)) {
    addIssue(issues, {
      type: "missing_field",
      description: "Payment terms are missing from the invoice.",
      severity: "medium",
    })
  }

  if (!quantity) {
    addIssue(issues, {
      type: "missing_field",
      description: "Invoice quantity is missing or zero.",
      severity: "high",
    })
  }

  if (
    expectedData.expectedSupplierId &&
    repairedInvoiceData.supplierId &&
    expectedData.expectedSupplierId !== repairedInvoiceData.supplierId
  ) {
    addIssue(issues, {
      type: "other",
      description: `Supplier mismatch: expected ${expectedData.expectedSupplierName ?? expectedData.expectedSupplierId}, got ${repairedInvoiceData.supplierName ?? repairedInvoiceData.supplierId}.`,
      severity: "high",
    })
  }

  if (
    expectedData.expectedQuantity != null &&
    quantity > 0 &&
    expectedData.expectedQuantity !== quantity
  ) {
    const delta = Math.abs(expectedData.expectedQuantity - quantity)
    addIssue(issues, {
      type: "other",
      description: `Quantity mismatch: expected ${expectedData.expectedQuantity}, got ${quantity}.`,
      severity: delta >= Math.max(10, expectedData.expectedQuantity * 0.1) ? "high" : "medium",
    })
  }

  if (
    expectedData.expectedAmountMin != null &&
    expectedData.expectedAmountMax != null &&
    (repairedInvoiceData.amount < expectedData.expectedAmountMin * 0.99 ||
      repairedInvoiceData.amount > expectedData.expectedAmountMax * 1.01)
  ) {
    const expectedMid =
      (expectedData.expectedAmountMin + expectedData.expectedAmountMax) / 2
    const varianceRatio =
      expectedMid > 0
        ? Math.abs(repairedInvoiceData.amount - expectedMid) / expectedMid
        : 0
    addIssue(issues, {
      type: "amount_mismatch",
      description: `Amount is outside the expected range ${formatCurrency(expectedData.expectedAmountMin, repairedInvoiceData.currency)} to ${formatCurrency(expectedData.expectedAmountMax, repairedInvoiceData.currency)}.`,
      severity: varianceRatio >= 0.08 ? "high" : "medium",
    })
  }

  if (
    expectedData.expectedBankDetails &&
    compactSpaces(repairedInvoiceData.bankDetails) &&
    cleanText(expectedData.expectedBankDetails) !==
      cleanText(repairedInvoiceData.bankDetails)
  ) {
    addIssue(issues, {
      type: "bank_mismatch",
      description: "Bank details do not match the last known supplier remittance details.",
      severity: "high",
    })
  }

  const expectedNetDays = parseNetDays(expectedData.expectedPaymentTerms)
  const invoiceNetDays = parseNetDays(repairedInvoiceData.paymentTerms)
  if (
    expectedData.expectedPaymentTerms &&
    compactSpaces(repairedInvoiceData.paymentTerms) &&
    cleanText(expectedData.expectedPaymentTerms) !==
      cleanText(repairedInvoiceData.paymentTerms)
  ) {
    addIssue(issues, {
      type: "other",
      description: `Payment terms differ from the system reference: expected ${expectedData.expectedPaymentTerms}, got ${repairedInvoiceData.paymentTerms}.`,
      severity:
        expectedNetDays != null &&
        invoiceNetDays != null &&
        Math.abs(expectedNetDays - invoiceNetDays) >= 10
          ? "high"
          : "medium",
    })
  }

  if (unresolvedFields.length > 0) {
    addIssue(issues, {
      type: "missing_field",
      description: `Open negotiation fields remain unresolved: ${unresolvedFields.join(", ")}.`,
      severity: "medium",
    })
  }

  if (
    expectedData.latestQuotedQuantity != null &&
    quantity > 0 &&
    expectedData.latestQuotedQuantity !== quantity
  ) {
    addIssue(issues, {
      type: "other",
      description: `Invoice quantity differs from the latest supplier-quoted quantity of ${expectedData.latestQuotedQuantity}.`,
      severity: "medium",
    })
  }

  if (
    expectedData.latestQuotedUnitPrice != null &&
    avgUnitPrice != null &&
    Math.abs(avgUnitPrice - expectedData.latestQuotedUnitPrice) /
      Math.max(expectedData.latestQuotedUnitPrice, 0.01) >=
      0.08
  ) {
    addIssue(issues, {
      type: "suspicious_value",
      description: `Average unit price ${formatCurrency(avgUnitPrice, repairedInvoiceData.currency)} differs materially from the latest quoted unit price.`,
      severity: "medium",
    })
  }

  repairedInvoiceData.lineItems.forEach((line) => {
    if (
      line.baselineUnitPrice != null &&
      line.baselineUnitPrice > 0 &&
      Math.abs(line.unitPrice - line.baselineUnitPrice) / line.baselineUnitPrice >= 0.2
    ) {
      addIssue(issues, {
        type: "suspicious_value",
        description: `Line item ${line.sku} unit price ${formatCurrency(line.unitPrice, repairedInvoiceData.currency)} deviates from the system baseline.`,
        severity: "medium",
      })
    }
  })

  if (repairedInvoiceData.amount <= 0) {
    addIssue(issues, {
      type: "suspicious_value",
      description: "Invoice total is zero or negative.",
      severity: "high",
    })
  }

  const highCount = issues.filter((issue) => issue.severity === "high").length
  const mediumCount = issues.filter((issue) => issue.severity === "medium").length

  const riskLevel: InvoiceAnalysisResult["riskLevel"] =
    highCount > 0 || mediumCount >= 3
      ? "high"
      : issues.length > 0
        ? "medium"
        : "low"

  const summary =
    fallbackAssessment.reliability === "low"
      ? "Fallback parsing confidence was low, so OCR-derived field repairs were skipped and only existing structured data was validated."
      : issues.length === 0
        ? "Fallback parsing repaired invoice fields from OCR text and the resulting values align with workflow expectations."
        : `Fallback validation flagged ${issues
            .slice(0, 2)
            .map((issue) => issue.description)
            .join(" ")}`

  let confidence = 0.9
  if (!expectedData.expectedBankDetails) confidence -= 0.05
  if (!expectedData.expectedPaymentTerms) confidence -= 0.03
  if (invoiceData.sourceType.toLowerCase() === "image") confidence -= 0.04
  if (issues.length === 0) confidence += 0.04
  if (highCount > 0) confidence -= 0.03
  if (parsedInvoiceFields.amount == null) confidence -= 0.08
  if (parsedInvoiceFields.quantity == null && parsedInvoiceFields.lineItems.length === 0) {
    confidence -= 0.08
  }
  if (fallbackAssessment.reliability === "low") confidence -= 0.18
  if (fallbackAssessment.rejectedValues.length > 0) {
    confidence -= Math.min(0.12, fallbackAssessment.rejectedValues.length * 0.03)
  }

  return {
    parsedInvoiceFields,
    riskLevel,
    issues,
    summary,
    confidence: Math.max(0.55, Math.min(0.98, confidence)),
    parserReliability: fallbackAssessment.reliability,
    rejectedValues: fallbackAssessment.rejectedValues,
  }
}
