"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { BadgeCheck, KeyRound, Lock, Mail, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const MOCK_LOGIN_CREDENTIALS = {
  email: "merchant.admin@bee2bee.local",
  password: "Bee2Bee@2026",
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [status, setStatus] = useState<"idle" | "filled" | "signed-in">("idle")

  function autofillCredentials() {
    setEmail(MOCK_LOGIN_CREDENTIALS.email)
    setPassword(MOCK_LOGIN_CREDENTIALS.password)
    setStatus("filled")
  }

  function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    window.localStorage.setItem(
      "bee2bee_mock_session",
      JSON.stringify({
        email,
        signedInAt: new Date().toISOString(),
      })
    )
    setStatus("signed-in")
    router.push("/dashboard")
  }

  return (
    <main className="min-h-screen bg-[#0B1020] px-4 py-10 text-[#E5E7EB] sm:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1fr_460px]">
        <section className="space-y-6">
          <div className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#FACC15]/25 bg-[#FACC15]/10 px-4 text-[13px] font-semibold text-[#FCD34D]">
            <Sparkles className="size-4" aria-hidden="true" />
            Bee2Bee Mock Access
          </div>
          <div className="max-w-2xl">
            <h1 className="text-[42px] font-semibold leading-tight text-[#F8FAFC] sm:text-[56px]">
              Bee2Bee Restock Copilot
            </h1>
            <p className="mt-4 text-[16px] leading-7 text-[#94A3B8]">
              Sign in with the demo operator profile to review stock pressure,
              supplier negotiations, thresholds, and invoice risk.
            </p>
          </div>
          <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
            {["Inventory", "Thresholds", "Invoices"].map((label) => (
              <div
                key={label}
                className="rounded-[14px] border border-[#243047] bg-[#111827] p-4"
              >
                <p className="text-[13px] text-[#94A3B8]">{label}</p>
                <p className="mt-2 text-[15px] font-semibold text-[#E5E7EB]">
                  Operator ready
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[18px] border border-[#243047] bg-[#111827] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.35)]">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.22em] text-[#FCD34D]">
                Login
              </p>
              <h2 className="mt-2 text-[26px] font-semibold text-[#F8FAFC]">
                Operator access
              </h2>
            </div>
            <div className="flex size-11 items-center justify-center rounded-2xl border border-[#38BDF8]/25 bg-[#38BDF8]/10 text-[#7DD3FC]">
              <KeyRound className="size-5" aria-hidden="true" />
            </div>
          </div>

          <form onSubmit={signIn} className="space-y-5">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-[13px] font-medium text-[#9CA3AF]">
                <Mail className="size-4" aria-hidden="true" />
                Email
              </span>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="merchant.admin@bee2bee.local"
                required
                className="h-11 rounded-[12px] border-[#243047] bg-[#172033] px-4 text-[#E5E7EB] placeholder:text-[#64748B]"
              />
            </label>

            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-[13px] font-medium text-[#9CA3AF]">
                <Lock className="size-4" aria-hidden="true" />
                Password
              </span>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Bee2Bee@2026"
                required
                className="h-11 rounded-[12px] border-[#243047] bg-[#172033] px-4 text-[#E5E7EB] placeholder:text-[#64748B]"
              />
            </label>

            <Button
              type="button"
              variant="outline"
              onClick={autofillCredentials}
              className="h-11 w-full rounded-[12px] border-[#FACC15]/25 bg-[#FACC15]/10 text-[#FCD34D] hover:bg-[#FACC15]/15 hover:text-[#FEF3C7]"
            >
              <BadgeCheck className="size-4" aria-hidden="true" />
              Use demo credentials
            </Button>

            <Button
              type="submit"
              className="h-11 w-full rounded-[12px] bg-[#3B82F6] text-white hover:bg-[#2563EB]"
            >
              Sign in
            </Button>
          </form>

          <div className="mt-5 rounded-[12px] border border-[#243047] bg-[#172033] p-4 text-[13px] leading-6 text-[#94A3B8]">
            <p className="font-medium text-[#E5E7EB]">Mock credential</p>
            <p className="mt-1">Email: {MOCK_LOGIN_CREDENTIALS.email}</p>
            <p>Password: {MOCK_LOGIN_CREDENTIALS.password}</p>
            {status === "filled" ? (
              <p className="mt-2 text-[#86EFAC]">
                Credentials filled. Click sign in to continue.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  )
}
