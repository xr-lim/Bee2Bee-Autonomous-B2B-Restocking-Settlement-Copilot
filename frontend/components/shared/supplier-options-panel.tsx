import { Bot, Star } from "lucide-react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Product, Supplier } from "@/lib/types"

type SupplierOptionsPanelProps = {
  product: Product
  suppliers: Supplier[]
}

export function SupplierOptionsPanel({
  product,
  suppliers,
}: SupplierOptionsPanelProps) {
  if (!product.suppliers || product.suppliers.length < 2) {
    return null
  }

  const options = product.suppliers
  const preferred = options.find((option) => option.preferred) ?? options[0]
  const supplierLookup = new Map(suppliers.map((item) => [item.id, item]))
  const preferredSupplier = supplierLookup.get(preferred.supplierId)

  return (
    <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
      <CardHeader className="border-b border-[#243047] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-[16px] font-semibold text-[#E5E7EB]">
              Supplier options
            </CardTitle>
            <p className="mt-1 text-[12px] leading-5 text-[#9CA3AF]">
              AI compares last deal price, lead time, MOQ and reliability across
              all suppliers serving this SKU to pick the right partner for each
              restock.
            </p>
          </div>
          <StatusBadge
            label={`${options.length} suppliers tracked`}
            tone="default"
          />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="grid grid-cols-[1.4fr_repeat(4,1fr)_auto] items-center gap-3 border-b border-[#243047] px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-[#6B7280]">
          <span>Supplier</span>
          <span>Last Deal Price</span>
          <span>Lead Time</span>
          <span>MOQ</span>
          <span>Reliability</span>
          <span className="text-right">AI verdict</span>
        </div>

        <div className="divide-y divide-[#243047]">
          {options.map((option) => {
            const supplier = supplierLookup.get(option.supplierId)
            const isPick = option.supplierId === preferred.supplierId
            const deltaVsCost = option.lastDealPrice - product.unitCost

            return (
              <div
                key={option.supplierId}
                className="grid grid-cols-[1.4fr_repeat(4,1fr)_auto] items-center gap-3 px-4 py-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[14px] font-semibold text-[#E5E7EB]">
                      {supplier?.name ?? option.supplierId}
                    </p>
                    {option.preferred ? (
                      <Star
                        className="size-3.5 shrink-0 text-[#F59E0B]"
                        aria-hidden="true"
                      />
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[12px] text-[#6B7280]">
                    {supplier?.region ?? "—"}
                  </p>
                  {option.note ? (
                    <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#9CA3AF]">
                      {option.note}
                    </p>
                  ) : null}
                </div>

                <div>
                  <p className="text-[14px] font-semibold text-[#E5E7EB]">
                    ${option.lastDealPrice.toFixed(2)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#6B7280]">
                    {formatDealDate(option.lastDealDate)}
                  </p>
                </div>

                <div>
                  <p className="text-[14px] font-semibold text-[#E5E7EB]">
                    {option.leadTimeDays}d
                  </p>
                </div>

                <div>
                  <p className="text-[14px] text-[#E5E7EB]">
                    {option.moq.toLocaleString("en-US")}
                  </p>
                </div>

                <div>
                  <p className="text-[14px] text-[#E5E7EB]">
                    {option.reliabilityScore}%
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {isPick ? (
                    <StatusBadge label="AI pick" tone="ai" />
                  ) : (
                    <StatusBadge label="Alternate" tone="default" />
                  )}
                  <span
                    className={
                      deltaVsCost > 0
                        ? "text-[11px] text-[#F59E0B]"
                        : "text-[11px] text-[#10B981]"
                    }
                  >
                    {deltaVsCost > 0 ? "+" : ""}${deltaVsCost.toFixed(2)} vs cost
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex items-start gap-3 border-t border-[#243047] bg-[#0B1220] p-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[#8B5CF6]/15">
            <Bot className="size-4 text-[#8B5CF6]" aria-hidden="true" />
          </div>
          <p className="text-[12px] leading-5 text-[#9CA3AF]">
            <span className="font-medium text-[#C4B5FD]">AI rationale · </span>
            Selected{" "}
            <span className="font-semibold text-[#E5E7EB]">
              {preferredSupplier?.name ?? preferred.supplierId}
            </span>{" "}
            for this restock cycle.{" "}
            {preferred.note ??
              "Best blended score on last-deal price, reliability and lead time."}{" "}
            The alternate stays warm and is used automatically if the primary
            supplier breaches price, lead time, or allocation limits.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function formatDealDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return `Last deal · ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`
}
