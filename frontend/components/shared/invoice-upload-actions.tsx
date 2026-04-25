"use client"

import { useRouter } from "next/navigation"
import type { ChangeEvent } from "react"
import { useMemo, useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { createUploadedInvoiceAction } from "@/lib/actions"

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]

function formatAcceptedTypes() {
  return "PDF, PNG, JPG, JPEG, or WEBP"
}

export function InvoiceUploadActions() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const selectedFileName = useMemo(
    () => selectedFile?.name ?? "No file selected",
    [selectedFile]
  )

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    setError(null)
    setSuccessMessage(null)

    if (!file) {
      setSelectedFile(null)
      return
    }

    const mimeType = file.type.toLowerCase()
    if (!ACCEPTED_TYPES.includes(mimeType)) {
      setSelectedFile(null)
      setError(`Unsupported file type. Upload ${formatAcceptedTypes()}.`)
      return
    }

    setSelectedFile(file)
  }

  function handleSubmit() {
    if (!selectedFile) {
      setError("Select an invoice file first.")
      return
    }

    setError(null)
    setSuccessMessage(null)
    startTransition(async () => {
      const formData = new FormData()
      formData.set("file", selectedFile)

      const result = await createUploadedInvoiceAction(formData)
      if (!result.ok || !result.invoiceId) {
        setError(result.message ?? "Could not create invoice from upload.")
        return
      }

      setSelectedFile(null)
      setSuccessMessage("Invoice created. OCR and AI processing started in the queue below.")
      router.refresh()
    })
  }

  return (
    <div className="rounded-[12px] border border-[#243047] bg-[#111827] p-3">
      <p className="text-[13px] font-medium text-[#E5E7EB]">Upload Invoice</p>
      <p className="mt-1 text-[12px] text-[#9CA3AF]">
        Supports {formatAcceptedTypes()}.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center rounded-[10px] border border-[#243047] bg-[#172033] px-3 py-2 text-[13px] text-[#E5E7EB] hover:bg-[#243047]">
          Choose File
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
            disabled={isPending}
          />
        </label>
        <span className="max-w-[240px] truncate text-[13px] text-[#9CA3AF]">
          {selectedFileName}
        </span>
      </div>
      <div className="mt-3">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="h-10 rounded-[10px] bg-[#0F766E] px-4 text-white hover:bg-[#115E59] disabled:cursor-not-allowed disabled:bg-[#172033] disabled:text-[#6B7280]"
        >
          {isPending ? "Creating Invoice..." : "Create Invoice from Upload"}
        </Button>
      </div>
      {error ? <p className="mt-2 text-[12px] text-[#FCA5A5]">{error}</p> : null}
      {successMessage ? (
        <p className="mt-2 text-[12px] text-[#86EFAC]">{successMessage}</p>
      ) : null}
    </div>
  )
}
