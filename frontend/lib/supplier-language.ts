export const SUPPLIER_LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "ms", label: "Malay" },
  { value: "zh-CN", label: "Chinese (Simplified)" },
  { value: "zh-TW", label: "Chinese (Traditional)" },
  { value: "ta", label: "Tamil" },
  { value: "id", label: "Indonesian" },
  { value: "th", label: "Thai" },
  { value: "vi", label: "Vietnamese" },
  { value: "fil", label: "Filipino" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "hi", label: "Hindi" },
  { value: "bn", label: "Bengali" },
  { value: "ur", label: "Urdu" },
  { value: "ar", label: "Arabic" },
  { value: "tr", label: "Turkish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "es", label: "Spanish" },
  { value: "pt", label: "Portuguese" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "it", label: "Italian" },
  { value: "nl", label: "Dutch" },
  { value: "pl", label: "Polish" },
  { value: "ru", label: "Russian" },
  { value: "uk", label: "Ukrainian" },
  { value: "cs", label: "Czech" },
  { value: "ro", label: "Romanian" },
  { value: "el", label: "Greek" },
  { value: "he", label: "Hebrew" },
  { value: "fa", label: "Persian" },
  { value: "sw", label: "Swahili" },
  { value: "af", label: "Afrikaans" },
  { value: "my", label: "Burmese" },
  { value: "km", label: "Khmer" },
  { value: "lo", label: "Lao" },
  { value: "ne", label: "Nepali" },
  { value: "si", label: "Sinhala" },
  { value: "te", label: "Telugu" },
  { value: "ml", label: "Malayalam" },
  { value: "kn", label: "Kannada" },
  { value: "gu", label: "Gujarati" },
  { value: "pa", label: "Punjabi" },
  { value: "mr", label: "Marathi" },
  { value: "no", label: "Norwegian" },
  { value: "sv", label: "Swedish" },
  { value: "da", label: "Danish" },
  { value: "fi", label: "Finnish" },
] as const

export type SupplierPreferredLanguage = string
export type SupplierMessageLanguage = string

export const DEFAULT_SUPPLIER_LANGUAGE: SupplierPreferredLanguage = "en"

const LANGUAGE_BY_NORMALIZED_CODE = new Map(
  SUPPLIER_LANGUAGE_OPTIONS.map((option) => [
    option.value.toLowerCase(),
    option,
  ])
)

export function isSupplierPreferredLanguage(value: string) {
  return LANGUAGE_BY_NORMALIZED_CODE.has(value.trim().toLowerCase())
}

export function normalizeSupplierPreferredLanguage(
  value?: string | null
): SupplierPreferredLanguage {
  if (!value) return DEFAULT_SUPPLIER_LANGUAGE

  const normalized = value.trim().toLowerCase()
  return LANGUAGE_BY_NORMALIZED_CODE.get(normalized)?.value ?? DEFAULT_SUPPLIER_LANGUAGE
}

export function getLanguageLabel(code?: string | null) {
  const language = LANGUAGE_BY_NORMALIZED_CODE.get(
    normalizeSupplierPreferredLanguage(code).toLowerCase()
  )
  return language?.label ?? "English"
}

export function getMessageLanguageCode(code?: string | null): SupplierMessageLanguage {
  return normalizeSupplierPreferredLanguage(code)
}

export function getMessageLanguageBadge(code?: string | null) {
  const normalized = normalizeSupplierPreferredLanguage(code)
  if (normalized === "zh-CN") return { short: "中文", full: "Chinese (Simplified)" }
  if (normalized === "zh-TW") return { short: "繁中", full: "Chinese (Traditional)" }

  const label = getLanguageLabel(normalized)
  return {
    short: normalized.toUpperCase(),
    full: label,
  }
}
