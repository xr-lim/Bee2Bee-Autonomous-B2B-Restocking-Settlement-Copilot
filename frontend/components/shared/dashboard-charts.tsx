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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type StockTrendPoint = {
  date: string
  proteinBars: number
  proteinThreshold: number
  coldBrew: number
  coldBrewThreshold: number
  rice: number
  riceThreshold: number
}

type MonthlyDemandPoint = {
  month: string
  demand: number
  promo: string
}

function ChartCard({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
      <CardHeader className="border-b border-[#243047] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-[17px] font-semibold text-[#E5E7EB]">
              {title}
            </CardTitle>
            <p className="mt-1.5 text-[14px] leading-6 text-[#9CA3AF]">
              {description}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="h-[390px]">{children}</div>
        {footer ? <div>{footer}</div> : null}
      </CardContent>
    </Card>
  )
}

function ChartPlaceholder() {
  return (
    <div className="flex h-full items-end gap-3">
      {[46, 68, 52, 84, 60, 74, 48, 90].map((height, index) => (
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

function subscribeToClientStore() {
  return () => {}
}

function getClientSnapshot() {
  return true
}

function getServerSnapshot() {
  return false
}

export function DashboardCharts({
  monthlyDemandData,
  stockTrendData,
}: {
  monthlyDemandData: MonthlyDemandPoint[]
  stockTrendData: StockTrendPoint[]
}) {
  const mounted = useSyncExternalStore(
    subscribeToClientStore,
    getClientSnapshot,
    getServerSnapshot
  )

  if (stockTrendData.length === 0 || monthlyDemandData.length === 0) {
    return (
      <section className="grid gap-6">
        <ChartCard
          title="Stock Trend Overview"
          description="Current stock and AI threshold movement for priority SKUs."
        >
          <ChartPlaceholder />
        </ChartCard>
        <ChartCard
          title="Monthly Demand Analytics"
          description="Demand pattern with promotion months highlighted for planning."
        >
          <ChartPlaceholder />
        </ChartCard>
      </section>
    )
  }

  const latestStock = stockTrendData[stockTrendData.length - 1]
  const stockHighlights = [
    {
      label: "Protein Bars",
      stock: latestStock.proteinBars,
      threshold: latestStock.proteinThreshold,
      color: "#3B82F6",
    },
    {
      label: "Cold Brew",
      stock: latestStock.coldBrew,
      threshold: latestStock.coldBrewThreshold,
      color: "#10B981",
    },
    {
      label: "Jasmine Rice",
      stock: latestStock.rice,
      threshold: latestStock.riceThreshold,
      color: "#F59E0B",
    },
  ]

  const totalDemand = monthlyDemandData.reduce(
    (total, item) => total + item.demand,
    0
  )
  const peakDemand = monthlyDemandData.reduce((peak, item) =>
    item.demand > peak.demand ? item : peak
  )
  const promoMonths = monthlyDemandData.filter((item) => item.promo !== "Baseline")

  if (!mounted) {
    return (
      <section className="grid gap-6">
        <ChartCard
          title="Stock Trend Overview"
          description="Current stock and AI threshold movement for priority SKUs."
        >
          <ChartPlaceholder />
        </ChartCard>
        <ChartCard
          title="Monthly Demand Analytics"
          description="Demand pattern with promotion months highlighted for planning."
        >
          <ChartPlaceholder />
        </ChartCard>
      </section>
    )
  }

  return (
    <section className="grid gap-6">
      <ChartCard
        title="Stock Trend Overview"
        description="Track priority product stock against dynamic AI reorder thresholds."
        footer={
          <div className="grid grid-cols-3 gap-3">
            {stockHighlights.map((item) => {
              const gap = item.stock - item.threshold

              return (
                <div
                  key={item.label}
                  className="rounded-[10px] border border-[#243047] bg-[#172033] p-4"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <p className="text-[13px] font-medium text-[#E5E7EB]">
                      {item.label}
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[13px]">
                    <Metric label="Stock" value={item.stock.toString()} />
                    <Metric label="AI threshold" value={item.threshold.toString()} />
                    <Metric
                      label="Buffer"
                      value={`${gap > 0 ? "+" : ""}${gap}`}
                      tone={gap < 0 ? "danger" : "success"}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={stockTrendData} margin={{ left: 8, right: 24, top: 12 }}>
            <CartesianGrid stroke="#243047" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={axisStyle} tickLine={false} />
            <YAxis tick={axisStyle} tickLine={false} />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ stroke: "#243047" }}
              labelStyle={tooltipLabelStyle}
            />
            <Legend wrapperStyle={{ color: "#9CA3AF", fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="proteinBars"
              name="Protein Bars"
              stroke="#3B82F6"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="proteinThreshold"
              name="Protein AI Threshold"
              stroke="#3B82F6"
              strokeDasharray="5 5"
              strokeWidth={1.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="coldBrew"
              name="Cold Brew"
              stroke="#10B981"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="coldBrewThreshold"
              name="Cold Brew AI Threshold"
              stroke="#10B981"
              strokeDasharray="5 5"
              strokeWidth={1.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="rice"
              name="Jasmine Rice"
              stroke="#F59E0B"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="riceThreshold"
              name="Rice AI Threshold"
              stroke="#F59E0B"
              strokeDasharray="5 5"
              strokeWidth={1.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title="Monthly Demand Analytics"
        description="Monthly demand with campaign periods highlighted for replenishment timing."
        footer={
          <div className="grid grid-cols-[220px_220px_1fr] gap-3">
            <div className="rounded-[10px] border border-[#243047] bg-[#172033] p-4">
              <p className="text-[13px] text-[#9CA3AF]">Annual demand</p>
              <p className="mt-1.5 text-[20px] font-semibold text-[#E5E7EB]">
                {totalDemand.toLocaleString("en-US")} units
              </p>
            </div>
            <div className="rounded-[10px] border border-[#243047] bg-[#172033] p-4">
              <p className="text-[13px] text-[#9CA3AF]">Peak month</p>
              <p className="mt-1.5 text-[20px] font-semibold text-[#E5E7EB]">
                {peakDemand.month} / {peakDemand.demand.toLocaleString("en-US")}
              </p>
            </div>
            <div className="rounded-[10px] border border-[#243047] bg-[#172033] p-4">
              <p className="text-[13px] text-[#9CA3AF]">Promotion months</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {promoMonths.map((item) => (
                  <span
                    key={`${item.month}-${item.promo}`}
                    className="rounded-[10px] border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-2.5 py-1 text-[12px] font-medium text-[#FBBF24]"
                  >
                    {item.month}: {item.promo}
                  </span>
                ))}
              </div>
            </div>
          </div>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthlyDemandData} margin={{ left: 8, right: 24, top: 12 }}>
            <CartesianGrid stroke="#243047" strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={axisStyle} tickLine={false} />
            <YAxis tick={axisStyle} tickLine={false} />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "#172033" }}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
            />
            <Bar dataKey="demand" name="Demand units" radius={[8, 8, 0, 0]}>
              {monthlyDemandData.map((entry) => (
                <Cell
                  key={entry.month}
                  fill={entry.promo === "Baseline" ? "#3B82F6" : "#F59E0B"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </section>
  )
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: string
  tone?: "default" | "success" | "danger"
}) {
  const valueClassName =
    tone === "success"
      ? "text-[#34D399]"
      : tone === "danger"
        ? "text-[#F87171]"
        : "text-[#E5E7EB]"

  return (
    <div>
      <p className="text-[#6B7280]">{label}</p>
      <p className={`mt-1 font-semibold ${valueClassName}`}>{value}</p>
    </div>
  )
}
