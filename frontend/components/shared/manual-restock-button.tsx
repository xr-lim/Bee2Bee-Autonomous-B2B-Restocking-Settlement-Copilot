"use client"

import { Loader2, PackagePlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { createRestockRequestAction } from "@/lib/actions"

type ManualRestockButtonProps = {
  productId: string
  sku: string
}

export function ManualRestockButton({
  productId,
  sku,
}: ManualRestockButtonProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string>()

  async function handleClick() {
    if (isSubmitting) return

    setIsSubmitting(true)
    setActionError(undefined)

    const result = await createRestockRequestAction({ productId, sku })

    if (result.ok) {
      router.refresh()
    } else {
      setActionError(result.message ?? "Unable to create restock request.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        onClick={handleClick}
        disabled={isSubmitting}
        variant="outline"
        className="h-10 rounded-[10px] border-[#243047] bg-[#172033] px-4 text-[#E5E7EB] hover:bg-[#243047] disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <PackagePlus className="size-4" aria-hidden="true" />
        )}
        Restock
      </Button>
      {actionError ? (
        <p className="text-right text-[12px] leading-5 text-[#FCA5A5]">
          {actionError}
        </p>
      ) : null}
    </div>
  )
}
