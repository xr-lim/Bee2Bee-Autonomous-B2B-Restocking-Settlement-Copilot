"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"

import { PageTransition } from "@/components/layout/page-transition"
import { SidebarNav } from "@/components/layout/sidebar-nav"
import { TopHeader } from "@/components/layout/top-header"
import { AutoAiAnalysisRunner } from "@/components/shared/ai-analysis-preferences"
import { ThemeToggle } from "@/components/shared/theme-toggle"

type AppShellProps = {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()

  // Detach system shell for standalone experiences.
  if (pathname?.startsWith("/chat") || pathname === "/login") {
    return (
      <div className="min-h-screen bg-[#0B1020] text-[#E5E7EB]">
        {pathname?.startsWith("/chat") ? (
          <div className="fixed right-4 top-4 z-50">
            <ThemeToggle />
          </div>
        ) : null}
        {children}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0B1020] text-[#E5E7EB]">
      <AutoAiAnalysisRunner />
      <div className="flex min-h-screen">
        <SidebarNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopHeader />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6 px-4 pb-8 pt-2 sm:px-6 xl:px-8">
              <PageTransition>{children}</PageTransition>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
