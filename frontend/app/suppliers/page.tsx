import { PageHeader } from "@/components/layout/page-header"
import { SuppliersManager } from "@/components/shared/suppliers-manager"
import { getProducts, getSuppliers } from "@/lib/data"

export const dynamic = "force-dynamic"

export default async function SuppliersPage() {
  const [suppliers, products] = await Promise.all([
    getSuppliers(),
    getProducts(),
  ])

  return (
    <>
      <PageHeader
        eyebrow="Supplier management"
        title="Suppliers"
        description="Maintain the supplier registry, assign SKUs, and keep lead time & reliability signals visible for every negotiation."
      />

      <SuppliersManager
        key={`${suppliers.map((supplier) => supplier.id).join("-")}:${products
          .map((product) => product.suppliers?.map((item) => item.supplierId).join("."))
          .join("-")}`}
        initialSuppliers={suppliers}
        products={products}
      />
    </>
  )
}
