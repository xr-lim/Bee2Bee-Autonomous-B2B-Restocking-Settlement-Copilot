"use client"

import {
  Building2,
  Check,
  ChevronDown,
  Pencil,
  Plus,
  Save,
  Star,
  Truck,
  X,
} from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "motion/react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { Product, StatusTone, Supplier } from "@/lib/types"
import { cn } from "@/lib/utils"

type ProductDetailsEditorProps = {
  product: Product
  suppliers: Supplier[]
  stockStatus?: {
    label: string
    tone: StatusTone
  }
  leadTimeDays?: number
}

type DraftState = {
  stockOnHand: number
  unitCost: number
  aiThreshold: number
  supplierId: string
  trackedSupplierIds: string[]
}

function buildInitialTracked(product: Product): string[] {
  const fromOptions = product.suppliers?.map((item) => item.supplierId) ?? []
  return Array.from(new Set([product.supplierId, ...fromOptions]))
}

export function ProductDetailsEditor({
  product,
  suppliers,
  stockStatus,
  leadTimeDays,
}: ProductDetailsEditorProps) {
  const supplierLookup = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier])),
    [suppliers]
  )

  const [isEditing, setIsEditing] = useState(false)
  const [committed, setCommitted] = useState<DraftState>(() => ({
    stockOnHand: product.stockOnHand,
    unitCost: product.unitCost,
    aiThreshold: product.aiThreshold,
    supplierId: product.supplierId,
    trackedSupplierIds: buildInitialTracked(product),
  }))
  const [draft, setDraft] = useState<DraftState>(committed)
  const [supplierOpen, setSupplierOpen] = useState(false)
  const [showAllSuppliers, setShowAllSuppliers] = useState(false)

  const state = isEditing ? draft : committed
  const primarySupplier = supplierLookup.get(state.supplierId)

  const trackedSuppliers = state.trackedSupplierIds
    .map((id) => supplierLookup.get(id))
    .filter((item): item is Supplier => Boolean(item))

  const supplierOptionsFromProduct = useMemo(() => {
    const map = new Map(
      (product.suppliers ?? []).map((item) => [item.supplierId, item])
    )
    return map
  }, [product.suppliers])

  const selectableSuppliers = useMemo(() => {
    if (showAllSuppliers) return suppliers
    return trackedSuppliers
  }, [showAllSuppliers, suppliers, trackedSuppliers])

  function handleEdit() {
    setDraft(committed)
    setIsEditing(true)
    setSupplierOpen(false)
  }

  function handleCancel() {
    setDraft(committed)
    setIsEditing(false)
    setSupplierOpen(false)
    setShowAllSuppliers(false)
  }

  function handleSave() {
    setCommitted(draft)
    setIsEditing(false)
    setSupplierOpen(false)
    setShowAllSuppliers(false)
  }

  function handleSwitchSupplier(supplierId: string) {
    setDraft((current) => ({
      ...current,
      supplierId,
      trackedSupplierIds: Array.from(
        new Set([supplierId, ...current.trackedSupplierIds])
      ),
    }))
    setSupplierOpen(false)
    setShowAllSuppliers(false)
  }

  function handleAddTracked(supplierId: string) {
    setDraft((current) => ({
      ...current,
      trackedSupplierIds: Array.from(
        new Set([...current.trackedSupplierIds, supplierId])
      ),
    }))
  }

  function handleRemoveTracked(supplierId: string) {
    setDraft((current) => ({
      ...current,
      trackedSupplierIds: current.trackedSupplierIds.filter(
        (id) => id !== supplierId || id === current.supplierId
      ),
    }))
  }

  return (
    <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
      <CardHeader className="border-b border-[#243047] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-[17px] font-semibold text-[#E5E7EB]">
                Product Details
              </CardTitle>
              {stockStatus ? (
                <StatusBadge
                  label={stockStatus.label}
                  tone={stockStatus.tone}
                />
              ) : null}
              {typeof leadTimeDays === "number" ? (
                <span className="rounded-[8px] border border-[#243047] bg-[#172033] px-2 py-0.5 text-[12px] font-medium text-[#9CA3AF]">
                  Lead time · {leadTimeDays}d
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[13px] leading-5 text-[#9CA3AF]">
              Edit stock, unit price, and supplier. Changes stay local to this
              session.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  className="h-9 rounded-[10px] border-[#243047] bg-[#172033] px-3 text-[#E5E7EB] hover:bg-[#243047]"
                >
                  <X className="size-4" aria-hidden="true" />
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  className="h-9 rounded-[10px] bg-[#3B82F6] px-3 text-white hover:bg-[#2563EB]"
                >
                  <Save className="size-4" aria-hidden="true" />
                  Save changes
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={handleEdit}
                className="h-9 rounded-[10px] border-[#243047] bg-[#172033] px-3 text-[#E5E7EB] hover:bg-[#243047]"
              >
                <Pencil className="size-4" aria-hidden="true" />
                Edit
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        <div className="grid grid-cols-2 gap-3">
          <FieldBlock label="SKU">
            <FieldValue>{product.sku}</FieldValue>
          </FieldBlock>

          <FieldBlock label="Stock Quantity" editing={isEditing}>
            {isEditing ? (
              <Input
                type="number"
                min={0}
                value={draft.stockOnHand}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    stockOnHand: Number(event.target.value),
                  }))
                }
                className="h-10 rounded-[10px] border-[#243047] bg-[#0B1220] text-[15px] text-[#E5E7EB]"
              />
            ) : (
              <FieldValue>
                {state.stockOnHand.toLocaleString("en-US")}
              </FieldValue>
            )}
          </FieldBlock>

          <FieldBlock label="Unit Price (USD)" editing={isEditing}>
            {isEditing ? (
              <Input
                type="number"
                min={0}
                step="0.01"
                value={draft.unitCost}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    unitCost: Number(event.target.value),
                  }))
                }
                className="h-10 rounded-[10px] border-[#243047] bg-[#0B1220] text-[15px] text-[#E5E7EB]"
              />
            ) : (
              <FieldValue>${state.unitCost.toFixed(2)}</FieldValue>
            )}
          </FieldBlock>

          <FieldBlock label="AI Threshold" editing={isEditing}>
            {isEditing ? (
              <Input
                type="number"
                min={0}
                value={draft.aiThreshold}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    aiThreshold: Number(event.target.value),
                  }))
                }
                className="h-10 rounded-[10px] border-[#243047] bg-[#0B1220] text-[15px] text-[#E5E7EB]"
              />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-[18px] font-semibold text-[#E5E7EB]">
                  {state.aiThreshold.toLocaleString("en-US")}
                </span>
                <span className="text-[12px] text-[#6B7280]">
                  · static {product.staticThreshold.toLocaleString("en-US")}
                </span>
              </div>
            )}
          </FieldBlock>
        </div>

        <div className="rounded-[12px] border border-[#243047] bg-[#172033]">
          <button
            type="button"
            onClick={() => setSupplierOpen((value) => !value)}
            aria-expanded={supplierOpen}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[#1B263A]"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-[10px] bg-[#3B82F6]/15">
                <Truck className="size-5 text-[#3B82F6]" aria-hidden="true" />
              </div>
              <div>
                <p className="text-[12px] font-medium uppercase tracking-wider text-[#9CA3AF]">
                  Current Supplier
                </p>
                <p className="mt-0.5 text-[16px] font-semibold text-[#E5E7EB]">
                  {primarySupplier?.name ?? "Unknown supplier"}
                </p>
                {primarySupplier ? (
                  <p className="mt-0.5 text-[12px] text-[#6B7280]">
                    {primarySupplier.region} · {primarySupplier.leadTimeDays}d
                    lead · {primarySupplier.reliabilityScore}% reliability
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2 text-[13px] text-[#9CA3AF]">
              <span>{supplierOpen ? "Hide" : "Manage"}</span>
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "size-4 transition-transform",
                  supplierOpen && "rotate-180"
                )}
              />
            </div>
          </button>

          <AnimatePresence initial={false}>
            {supplierOpen ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeInOut" }}
                style={{ overflow: "hidden" }}
              >
                <div className="space-y-4 border-t border-[#243047] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-semibold text-[#E5E7EB]">
                        Tracked suppliers for this SKU
                      </p>
                      <p className="mt-0.5 text-[12px] text-[#9CA3AF]">
                        Switch active supplier or associate another supplier
                        from the registry.
                      </p>
                    </div>
                    {isEditing ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowAllSuppliers((value) => !value)}
                        className="h-8 rounded-[10px] border-[#243047] bg-[#111827] px-2.5 text-[12px] text-[#E5E7EB] hover:bg-[#243047]"
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                        {showAllSuppliers
                          ? "Hide registry"
                          : "Add from supplier list"}
                      </Button>
                    ) : (
                      <Button
                        asChild
                        variant="outline"
                        className="h-8 rounded-[10px] border-[#243047] bg-[#111827] px-2.5 text-[12px] text-[#E5E7EB] hover:bg-[#243047]"
                      >
                        <Link href="/suppliers">
                          <Building2 className="size-3.5" aria-hidden="true" />
                          Open Suppliers page
                        </Link>
                      </Button>
                    )}
                  </div>

                  <ul className="space-y-2">
                    {selectableSuppliers.map((supplier) => {
                      const option = supplierOptionsFromProduct.get(supplier.id)
                      const isCurrent = supplier.id === state.supplierId
                      const isTracked = state.trackedSupplierIds.includes(
                        supplier.id
                      )

                      return (
                        <li
                          key={supplier.id}
                          className={cn(
                            "rounded-[10px] border px-3 py-2.5 transition-colors",
                            isCurrent
                              ? "border-[#3B82F6]/60 bg-[#3B82F6]/10"
                              : "border-[#243047] bg-[#0B1220] hover:border-[#3B82F6]/40"
                          )}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-[14px] font-semibold text-[#E5E7EB]">
                                  {supplier.name}
                                </p>
                                {isCurrent ? (
                                  <StatusBadge label="Active" tone="ai" />
                                ) : null}
                                {option?.preferred ? (
                                  <Star
                                    className="size-3.5 text-[#F59E0B]"
                                    aria-hidden="true"
                                  />
                                ) : null}
                              </div>
                              <p className="mt-0.5 text-[12px] text-[#6B7280]">
                                {supplier.region} · {supplier.leadTimeDays}d
                                lead · {supplier.reliabilityScore}% reliability
                                {option
                                  ? ` · Last deal $${option.lastDealPrice.toFixed(2)}`
                                  : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {isEditing && !isCurrent ? (
                                <Button
                                  type="button"
                                  onClick={() =>
                                    handleSwitchSupplier(supplier.id)
                                  }
                                  className="h-8 rounded-[10px] bg-[#3B82F6] px-2.5 text-[12px] text-white hover:bg-[#2563EB]"
                                >
                                  <Check
                                    className="size-3.5"
                                    aria-hidden="true"
                                  />
                                  Set active
                                </Button>
                              ) : null}
                              {isEditing && !isCurrent && isTracked ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => handleRemoveTracked(supplier.id)}
                                  className="h-8 rounded-[10px] border-[#243047] bg-[#111827] px-2.5 text-[12px] text-[#E5E7EB] hover:bg-[#243047]"
                                >
                                  <X
                                    className="size-3.5"
                                    aria-hidden="true"
                                  />
                                  Untrack
                                </Button>
                              ) : null}
                              {isEditing && !isTracked ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => handleAddTracked(supplier.id)}
                                  className="h-8 rounded-[10px] border-[#243047] bg-[#111827] px-2.5 text-[12px] text-[#E5E7EB] hover:bg-[#243047]"
                                >
                                  <Plus
                                    className="size-3.5"
                                    aria-hidden="true"
                                  />
                                  Track
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                  {!isEditing ? (
                    <p className="text-[12px] text-[#6B7280]">
                      Tip — switch to Edit mode to change the active supplier
                      or track another supplier for this SKU.
                    </p>
                  ) : null}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  )
}

function FieldBlock({
  label,
  editing,
  children,
}: {
  label: string
  editing?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-[10px] border p-3.5",
        editing
          ? "border-[#3B82F6]/40 bg-[#0B1220]"
          : "border-[#243047] bg-[#172033]"
      )}
    >
      <p className="text-[12px] font-medium uppercase tracking-wider text-[#9CA3AF]">
        {label}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function FieldValue({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[18px] font-semibold text-[#E5E7EB]">{children}</p>
  )
}
