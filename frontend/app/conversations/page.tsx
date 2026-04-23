import { PageHeader } from "@/components/layout/page-header"
import { ConversationsBrowser } from "@/components/shared/conversations-browser"
import {
  getConversations,
  getInvoices,
  getProducts,
  getSuppliers,
} from "@/lib/data"

export const dynamic = "force-dynamic"

export default async function ConversationsPage() {
  const [conversations, invoices, products, suppliers] = await Promise.all([
    getConversations(),
    getInvoices(),
    getProducts(),
    getSuppliers(),
  ])

  return (
    <>
      <PageHeader
        eyebrow="Supplier desk"
        title="Conversations"
        description="Track Z.AI supplier negotiation progress, linked SKUs, and invoice follow-up."
      />

      <ConversationsBrowser
        conversations={conversations}
        invoices={invoices}
        products={products}
        suppliers={suppliers}
      />
    </>
  )
}
