"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import {
  approveInvoiceAction,
  holdReviewInvoiceAction,
  markInvoiceCompletedAction,
  rejectInvoiceAction,
} from "@/lib/actions"

type InvoiceDecisionActionsProps = {
  invoiceId: string
  isCompleted: boolean
  approvalState: "Waiting Approval" | "Needs Review" | "Blocked" | "Completed"
}

type Decision = "approve" | "hold" | "block" | "complete"

export function InvoiceDecisionActions({
  invoiceId,
  isCompleted,
  approvalState,
}: InvoiceDecisionActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function submit(decision: Decision) {
    setError(null)
    startTransition(async () => {
      const result =
        decision === "approve"
          ? await approveInvoiceAction(invoiceId)
          : decision === "hold"
            ? await holdReviewInvoiceAction(invoiceId)
            : decision === "block"
              ? await rejectInvoiceAction(invoiceId)
              : await markInvoiceCompletedAction(invoiceId)

      if (!result.ok) {
        setError(result.message ?? "Could not update invoice.")
        return
      }

      if (decision === "approve") {
        router.push(`/invoice-management/${invoiceId}/payment`)
        return
      }

      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          disabled={isCompleted || isPending || approvalState === "Blocked"}
          onClick={() => submit("approve")}
          className="h-11 rounded-[10px] bg-[#10B981] px-5 text-white hover:bg-[#059669] disabled:cursor-not-allowed disabled:bg-[#172033] disabled:text-[#6B7280]"
        >
          {isPending ? "Saving..." : "Approve"}
        </Button>
        <Button
          type="button"
          disabled={isCompleted || isPending}
          onClick={() => submit("hold")}
          className="h-11 rounded-[10px] bg-[#F59E0B] px-5 text-[#111827] hover:bg-[#D97706] disabled:cursor-not-allowed disabled:bg-[#172033] disabled:text-[#6B7280]"
        >
          Hold Review
        </Button>
        <Button
          type="button"
          disabled={isCompleted || isPending || approvalState === "Blocked"}
          onClick={() => submit("block")}
          className="h-11 rounded-[10px] bg-[#EF4444] px-5 text-white hover:bg-[#DC2626] disabled:cursor-not-allowed disabled:bg-[#172033] disabled:text-[#6B7280]"
        >
          Reject / Block
        </Button>
        <Button
          type="button"
          disabled={isCompleted || isPending}
          onClick={() => submit("complete")}
          className="h-11 rounded-[10px] border border-[#243047] bg-[#111827] px-5 text-[#E5E7EB] hover:bg-[#243047] disabled:cursor-not-allowed disabled:text-[#6B7280]"
        >
          {isCompleted ? "Already Completed" : "Mark Completed"}
        </Button>
      </div>
      {error ? <p className="text-[13px] text-[#FCA5A5]">{error}</p> : null}
    </div>
  )
}
