import { Bot, ShieldCheck, SlidersHorizontal } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const automationPolicies = [
  {
    label: "Autonomous supplier negotiation",
    value: "Enabled",
    detail: "AI can negotiate within approved price and quantity guardrails.",
  },
  {
    label: "Invoice auto-routing",
    value: "Risk based",
    detail: "Low-risk invoices route to approval; exceptions stay in review.",
  },
  {
    label: "Restock approval trigger",
    value: "Merchant confirms",
    detail: "The operator approves restock once before AI automates execution.",
  },
]

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Settings"
        description="Configure workspace preferences, automation policies, and dashboard controls."
      />

      <section className="grid grid-cols-[1fr_360px] gap-6">
        <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
          <CardHeader className="border-b border-[#243047] p-4">
            <CardTitle className="text-[16px] font-semibold text-[#E5E7EB]">
              Automation Policies
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-[#243047] p-0">
            {automationPolicies.map((policy) => (
              <div
                key={policy.label}
                className="grid grid-cols-[1fr_160px] items-center gap-4 p-4"
              >
                <div>
                  <p className="text-[14px] font-medium text-[#E5E7EB]">
                    {policy.label}
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-[#9CA3AF]">
                    {policy.detail}
                  </p>
                </div>
                <StatusBadge label={policy.value} tone="ai" />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-[10px] bg-[#8B5CF6]/10 text-[#C4B5FD]">
                  <Bot className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#E5E7EB]">
                    AI Active
                  </p>
                  <p className="mt-1 text-[12px] text-[#9CA3AF]">
                    Monitoring stock, supplier, and invoice signals.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-[10px] bg-[#10B981]/10 text-[#10B981]">
                  <ShieldCheck className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#E5E7EB]">
                    Guardrails Synced
                  </p>
                  <p className="mt-1 text-[12px] text-[#9CA3AF]">
                    Price ranges and risk rules match the demo dataset.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-[10px] bg-[#3B82F6]/10 text-[#3B82F6]">
                  <SlidersHorizontal className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#E5E7EB]">
                    Review Mode
                  </p>
                  <p className="mt-1 text-[12px] text-[#9CA3AF]">
                    Demo workspace uses mock data only; no backend actions run.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  )
}
