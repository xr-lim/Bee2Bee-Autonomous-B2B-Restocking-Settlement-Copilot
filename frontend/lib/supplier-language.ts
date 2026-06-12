export const SUPPLIER_LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "ms", label: "Malay" },
  { value: "zh", label: "Chinese" },
] as const

export type SupplierPreferredLanguage =
  (typeof SUPPLIER_LANGUAGE_OPTIONS)[number]["value"]

export type SupplierMessageLanguage =
  | Uppercase<SupplierPreferredLanguage>
  | "JA"

export const DEFAULT_SUPPLIER_LANGUAGE: SupplierPreferredLanguage = "en"

const SUPPLIER_LANGUAGE_LABELS: Record<SupplierPreferredLanguage, string> = {
  en: "English",
  ms: "Malay",
  zh: "Chinese",
}

export function isSupplierPreferredLanguage(
  value: string
): value is SupplierPreferredLanguage {
  return SUPPLIER_LANGUAGE_OPTIONS.some((option) => option.value === value)
}

export function normalizeSupplierPreferredLanguage(
  value?: string | null
): SupplierPreferredLanguage {
  if (!value) return DEFAULT_SUPPLIER_LANGUAGE

  const normalized = value.trim().toLowerCase()
  return isSupplierPreferredLanguage(normalized)
    ? normalized
    : DEFAULT_SUPPLIER_LANGUAGE
}

export function getLanguageLabel(code?: string | null) {
  return SUPPLIER_LANGUAGE_LABELS[normalizeSupplierPreferredLanguage(code)]
}

export function getMessageLanguageCode(
  code?: string | null
): SupplierMessageLanguage {
  return normalizeSupplierPreferredLanguage(code).toUpperCase() as Uppercase<SupplierPreferredLanguage>
}
