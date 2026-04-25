"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

type InvoiceFilePreviewProps = {
  fileUrl?: string | null
  invoiceNumber: string
  supplierName: string
  amount: number
  currency: string
  dueDate: string
  paymentTerms: string
  sourceType: "PDF" | "Image" | "Email Attachment" | "Upload"
}

function isPdfSource(sourceType: InvoiceFilePreviewProps["sourceType"], fileUrl?: string | null) {
  return sourceType === "PDF" || fileUrl?.toLowerCase().endsWith(".pdf")
}

export function InvoiceFilePreview({
  fileUrl,
  invoiceNumber,
  supplierName,
  amount,
  currency,
  dueDate,
  paymentTerms,
  sourceType,
}: InvoiceFilePreviewProps) {
  const previewIsPdf = isPdfSource(sourceType, fileUrl)
  const pdfViewerUrl = previewIsPdf && fileUrl ? `${fileUrl}#toolbar=0&navpanes=0&view=FitH` : null

  const previewCard = (
    <div className="flex h-[360px] flex-col rounded-[12px] border border-[#243047] bg-[#F8FAFC] p-5 text-left text-[#111827] transition hover:border-[#3B82F6] hover:shadow-[0_16px_40px_rgba(59,130,246,0.18)]">
      <div className="mb-6 flex items-center justify-between border-b border-[#CBD5E1] pb-3">
        <span className="text-[13px] font-semibold">INVOICE</span>
        <span className="text-[13px]">{invoiceNumber}</span>
      </div>
      <div className="space-y-3 text-[13px]">
        <p className="font-semibold">{supplierName}</p>
        <p>
          Amount: {currency} {amount.toLocaleString("en-US")}
        </p>
        <p>Due: {dueDate}</p>
        <p>Terms: {paymentTerms}</p>
      </div>
      <div className="mt-auto space-y-2">
        <div className="h-3 rounded bg-[#CBD5E1]" />
        <div className="h-3 w-4/5 rounded bg-[#CBD5E1]" />
        <div className="h-3 w-2/3 rounded bg-[#CBD5E1]" />
      </div>
    </div>
  )

  if (!fileUrl) {
    return previewCard
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="w-full text-left">
          {previewCard}
        </button>
      </DialogTrigger>
      <DialogContent className="w-[min(96vw,1200px)] max-w-none border-[#243047] bg-[#0F1728] p-0 text-[#E5E7EB] ring-1 ring-[#243047] sm:max-w-none">
        <DialogHeader className="border-b border-[#243047] p-5 pr-12">
          <DialogTitle className="text-[16px] font-semibold text-[#E5E7EB]">
            Original Invoice File
          </DialogTitle>
          <DialogDescription className="text-[12px] text-[#9CA3AF]">
            Previewing invoice {invoiceNumber}. This is the original uploaded{" "}
            {previewIsPdf ? "PDF" : "image"} file.
          </DialogDescription>
        </DialogHeader>
        <div className="h-[82vh] overflow-hidden bg-[#0B1020]">
          {previewIsPdf ? (
            <iframe
              src={pdfViewerUrl ?? fileUrl ?? undefined}
              title={`Invoice ${invoiceNumber}`}
              className="h-full w-full bg-white"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fileUrl}
              alt={`Invoice ${invoiceNumber}`}
              className="h-full w-full bg-[#F8FAFC] object-contain"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
