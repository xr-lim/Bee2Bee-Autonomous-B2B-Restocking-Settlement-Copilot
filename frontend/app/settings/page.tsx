import { Bot, ShieldCheck, SlidersHorizontal } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { AiAnalysisPreferences } from "@/components/shared/ai-analysis-preferences"
import { DashboardThresholdAnalysisButton } from "@/components/shared/dashboard-threshold-analysis-button"
import { StatusBadge } from "@/components/shared/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getAiAnalysisPreferencesAction } from "@/lib/actions"

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

export default async function SettingsPage() {
  const aiAnalysisPreferences = await getAiAnalysisPreferencesAction()

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Settings"
        description="Manage workspace preferences and operator controls."
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
            <CardHeader className="border-b border-[#243047] p-4">
              <CardTitle className="text-[16px] font-semibold text-[#E5E7EB]">
                Automation Policies
              </CardTitle>
              <p className="mt-1 text-[13px] text-[#9CA3AF]">
                Review the guardrails used during supplier, stock, and invoice workflows.
              </p>
            </CardHeader>
            <CardContent className="divide-y divide-[#243047] p-0">
              {automationPolicies.map((policy) => (
                <div
                  key={policy.label}
                  className="grid gap-4 p-4 sm:grid-cols-[1fr_160px] sm:items-center"
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

          <Card className="rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0">
            <CardHeader className="border-b border-[#243047] p-4">
              <CardTitle className="text-[16px] font-semibold text-[#E5E7EB]">
                AI Analysis Controls
              </CardTitle>
              <p className="mt-1 text-[13px] text-[#9CA3AF]">
                Run stock threshold review or restock demand analysis when you want a fresh AI pass.
              </p>
            </CardHeader>
            <CardContent className="space-y-5 p-4">
              <AiAnalysisPreferences initialPreferences={aiAnalysisPreferences} />
              <DashboardThresholdAnalysisButton />
            </CardContent>
          </Card>
        </div>

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
