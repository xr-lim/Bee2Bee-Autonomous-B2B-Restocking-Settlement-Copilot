"use client"

import type { ReactNode } from "react"
import { useSyncExternalStore } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type InvoiceRiskLevelItem = {
  name: string
  count: number
  color: string
}

type ApprovalPipelineItem = {
  name: string
  count: number
  color: string
}

type SupplierInvoiceVolumeItem = {
  supplier: string
  invoices: number
  color: string
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

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
      <CardHeader className="border-b border-[#243047] p-4">
        <CardTitle className="text-[16px] font-semibold text-[#E5E7EB]">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[280px] p-4">{children}</CardContent>
    </Card>
  )
}

function ChartPlaceholder() {
  return (
    <div className="flex h-full items-end gap-3">
      {[62, 88, 50, 72].map((height, index) => (
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

export function InvoiceCharts({
  approvalPipelineDistribution,
  invoiceRiskLevelDistribution,
  supplierInvoiceVolume,
}: {
  approvalPipelineDistribution: ApprovalPipelineItem[]
  invoiceRiskLevelDistribution: InvoiceRiskLevelItem[]
  supplierInvoiceVolume: SupplierInvoiceVolumeItem[]
}) {
  const mounted = useSyncExternalStore(
    subscribeToClientStore,
    getClientSnapshot,
    getServerSnapshot
  )

  if (
    approvalPipelineDistribution.length === 0 ||
    invoiceRiskLevelDistribution.length === 0 ||
    supplierInvoiceVolume.length === 0
  ) {
    return (
      <section className="grid grid-cols-3 gap-6">
        <ChartCard title="Invoice Risk Distribution">
          <ChartPlaceholder />
        </ChartCard>
        <ChartCard title="Approval Pipeline">
          <ChartPlaceholder />
        </ChartCard>
        <ChartCard title="Supplier Invoice Volume">
          <ChartPlaceholder />
        </ChartCard>
      </section>
    )
  }

  if (!mounted) {
    return (
      <section className="grid grid-cols-3 gap-6">
        <ChartCard title="Invoice Risk Distribution">
          <ChartPlaceholder />
        </ChartCard>
        <ChartCard title="Approval Pipeline">
          <ChartPlaceholder />
        </ChartCard>
        <ChartCard title="Supplier Invoice Volume">
          <ChartPlaceholder />
        </ChartCard>
      </section>
    )
  }

  return (
    <section className="grid grid-cols-3 gap-6">
      <ChartCard title="Invoice Risk Distribution">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={tooltipStyle}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
            />
            <Pie
              data={invoiceRiskLevelDistribution}
              dataKey="count"
              nameKey="name"
              innerRadius={54}
              outerRadius={92}
              paddingAngle={3}
            >
              {invoiceRiskLevelDistribution.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Approval Pipeline">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={approvalPipelineDistribution} margin={{ left: 4, right: 12 }}>
            <CartesianGrid stroke="#243047" strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={axisStyle} tickLine={false} />
            <YAxis tick={axisStyle} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "#172033" }}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
            />
            <Bar dataKey="count" name="Invoices" radius={[8, 8, 0, 0]}>
              {approvalPipelineDistribution.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Supplier Invoice Volume">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={supplierInvoiceVolume}
            layout="vertical"
            margin={{ left: 36, right: 12 }}
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
            <Bar dataKey="invoices" name="Invoices" radius={[0, 8, 8, 0]}>
              {supplierInvoiceVolume.map((entry) => (
                <Cell key={entry.supplier} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </section>
  )
}
