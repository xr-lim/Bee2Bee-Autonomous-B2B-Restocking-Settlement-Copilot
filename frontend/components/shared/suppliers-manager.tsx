"use client"

import {
  Building2,
  CheckSquare,
  ChevronDown,
  Plus,
  Search,
  Square,
  Truck,
} from "lucide-react"
import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "motion/react"

import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { Product, StatusTone, Supplier } from "@/lib/types"
import { cn } from "@/lib/utils"

type SuppliersManagerProps = {
  initialSuppliers: Supplier[]
  products: Product[]
}

type SupplierAssignments = Record<string, Set<string>>

const statusTone: Record<Supplier["status"], StatusTone> = {
  preferred: "success",
  watchlist: "warning",
  inactive: "default",
}

const statusLabel: Record<Supplier["status"], string> = {
  preferred: "Preferred",
  watchlist: "Watchlist",
  inactive: "Inactive",
}

function buildInitialAssignments(
  suppliers: Supplier[],
  products: Product[]
): SupplierAssignments {
  const map: SupplierAssignments = {}
  for (const supplier of suppliers) {
    map[supplier.id] = new Set()
  }
  for (const product of products) {
    if (map[product.supplierId]) {
      map[product.supplierId].add(product.sku)
    }
    for (const option of product.suppliers ?? []) {
      if (!map[option.supplierId]) {
        map[option.supplierId] = new Set()
      }
      map[option.supplierId].add(product.sku)
    }
  }
  return map
}

export function SuppliersManager({
  initialSuppliers,
  products,
}: SuppliersManagerProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers)
  const [assignments, setAssignments] = useState<SupplierAssignments>(() =>
    buildInitialAssignments(initialSuppliers, products)
  )
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const filteredSuppliers = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return suppliers
    return suppliers.filter(
      (supplier) =>
        supplier.name.toLowerCase().includes(keyword) ||
        supplier.region.toLowerCase().includes(keyword) ||
        supplier.id.toLowerCase().includes(keyword)
    )
  }, [query, suppliers])

  function toggleAssignment(supplierId: string, sku: string) {
    setAssignments((current) => {
      const next = { ...current }
      const set = new Set(current[supplierId] ?? [])
      if (set.has(sku)) {
        set.delete(sku)
      } else {
        set.add(sku)
      }
      next[supplierId] = set
      return next
    })
  }

  function handleAddSupplier(supplier: Supplier) {
    setSuppliers((current) => [supplier, ...current])
    setAssignments((current) => ({
      ...current,
      [supplier.id]: new Set<string>(),
    }))
    setDialogOpen(false)
  }

  return (
    <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
      <CardHeader className="flex flex-col gap-3 border-b border-[#243047] p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-[10px] bg-[#3B82F6]/15">
            <Building2 className="size-5 text-[#3B82F6]" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-[18px] font-semibold text-[#E5E7EB]">
              Supplier Registry
            </CardTitle>
            <p className="mt-1 text-[13px] leading-5 text-[#9CA3AF]">
              {suppliers.length} suppliers · click a row to manage SKU
              assignments for that supplier.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6B7280]"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search suppliers…"
              className="h-10 w-[240px] rounded-[10px] border-[#243047] bg-[#0B1220] pl-9 text-[14px] text-[#E5E7EB] placeholder:text-[#6B7280]"
            />
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                className="h-10 rounded-[10px] bg-[#3B82F6] px-3 text-white hover:bg-[#2563EB]"
              >
                <Plus className="size-4" aria-hidden="true" />
                Add supplier
              </Button>
            </DialogTrigger>
            <AddSupplierDialog onSubmit={handleAddSupplier} />
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="grid grid-cols-[1.6fr_1fr_0.8fr_0.8fr_0.8fr_auto] items-center gap-3 border-b border-[#243047] px-5 py-2.5 text-[12px] font-medium uppercase tracking-wider text-[#6B7280]">
          <span>Supplier</span>
          <span>Region</span>
          <span>Lead time</span>
          <span>Reliability</span>
          <span>Status</span>
          <span className="text-right">SKUs</span>
        </div>

        <ul className="divide-y divide-[#243047]">
          {filteredSuppliers.map((supplier) => {
            const assigned = assignments[supplier.id] ?? new Set<string>()
            const isOpen = expanded === supplier.id

            return (
              <li key={supplier.id}>
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((value) =>
                      value === supplier.id ? null : supplier.id
                    )
                  }
                  aria-expanded={isOpen}
                  className={cn(
                    "grid w-full grid-cols-[1.6fr_1fr_0.8fr_0.8fr_0.8fr_auto] items-center gap-3 px-5 py-4 text-left transition-colors",
                    isOpen
                      ? "bg-[#172033]"
                      : "hover:bg-[#172033]/60"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-[10px] bg-[#172033]">
                      <Truck className="size-4 text-[#3B82F6]" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-[#E5E7EB]">
                        {supplier.name}
                      </p>
                      <p className="mt-0.5 font-mono text-[12px] text-[#6B7280]">
                        {supplier.id}
                      </p>
                    </div>
                  </div>
                  <p className="text-[14px] text-[#E5E7EB]">{supplier.region}</p>
                  <p className="text-[14px] text-[#E5E7EB]">
                    {supplier.leadTimeDays}d
                  </p>
                  <p className="text-[14px] text-[#E5E7EB]">
                    {supplier.reliabilityScore}%
                  </p>
                  <div>
                    <StatusBadge
                      label={statusLabel[supplier.status]}
                      tone={statusTone[supplier.status]}
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 text-[13px] text-[#9CA3AF]">
                    <span>
                      {assigned.size} / {products.length}
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        "size-4 transition-transform",
                        isOpen && "rotate-180"
                      )}
                    />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: "easeInOut" }}
                      style={{ overflow: "hidden" }}
                    >
                      <div className="space-y-4 border-t border-[#243047] bg-[#0B1220] px-5 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[13px] font-semibold text-[#E5E7EB]">
                            SKU assignments for {supplier.name}
                          </p>
                          <p className="text-[12px] text-[#9CA3AF]">
                            Tick the SKUs this supplier can serve.
                          </p>
                        </div>
                        <ul className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                          {products.map((product) => {
                            const checked = assigned.has(product.sku)
                            return (
                              <li key={product.sku}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleAssignment(supplier.id, product.sku)
                                  }
                                  className={cn(
                                    "flex w-full items-center gap-3 rounded-[10px] border px-3 py-2.5 text-left transition-colors",
                                    checked
                                      ? "border-[#3B82F6]/55 bg-[#3B82F6]/10"
                                      : "border-[#243047] bg-[#111827] hover:border-[#3B82F6]/30"
                                  )}
                                >
                                  {checked ? (
                                    <CheckSquare
                                      className="size-4 shrink-0 text-[#3B82F6]"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    <Square
                                      className="size-4 shrink-0 text-[#6B7280]"
                                      aria-hidden="true"
                                    />
                                  )}
                                  <div className="min-w-0">
                                    <p className="truncate text-[13px] font-medium text-[#E5E7EB]">
                                      {product.name}
                                    </p>
                                    <p className="font-mono text-[11px] text-[#6B7280]">
                                      {product.sku}
                                    </p>
                                  </div>
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </li>
            )
          })}
          {filteredSuppliers.length === 0 ? (
            <li className="px-5 py-8 text-center text-[13px] text-[#6B7280]">
              No suppliers match "{query}".
            </li>
          ) : null}
        </ul>
      </CardContent>
    </Card>
  )
}

type AddSupplierDialogProps = {
  onSubmit: (supplier: Supplier) => void
}

function AddSupplierDialog({ onSubmit }: AddSupplierDialogProps) {
  const [name, setName] = useState("")
  const [region, setRegion] = useState("")
  const [leadTime, setLeadTime] = useState("")
  const [reliability, setReliability] = useState("")
  const [status, setStatus] = useState<Supplier["status"]>("watchlist")
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!name.trim() || !region.trim() || !leadTime || !reliability) {
      setError("Fill in name, region, lead time, and reliability score.")
      return
    }
    const leadNumber = Number(leadTime)
    const reliabilityNumber = Number(reliability)
    if (reliabilityNumber < 0 || reliabilityNumber > 100) {
      setError("Reliability must be between 0 and 100.")
      return
    }

    onSubmit({
      id: `sup-new-${Date.now()}`,
      name: name.trim(),
      region: region.trim(),
      leadTimeDays: leadNumber,
      reliabilityScore: reliabilityNumber,
      status,
    })

    setName("")
    setRegion("")
    setLeadTime("")
    setReliability("")
    setStatus("watchlist")
    setError(null)
  }

  return (
    <DialogContent className="max-w-lg border-[#243047] bg-[#0F1728] text-[#E5E7EB] ring-1 ring-[#243047]">
      <DialogHeader>
        <DialogTitle className="text-[16px] font-semibold text-[#E5E7EB]">
          Add new supplier
        </DialogTitle>
        <DialogDescription className="text-[12px] text-[#9CA3AF]">
          Seed the supplier in the registry, then assign SKUs from the row that
          appears in the list.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Supplier name" className="col-span-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Northern Harvest Co."
              className="h-10 rounded-[10px] border-[#243047] bg-[#0B1220] text-[14px] text-[#E5E7EB] placeholder:text-[#6B7280]"
            />
          </Field>
          <Field label="Region">
            <Input
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              placeholder="KL, Malaysia"
              className="h-10 rounded-[10px] border-[#243047] bg-[#0B1220] text-[14px] text-[#E5E7EB] placeholder:text-[#6B7280]"
            />
          </Field>
          <Field label="Status">
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as Supplier["status"])
              }
              className="h-10 w-full rounded-[10px] border border-[#243047] bg-[#0B1220] px-3 text-[14px] text-[#E5E7EB] outline-none"
            >
              <option value="preferred">Preferred</option>
              <option value="watchlist">Watchlist</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          <Field label="Lead time (days)">
            <Input
              type="number"
              min={0}
              value={leadTime}
              onChange={(event) => setLeadTime(event.target.value)}
              placeholder="14"
              className="h-10 rounded-[10px] border-[#243047] bg-[#0B1220] text-[14px] text-[#E5E7EB]"
            />
          </Field>
          <Field label="Reliability (%)">
            <Input
              type="number"
              min={0}
              max={100}
              value={reliability}
              onChange={(event) => setReliability(event.target.value)}
              placeholder="92"
              className="h-10 rounded-[10px] border-[#243047] bg-[#0B1220] text-[14px] text-[#E5E7EB]"
            />
          </Field>
        </div>

        {error ? (
          <p className="text-[12px] text-[#F87171]">{error}</p>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-[10px] border-[#243047] bg-[#172033] px-3 text-[#E5E7EB] hover:bg-[#243047]"
            >
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="submit"
            className="h-9 rounded-[10px] bg-[#3B82F6] px-3 text-white hover:bg-[#2563EB]"
          >
            Save supplier
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={cn("block", className)}>
      <span className="text-[11px] font-medium uppercase tracking-wider text-[#6B7280]">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  )
}
