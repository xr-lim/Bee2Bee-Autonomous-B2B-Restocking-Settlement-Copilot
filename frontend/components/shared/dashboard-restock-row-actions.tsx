"use client"

import Link from "next/link"
import { Eye, Loader2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { deleteRestockRequestAction } from "@/lib/actions"

type DashboardRestockRowActionsProps = {
  sku: string
  requestId?: string
  actionLabel: string
}

export function DashboardRestockRowActions({
  sku,
  requestId,
  actionLabel,
}: DashboardRestockRowActionsProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete() {
    if (!requestId || isDeleting) return

    setIsDeleting(true)
    const result = await deleteRestockRequestAction({
      requestId,
      sku,
    })

    if (result.ok) {
      router.refresh()
      return
    }

    setIsDeleting(false)
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        asChild
        variant="outline"
        className="h-10 rounded-2xl border-[#334155] bg-[#172033] px-3 text-[13px] font-semibold text-[#E5E7EB] hover:border-[#38BDF8]/40 hover:bg-[#1B2940]"
      >
        <Link href={`/inventory/${sku}`} title={actionLabel}>
          <Eye className="size-4" aria-hidden="true" />
          View
        </Link>
      </Button>
      {requestId ? (
        <Button
          type="button"
          variant="outline"
          onClick={handleDelete}
          disabled={isDeleting}
          aria-label="Delete restock request"
          title="Delete request"
          className="size-10 rounded-2xl border-[#3B2230] bg-[#1A1118] p-0 text-[#FCA5A5] hover:bg-[#2A1821] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isDeleting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 className="size-4" aria-hidden="true" />
          )}
        </Button>
      ) : null}
    </div>
  )
}
