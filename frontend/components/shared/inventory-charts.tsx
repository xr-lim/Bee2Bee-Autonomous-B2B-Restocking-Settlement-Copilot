"use client"

import type { ReactNode } from "react"
import { useSyncExternalStore } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type InventoryHealthItem = {
  name: string
  count: number
  color: string
}

type SupplierExposureItem = {
  supplier: string
  products: number
  color: string
}

type ProductStockDemandPoint = {
  month: string
  stock: number
  demand: number
  promotion: string
}

function subscribeToClientStore() {
  return () => {}
}

function getClientSnapshot() {
  return true
}

function getServerSnapshot() {
  return false
}

function ChartCard({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <Card
      className={`rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0 ${className ?? ""}`}
    >
      <CardHeader className="border-b border-[#243047] p-4">
        <CardTitle className="text-[16px] font-semibold text-[#E5E7EB]">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[320px] p-4">{children}</CardContent>
    </Card>
  )
}

function ChartPlaceholder() {
  return (
    <div className="flex h-full items-end gap-3">
      {[50, 76, 42, 88, 62, 70].map((height, index) => (
        <div
          key={index}
          className="flex-1 rounded-t-[8px] bg-[#172033]"
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  )
}

const axisStyle = {
  fill: "#9CA3AF",
  fontSize: 12,
}

const tooltipStyle = {
  backgroundColor: "#111827",
  border: "1px solid #243047",
  borderRadius: 10,
  color: "#E5E7EB",
}

const tooltipLabelStyle = {
  color: "#E5E7EB",
  fontWeight: 600,
}

const tooltipItemStyle = {
  color: "#E5E7EB",
}

export function InventoryListCharts({
  inventoryHealthDistribution,
  supplierExposureData,
}: {
  inventoryHealthDistribution: InventoryHealthItem[]
  supplierExposureData: SupplierExposureItem[]
}) {
  const mounted = useSyncExternalStore(
    subscribeToClientStore,
    getClientSnapshot,
    getServerSnapshot
  )

  if (inventoryHealthDistribution.length === 0 || supplierExposureData.length === 0) {
    return (
      <section className="grid grid-cols-2 gap-6">
        <ChartCard title="Inventory Health Distribution">
          <ChartPlaceholder />
        </ChartCard>
        <ChartCard title="Supplier Exposure Overview">
          <ChartPlaceholder />
        </ChartCard>
      </section>
    )
  }

  if (!mounted) {
    return (
      <section className="grid grid-cols-2 gap-6">
        <ChartCard title="Inventory Health Distribution">
          <ChartPlaceholder />
        </ChartCard>
        <ChartCard title="Supplier Exposure Overview">
          <ChartPlaceholder />
        </ChartCard>
      </section>
    )
  }

  return (
    <section className="grid grid-cols-2 gap-6">
      <ChartCard title="Inventory Health Distribution">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={inventoryHealthDistribution} margin={{ left: 4, right: 16 }}>
            <CartesianGrid stroke="#243047" strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={axisStyle} tickLine={false} />
            <YAxis tick={axisStyle} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "#172033" }}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
            />
            <Bar dataKey="count" name="Products" radius={[8, 8, 0, 0]}>
              {inventoryHealthDistribution.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Supplier Exposure Overview">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={supplierExposureData}
            layout="vertical"
            margin={{ left: 44, right: 16 }}
          >
            <CartesianGrid stroke="#243047" strokeDasharray="3 3" />
            <XAxis type="number" tick={axisStyle} tickLine={false} allowDecimals={false} />
            <YAxis
              dataKey="supplier"
              type="category"
              tick={axisStyle}
              tickLine={false}
              width={128}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "#172033" }}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
            />
            <Bar dataKey="products" name="Tracked products" radius={[0, 8, 8, 0]}>
              {supplierExposureData.map((entry) => (
                <Cell key={entry.supplier} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </section>
  )
}

export function ProductStockDemandChart({ trend }: { trend: ProductStockDemandPoint[] }) {
  const mounted = useSyncExternalStore(
    subscribeToClientStore,
    getClientSnapshot,
    getServerSnapshot
  )

  if (trend.length === 0) {
    return (
      <ChartCard title="365-Day Stock and Demand Trend">
        <ChartPlaceholder />
      </ChartCard>
    )
  }

  const promotions = trend.filter((item) => item.promotion)

  if (!mounted) {
    return (
      <ChartCard title="365-Day Stock and Demand Trend">
        <ChartPlaceholder />
      </ChartCard>
    )
  }

  return (
    <ChartCard title="365-Day Stock and Demand Trend">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trend} margin={{ left: 4, right: 16 }}>
          <CartesianGrid stroke="#243047" strokeDasharray="3 3" />
          <XAxis dataKey="month" tick={axisStyle} tickLine={false} />
          <YAxis tick={axisStyle} tickLine={false} />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ stroke: "#243047" }}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipLabelStyle}
          />
          <Legend wrapperStyle={{ color: "#9CA3AF", fontSize: 12 }} />
          {promotions.map((item) => (
            <ReferenceLine
              key={`${item.month}-${item.promotion}`}
              x={item.month}
              stroke="#F59E0B"
              strokeDasharray="4 4"
              label={{
                value: item.promotion,
                fill: "#F59E0B",
                fontSize: 11,
                position: "top",
              }}
            />
          ))}
          <Line
            type="monotone"
            dataKey="stock"
            name="Stock level"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="demand"
            name="Demand trend"
            stroke="#10B981"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
