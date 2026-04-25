"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useTransition } from "react"

import { processInvoicePipelineAction } from "@/lib/actions"

type InvoiceProcessingTriggerProps = {
  invoiceId: string
  shouldProcess: boolean
  processingStatus?: "idle" | "extracting" | "analyzing"
  onStarted?: () => void
  onCompleted?: (ok: boolean) => void
}

export function InvoiceProcessingTrigger({
  invoiceId,
  shouldProcess,
  processingStatus,
  onStarted,
  onCompleted,
}: InvoiceProcessingTriggerProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const hasTriggeredRef = useRef(false)

  useEffect(() => {
    if (!shouldProcess || hasTriggeredRef.current) {
      return
    }

    hasTriggeredRef.current = true
    onStarted?.()
    startTransition(async () => {
      const result = await processInvoicePipelineAction({ invoiceId })
      onCompleted?.(result.ok)
      const shouldRefresh =
        result.ok &&
        !/already processing|already analyzed|already completed/i.test(
          result.message ?? ""
        )
      if (shouldRefresh) {
        router.refresh()
      }
    })
  }, [invoiceId, onCompleted, onStarted, router, shouldProcess])

  useEffect(() => {
    if (!processingStatus || processingStatus === "idle") {
      return
    }

    const timeoutId = window.setTimeout(() => {
      router.refresh()
    }, 2500)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [processingStatus, router])

  return null
}
