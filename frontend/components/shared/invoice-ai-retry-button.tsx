"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { analyzeInvoiceAction } from "@/lib/actions"

type InvoiceAiRetryButtonProps = {
  invoiceId: string
  disabled?: boolean
}

export function InvoiceAiRetryButton({
  invoiceId,
  disabled = false,
}: InvoiceAiRetryButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleRetry() {
    setError(null)

    startTransition(async () => {
      const result = await analyzeInvoiceAction({ invoiceId })
      if (!result.ok) {
        setError(result.message ?? "Could not retry AI analysis.")
        return
      }

      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        disabled={disabled || isPending}
        onClick={handleRetry}
        className="h-10 rounded-[10px] bg-[#2563EB] px-4 text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:bg-[#172033] disabled:text-[#6B7280]"
      >
        {isPending ? "Retrying AI..." : "Retry AI Analysis"}
      </Button>
      {error ? <p className="text-[12px] text-[#FCA5A5]">{error}</p> : null}
    </div>
  )
}
