"use client"

import Link from "next/link"
import { Plus, Sparkles } from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { FilterToolbar } from "@/components/shared/filter-toolbar"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  Product,
  StatusTone,
  StockStatus,
  Supplier,
} from "@/lib/types"
import { createProductAction } from "@/lib/actions"

type InventoryTableClientProps = {
  initialProducts: Product[]
  suppliers: Supplier[]
}

const stockStatusTone: Record<StockStatus, StatusTone> = {
  healthy: "success",
  "near-threshold": "warning",
  "below-threshold": "danger",
  "batch-candidate": "ai",
}

const stockStatusLabel: Record<StockStatus, string> = {
  healthy: "Healthy",
  "near-threshold": "Near Threshold",
  "below-threshold": "Below Threshold",
  "batch-candidate": "Batch Candidate",
}

function formatTrend(value: number) {
  return `${value > 0 ? "+" : ""}${value}%`
}

function trendClassName(value: number) {
  if (value < -20) {
    return "text-[#EF4444]"
  }
  if (value < 0) {
    return "text-[#F59E0B]"
  }
  return "text-[#10B981]"
}

type AddProductPayload = {
  sku: string
  name: string
  category: string
  supplierId: string
  unitCost: number
  initialStock: number
  initialThreshold: number
  maxCapacity: number
}

export function InventoryTableClient({
  initialProducts,
  suppliers,
}: InventoryTableClientProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isPending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)
  const products = initialProducts

  const supplierLookup = useMemo(
    () => new Map(suppliers.map((item) => [item.id, item])),
    [suppliers]
  )

  const filteredProducts = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return products.filter((product) => {
      const supplierName =
        supplierLookup.get(product.supplierId)?.name.toLowerCase() ?? ""
      const statusLabelValue = stockStatusLabel[product.status].toLowerCase()
      const matchesSearch =
        !keyword ||
        [
          product.sku,
          product.name,
          product.category,
          supplierName,
          statusLabelValue,
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword)
      const matchesStatus =
        statusFilter === "all" || product.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [products, query, statusFilter, supplierLookup])

  function handleAddProduct(product: AddProductPayload) {
    setActionError(null)
    startTransition(async () => {
      const result = await createProductAction(product)
      if (!result.ok) {
        setActionError(result.message ?? "Could not save product.")
        return
      }
      setDialogOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <FilterToolbar
        searchPlaceholder="Search products, suppliers, category, or stock status..."
        searchValue={query}
        onSearchChange={setQuery}
        filterLabel="Stock status"
        filterValue={statusFilter}
        onFilterChange={setStatusFilter}
        filterOptions={[
          { label: "All statuses", value: "all" },
          { label: "Healthy", value: "healthy" },
          { label: "Near threshold", value: "near-threshold" },
          { label: "Below threshold", value: "below-threshold" },
          { label: "Batch candidate", value: "batch-candidate" },
        ]}
      />

      <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-[#243047] p-4">
        <div>
          <p className="text-[15px] font-semibold text-[#E5E7EB]">
            Stock list
          </p>
          <p className="mt-0.5 text-[12px] text-[#9CA3AF]">
            {filteredProducts.length} of {products.length} products shown.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              className="h-9 rounded-[10px] bg-[#3B82F6] px-3 text-white hover:bg-[#2563EB]"
            >
              <Plus className="size-4" aria-hidden="true" />
              Add new product
            </Button>
          </DialogTrigger>
          <AddProductDialog
            suppliers={suppliers}
            onSubmit={handleAddProduct}
            pending={isPending}
            actionError={actionError}
          />
        </Dialog>
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-[#243047] hover:bg-transparent">
              <TableHead className="px-4 text-[12px] text-[#9CA3AF]">
                SKU
              </TableHead>
              <TableHead className="text-[12px] text-[#9CA3AF]">
                Product Name
              </TableHead>
              <TableHead className="text-[12px] text-[#9CA3AF]">
                Supplier
              </TableHead>
              <TableHead className="text-[12px] text-[#9CA3AF]">
                Current Stock
              </TableHead>
              <TableHead className="text-[12px] text-[#9CA3AF]">
                Current Threshold
              </TableHead>
              <TableHead className="text-[12px] text-[#9CA3AF]">
                Max Capacity
              </TableHead>
              <TableHead className="text-[12px] text-[#9CA3AF]">
                30D Trend
              </TableHead>
              <TableHead className="text-[12px] text-[#9CA3AF]">
                Stock Status
              </TableHead>
              <TableHead className="text-[12px] text-[#9CA3AF]">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.map((product) => {
              const supplierCount = product.suppliers?.length ?? 1
              const supplierName =
                supplierLookup.get(product.supplierId)?.name ??
                "Unknown supplier"

              return (
                <TableRow
                  key={product.id}
                  className="border-[#243047] hover:bg-[#172033]/70"
                >
                  <TableCell className="px-4 text-[12px] font-medium text-[#E5E7EB]">
                    {product.sku}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] font-medium text-[#E5E7EB]">
                          {product.name}
                        </p>
                        {product.pendingAiAnalysis ? (
                          <StatusBadge
                            label="Recommendation pending"
                            tone="ai"
                          />
                        ) : null}
                      </div>
                      <p className="text-[12px] text-[#6B7280]">
                        {product.category}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-[14px] text-[#9CA3AF]">
                    <div className="flex items-center gap-2">
                      <span>{supplierName}</span>
                      {supplierCount > 1 ? (
                        <StatusBadge
                          label={`+${supplierCount - 1}`}
                          tone="default"
                        />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-[14px] text-[#E5E7EB]">
                    {product.stockOnHand}
                  </TableCell>
                  <TableCell className="text-[14px] text-[#E5E7EB]">
                    {product.pendingAiAnalysis ? (
                      <span className="inline-flex items-center gap-1 text-[#C4B5FD]">
                        <Sparkles className="size-3" aria-hidden="true" />
                        tuning…
                      </span>
                    ) : (
                      product.currentThreshold
                    )}
                  </TableCell>
                  <TableCell className="text-[14px] text-[#9CA3AF]">
                    {product.maxStockAmount.toLocaleString("en-US")}
                  </TableCell>
                  <TableCell
                    className={`text-[14px] ${trendClassName(
                      product.trend30d
                    )}`}
                  >
                    {formatTrend(product.trend30d)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      label={stockStatusLabel[product.status]}
                      tone={stockStatusTone[product.status]}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      asChild
                      variant="outline"
                      className="h-8 rounded-[10px] border-[#243047] bg-[#172033] text-[#E5E7EB] hover:bg-[#243047]"
                    >
                      <Link href={`/inventory/${product.sku}`}>
                        View Details
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
            {filteredProducts.length === 0 ? (
              <TableRow className="border-[#243047] hover:bg-transparent">
                <TableCell
                  colSpan={9}
                  className="px-4 py-8 text-center text-[14px] text-[#6B7280]"
                >
                  No products match the current search and filter.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
      </Card>
    </div>
  )
}

type AddProductDialogProps = {
  suppliers: Supplier[]
  onSubmit: (product: AddProductPayload) => void
  pending?: boolean
  actionError?: string | null
}

function AddProductDialog({
  suppliers,
  onSubmit,
  pending = false,
  actionError,
}: AddProductDialogProps) {
  const [sku, setSku] = useState("")
  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "")
  const [unitCost, setUnitCost] = useState("")
  const [initialStock, setInitialStock] = useState("")
  const [initialThreshold, setInitialThreshold] = useState("")
  const [maxCapacity, setMaxCapacity] = useState("")
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (
      !sku.trim() ||
      !name.trim() ||
      !category.trim() ||
      !supplierId ||
      !initialStock ||
      !initialThreshold ||
      !maxCapacity
    ) {
      setError("Fill in SKU, name, category, supplier, stock, threshold and max capacity.")
      return
    }
    const stockNumber = Number(initialStock)
    const thresholdNumber = Number(initialThreshold)
    const capacityNumber = Number(maxCapacity)
    const unitCostNumber = Number(unitCost) || 0
    if (capacityNumber < thresholdNumber) {
      setError("Max capacity must be greater than or equal to the initial threshold.")
      return
    }

    setError(null)
    onSubmit({
      sku: sku.trim().toUpperCase(),
      name: name.trim(),
      category: category.trim(),
      unitCost: unitCostNumber,
      supplierId,
      initialStock: stockNumber,
      initialThreshold: thresholdNumber,
      maxCapacity: capacityNumber,
    })
  }

  return (
    <DialogContent className="max-w-xl border-[#243047] bg-[#0F1728] text-[#E5E7EB] ring-1 ring-[#243047]">
      <DialogHeader>
        <DialogTitle className="text-[16px] font-semibold text-[#E5E7EB]">
          Add new product
        </DialogTitle>
        <DialogDescription className="text-[12px] text-[#9CA3AF]">
          Seed the SKU with your current stock and threshold. AI will analyse
          velocity, seasonality, and supplier lead time, then propose a tuned
          threshold in the review queue.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="SKU">
            <Input
              value={sku}
              onChange={(event) => setSku(event.target.value)}
              placeholder="SKU-NEW-0001"
              className="h-9 rounded-[10px] border-[#243047] bg-[#0B1220] text-[14px] text-[#E5E7EB] placeholder:text-[#6B7280]"
            />
          </Field>
          <Field label="Category">
            <Input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Pantry"
              className="h-9 rounded-[10px] border-[#243047] bg-[#0B1220] text-[14px] text-[#E5E7EB] placeholder:text-[#6B7280]"
            />
          </Field>
          <Field label="Product name" className="col-span-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Oat Milk 1L 6-pack"
              className="h-9 rounded-[10px] border-[#243047] bg-[#0B1220] text-[14px] text-[#E5E7EB] placeholder:text-[#6B7280]"
            />
          </Field>
          <Field label="Primary supplier" className="col-span-2">
            <select
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
              className="h-9 w-full rounded-[10px] border border-[#243047] bg-[#0B1220] px-3 text-[14px] text-[#E5E7EB] outline-none"
            >
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name} · {supplier.region} · {supplier.leadTimeDays}d
                </option>
              ))}
            </select>
          </Field>
          <Field label="Initial stock">
            <Input
              type="number"
              min={0}
              value={initialStock}
              onChange={(event) => setInitialStock(event.target.value)}
              placeholder="420"
              className="h-9 rounded-[10px] border-[#243047] bg-[#0B1220] text-[14px] text-[#E5E7EB]"
            />
          </Field>
          <Field label="Current threshold">
            <Input
              type="number"
              min={0}
              value={initialThreshold}
              onChange={(event) => setInitialThreshold(event.target.value)}
              placeholder="150"
              className="h-9 rounded-[10px] border-[#243047] bg-[#0B1220] text-[14px] text-[#E5E7EB]"
            />
          </Field>
          <Field label="Max capacity">
            <Input
              type="number"
              min={0}
              value={maxCapacity}
              onChange={(event) => setMaxCapacity(event.target.value)}
              placeholder="1200"
              className="h-9 rounded-[10px] border-[#243047] bg-[#0B1220] text-[14px] text-[#E5E7EB]"
            />
          </Field>
          <Field label="Unit cost (RM)">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={unitCost}
              onChange={(event) => setUnitCost(event.target.value)}
              placeholder="50.00"
              className="h-9 rounded-[10px] border-[#243047] bg-[#0B1220] text-[14px] text-[#E5E7EB]"
            />
          </Field>
        </div>

        <div className="flex items-start gap-2 rounded-[10px] border border-[#8B5CF6]/30 bg-[#8B5CF6]/5 p-3">
          <Sparkles className="size-4 shrink-0 text-[#C4B5FD]" aria-hidden="true" />
          <p className="text-[12px] leading-5 text-[#C4B5FD]">
            After save, the product will appear as{" "}
            <span className="font-semibold">Recommendation pending</span> until
            Bee2Bee has enough stock history to suggest a reorder point.
          </p>
        </div>

        {error || actionError ? (
          <p className="text-[12px] text-[#F87171]">{error ?? actionError}</p>
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
            disabled={pending}
            className="h-9 rounded-[10px] bg-[#3B82F6] px-3 text-white hover:bg-[#2563EB]"
          >
            {pending ? "Saving..." : "Save product"}
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
    <label className={`block ${className ?? ""}`}>
      <span className="text-[11px] font-medium uppercase tracking-wider text-[#6B7280]">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  )
}
