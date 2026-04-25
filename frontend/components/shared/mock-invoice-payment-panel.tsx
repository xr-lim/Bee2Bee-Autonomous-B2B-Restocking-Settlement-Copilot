"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { completeMockPaymentAction } from "@/lib/actions"

type MockInvoicePaymentPanelProps = {
  invoiceId: string
  invoiceNumber: string
  supplierName: string
  amount: number
  currency: string
  approvalState: "Waiting Approval" | "Needs Review" | "Blocked" | "Completed"
}

const PAYMENT_METHODS = [
  {
    id: "fpx-online-banking",
    icon: "🏦",
    title: "FPX Online Banking",
    description: "Pay using Malaysian online banking.",
  },
  {
    id: "bank-transfer",
    icon: "💸",
    title: "Bank Transfer",
    description: "Simulated direct bank settlement.",
  },
  {
    id: "duitnow-qr",
    icon: "🔳",
    title: "DuitNow QR",
    description: "Simulated instant QR payment.",
  },
  {
    id: "touch-n-go",
    icon: "💳",
    title: "Touch 'n Go eWallet",
    description: "Mock e-wallet settlement.",
  },
  {
    id: "boost",
    icon: "⚡",
    title: "Boost",
    description: "Mock digital wallet payment.",
  },
  {
    id: "grabpay",
    icon: "🛵",
    title: "GrabPay",
    description: "Simulated merchant checkout payment.",
  },
] as const

export function MockInvoicePaymentPanel({
  invoiceId,
  invoiceNumber,
  supplierName,
  amount,
  currency,
  approvalState,
}: MockInvoicePaymentPanelProps) {
  const router = useRouter()
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedMethod = useMemo(
    () => PAYMENT_METHODS.find((method) => method.id === selectedMethodId) ?? null,
    [selectedMethodId]
  )
  const isCompleted = approvalState === "Completed"
  const isBlocked = approvalState === "Blocked"
  const canPay = !isCompleted && !isBlocked
  const warningMessage =
    canPay && approvalState !== "Waiting Approval"
      ? "Invoice should be approved before payment. Mock payment is still available for demo purposes."
      : null

  function confirmPayment() {
    if (!selectedMethod) {
      setError("Choose a payment method before confirming payment.")
      return
    }

    setError(null)
    setStatusMessage(null)

    startTransition(async () => {
      const result = await completeMockPaymentAction({
        invoiceId,
        paymentMethod: selectedMethod.title,
      })

      if (!result.ok) {
        setError(result.message ?? "Mock payment could not be completed.")
        return
      }

      setStatusMessage("Payment Completed")
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
        <CardHeader className="border-b border-[#243047] p-5">
          <CardTitle className="text-[18px] font-semibold text-[#E5E7EB]">
            Mock Payment
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 md:grid-cols-2">
          <div>
            <p className="text-[13px] text-[#9CA3AF]">Invoice Number</p>
            <p className="mt-1 text-[15px] font-semibold text-[#E5E7EB]">
              {invoiceNumber}
            </p>
          </div>
          <div>
            <p className="text-[13px] text-[#9CA3AF]">Supplier</p>
            <p className="mt-1 text-[15px] font-semibold text-[#E5E7EB]">
              {supplierName}
            </p>
          </div>
          <div>
            <p className="text-[13px] text-[#9CA3AF]">Amount</p>
            <p className="mt-1 text-[15px] font-semibold text-[#E5E7EB]">
              {currency} {amount.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div>
            <p className="text-[13px] text-[#9CA3AF]">Approval State</p>
            <p className="mt-1 text-[15px] font-semibold text-[#E5E7EB]">
              {approvalState}
            </p>
          </div>
        </CardContent>
      </Card>

      {isCompleted ? (
        <Card className="rounded-[14px] border border-[#10B981]/40 bg-[#0E1E1A] py-0 shadow-none ring-0">
          <CardContent className="p-5">
            <p className="text-[18px] font-semibold text-[#D1FAE5]">
              Invoice already completed
            </p>
            <p className="mt-2 text-[14px] leading-6 text-[#A7F3D0]">
              This mock payment has already been settled and cannot be run again.
            </p>
            <Button
              asChild
              className="mt-4 h-10 rounded-[10px] bg-[#10B981] px-4 text-white hover:bg-[#059669]"
            >
              <Link href={`/invoice-management/${invoiceId}`}>Back to Invoice</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isBlocked ? (
        <Card className="rounded-[14px] border border-[#EF4444]/40 bg-[#2A1317] py-0 shadow-none ring-0">
          <CardContent className="p-5">
            <p className="text-[18px] font-semibold text-[#FECACA]">
              Invoice is blocked and cannot be paid
            </p>
            <p className="mt-2 text-[14px] leading-6 text-[#FCA5A5]">
              Review the invoice and remove the block before attempting mock payment.
            </p>
            <Button
              asChild
              className="mt-4 h-10 rounded-[10px] bg-[#111827] px-4 text-[#E5E7EB] hover:bg-[#243047]"
            >
              <Link href={`/invoice-management/${invoiceId}`}>Back to Invoice</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!isCompleted && !isBlocked ? (
        <>
          {warningMessage ? (
            <div className="rounded-[12px] border border-[#F59E0B]/40 bg-[#3A250D] p-4 text-[14px] leading-6 text-[#FDE68A]">
              {warningMessage}
            </div>
          ) : null}

          {statusMessage ? (
            <Card className="rounded-[14px] border border-[#10B981]/40 bg-[#0E1E1A] py-0 shadow-none ring-0">
              <CardContent className="p-5">
                <p className="text-[20px] font-semibold text-[#D1FAE5]">
                  {statusMessage}
                </p>
                <p className="mt-2 text-[14px] leading-6 text-[#A7F3D0]">
                  Mock settlement for invoice {invoiceNumber} was completed using{" "}
                  {selectedMethod?.title ?? "the selected method"}.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    asChild
                    className="h-10 rounded-[10px] bg-[#10B981] px-4 text-white hover:bg-[#059669]"
                  >
                    <Link href={`/invoice-management/${invoiceId}`}>Back to Invoice</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {PAYMENT_METHODS.map((method) => {
                  const isSelected = selectedMethodId === method.id

                  return (
                    <button
                      key={method.id}
                      type="button"
                      disabled={!canPay || isPending}
                      onClick={() => setSelectedMethodId(method.id)}
                      className={`rounded-[14px] border p-5 text-left transition ${
                        isSelected
                          ? "border-[#3B82F6] bg-[#172554] shadow-[0_12px_30px_rgba(59,130,246,0.18)]"
                          : "border-[#243047] bg-[#111827] hover:border-[#3B82F6]/60 hover:bg-[#172033]"
                      } disabled:cursor-not-allowed disabled:border-[#243047] disabled:bg-[#111827]/70 disabled:text-[#6B7280]`}
                    >
                      <div className="text-[24px]">{method.icon}</div>
                      <p className="mt-3 text-[16px] font-semibold text-[#E5E7EB]">
                        {method.title}
                      </p>
                      <p className="mt-2 text-[14px] leading-6 text-[#9CA3AF]">
                        {method.description}
                      </p>
                    </button>
                  )
                })}
              </div>

              <div className="flex flex-col gap-3 rounded-[14px] border border-[#243047] bg-[#111827] p-5">
                <div>
                  <p className="text-[13px] text-[#9CA3AF]">Selected Method</p>
                  <p className="mt-1 text-[15px] font-semibold text-[#E5E7EB]">
                    {selectedMethod?.title ?? "Choose a payment method"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    disabled={!selectedMethod || isPending || !canPay}
                    onClick={confirmPayment}
                    className="h-10 rounded-[10px] bg-[#10B981] px-4 text-white hover:bg-[#059669] disabled:cursor-not-allowed disabled:bg-[#172033] disabled:text-[#6B7280]"
                  >
                    {isPending ? "Confirming..." : "Confirm Payment"}
                  </Button>
                  <Button
                    asChild
                    type="button"
                    className="h-10 rounded-[10px] border border-[#243047] bg-[#111827] px-4 text-[#E5E7EB] hover:bg-[#243047]"
                  >
                    <Link href={`/invoice-management/${invoiceId}`}>Back to Invoice</Link>
                  </Button>
                </div>
                {error ? <p className="text-[13px] text-[#FCA5A5]">{error}</p> : null}
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  )
}
