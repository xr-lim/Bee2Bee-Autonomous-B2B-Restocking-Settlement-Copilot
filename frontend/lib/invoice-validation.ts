import type { InvoiceAnalysisIssue } from "@/lib/invoice-analysis"

export type InvoiceValidationCheck = {
  checkName: string
  expectedValue?: string | null
  actualValue?: string | null
  result?: string | null
}

export type InvoiceCheckResolutionContext = {
  amount: number
  negotiatedAmount: number
  expectedAmountMin: number | null
  expectedAmountMax: number | null
  expectedQuantity: number
  invoiceQuantity: number
  currentCurrency: string
  expectedCurrency: string
  currentSupplierName: string
  expectedSupplierName: string
  bankDetails: string
  paymentTerms: string
  invoiceNumber: string
  lineItemCount: number
}

export function humanizeInvoiceCheckName(checkName: string) {
  return checkName
    .replace(/^ai_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function normalizeInvoiceComparableText(value?: string | null) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ")
}

export function amountMatchesExpectedRange(
  amount: number,
  expectedAmountMin: number | null,
  expectedAmountMax: number | null,
  fallbackAmount: number
) {
  if (expectedAmountMin != null && expectedAmountMax != null) {
    return amount >= expectedAmountMin - 0.005 && amount <= expectedAmountMax + 0.005
  }

  return Math.abs(amount - fallbackAmount) < 0.005
}

export function isResolvedInvoiceCheck(
  check: InvoiceValidationCheck,
  context: InvoiceCheckResolutionContext
) {
  const checkName = check.checkName.toLowerCase()
  const actualValue = normalizeInvoiceComparableText(check.actualValue)

  if (checkName === "ai_amount_mismatch" || checkName === "amount_mismatch") {
    return amountMatchesExpectedRange(
      context.amount,
      context.expectedAmountMin,
      context.expectedAmountMax,
      context.negotiatedAmount
    )
  }

  if (
    checkName === "ai_quantity_mismatch" ||
    checkName === "quantity_mismatch" ||
    checkName === "ai_missing_quantity" ||
    checkName === "missing_quantity"
  ) {
    return (
      context.invoiceQuantity > 0 &&
      context.expectedQuantity > 0 &&
      context.invoiceQuantity === context.expectedQuantity
    )
  }

  if (
    checkName === "ai_missing_supplier" ||
    checkName === "missing_supplier" ||
    checkName === "ai_supplier_mismatch" ||
    checkName === "supplier_mismatch"
  ) {
    return (
      normalizeInvoiceComparableText(context.currentSupplierName) !== "" &&
      normalizeInvoiceComparableText(context.currentSupplierName) ===
        normalizeInvoiceComparableText(context.expectedSupplierName)
    )
  }

  if (checkName === "ai_missing_payment_terms" || checkName === "missing_payment_terms") {
    return normalizeInvoiceComparableText(context.paymentTerms) !== "not provided"
  }

  if (
    checkName === "ai_missing_bank_details" ||
    checkName === "missing_bank_details" ||
    checkName === "ai_bank_mismatch" ||
    checkName === "bank_mismatch"
  ) {
    return normalizeInvoiceComparableText(context.bankDetails) !== "not provided"
  }

  if (
    (checkName === "ai_missing_field" || checkName === "missing_field") &&
    actualValue.includes("line item")
  ) {
    return context.lineItemCount > 0
  }

  if (
    (checkName === "ai_missing_field" || checkName === "missing_field") &&
    actualValue.includes("quantity is 0")
  ) {
    return (
      context.invoiceQuantity > 0 &&
      context.expectedQuantity > 0 &&
      context.invoiceQuantity === context.expectedQuantity
    )
  }

  if (
    (checkName === "ai_missing_field" || checkName === "missing_field") &&
    actualValue.includes("currency")
  ) {
    return (
      normalizeInvoiceComparableText(context.currentCurrency) !== "" &&
      normalizeInvoiceComparableText(context.currentCurrency) !== "null"
    )
  }

  if (
    (checkName === "ai_suspicious_value" || checkName === "suspicious_value") &&
    actualValue.includes("currency mismatch")
  ) {
    return (
      normalizeInvoiceComparableText(context.currentCurrency) ===
      normalizeInvoiceComparableText(context.expectedCurrency)
    )
  }

  if (
    (checkName === "ai_suspicious_value" || checkName === "suspicious_value") &&
    (actualValue.includes("amount") ||
      actualValue.includes("price") ||
      actualValue.includes("total"))
  ) {
    return (
      context.amount > 0 &&
      amountMatchesExpectedRange(
        context.amount,
        context.expectedAmountMin,
        context.expectedAmountMax,
        context.negotiatedAmount
      )
    )
  }

  if (
    (checkName === "ai_suspicious_value" || checkName === "suspicious_value") &&
    actualValue.includes("quantity")
  ) {
    return context.invoiceQuantity > 0 && context.invoiceQuantity === context.expectedQuantity
  }

  if (checkName.startsWith("ai_other_") && actualValue.includes("invoice number mismatch")) {
    return !context.invoiceNumber.toUpperCase().startsWith("UPL-")
  }

  return false
}

export function buildInvoiceValidationSummary(
  unresolvedChecks: InvoiceValidationCheck[],
  options?: {
    fallbackOnly?: boolean
  }
) {
  const issueSummaries = unresolvedChecks.map(
    (check) => check.actualValue?.trim() || humanizeInvoiceCheckName(check.checkName)
  )
  const mismatches = unresolvedChecks.map((check) =>
    [check.checkName.replace(/_/g, " "), check.actualValue].filter(Boolean).join(": ")
  )
  const prefix = options?.fallbackOnly ? "Fallback validation only: " : ""

  if (issueSummaries.length === 0) {
    return {
      issueSummaries,
      mismatches,
      riskReason: `${prefix}All current validation checks passed.`,
      riskSummarySource: options?.fallbackOnly
        ? "validation_checks_clear_fallback"
        : "validation_checks_clear",
    }
  }

  const detail = issueSummaries.slice(0, 2).join(" ")

  return {
    issueSummaries,
    mismatches,
    riskReason: `${prefix}Current validation detected ${issueSummaries.length} unresolved issue${
      issueSummaries.length === 1 ? "" : "s"
    }: ${detail}`,
    riskSummarySource: "validation_checks",
  }
}

export function riskLevelFromIssues(
  issues: InvoiceAnalysisIssue[]
): "low" | "medium" | "high" {
  const highCount = issues.filter((issue) => issue.severity === "high").length
  const mediumCount = issues.filter((issue) => issue.severity === "medium").length

  if (highCount > 0 || mediumCount >= 3) {
    return "high"
  }

  return issues.length > 0 ? "medium" : "low"
}
