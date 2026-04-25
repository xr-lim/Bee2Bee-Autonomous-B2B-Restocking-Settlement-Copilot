"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { createTestInvoiceAction } from "@/lib/actions"

export function TestInvoiceActions() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function handleCreate(mode: "normal" | "suspicious") {
    setErrorMessage(null)

    startTransition(async () => {
      const result = await createTestInvoiceAction({ mode })

      if (!result.ok || !result.invoiceId) {
        setErrorMessage(result.message ?? "Could not create a test invoice.")
        return
      }

      router.push(`/invoice-management/${result.invoiceId}`)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => handleCreate("normal")}
          className="h-10 rounded-[10px] border-[#243047] bg-[#172033] text-[#E5E7EB] hover:bg-[#243047]"
        >
          Add Normal Invoice
        </Button>
        <Button
          type="button"
          disabled={isPending}
          onClick={() => handleCreate("suspicious")}
          className="h-10 rounded-[10px] bg-[#B45309] px-4 text-white hover:bg-[#92400E]"
        >
          Add Suspicious Invoice
        </Button>
      </div>
      {errorMessage ? (
        <p className="text-right text-[12px] text-[#FCA5A5]">{errorMessage}</p>
      ) : null}
    </div>
  )
}
