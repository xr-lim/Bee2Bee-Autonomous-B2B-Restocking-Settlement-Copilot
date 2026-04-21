import type { ConversationSource } from "@/lib/types"

// Backstop for any legacy source strings that may still land from older
// Supabase rows. New code should just use ConversationSource directly.
const legacyMap: Record<string, ConversationSource> = {
  "Chat App": "WhatsApp",
  Upload: "Email",
  PDF: "Email",
  Image: "WhatsApp",
  "Voice Note": "WeChat",
}

export function displayConversationSource(
  source: string | undefined | null
): ConversationSource {
  if (!source) return "Email"
  if (source in legacyMap) return legacyMap[source]
  return source as ConversationSource
}
