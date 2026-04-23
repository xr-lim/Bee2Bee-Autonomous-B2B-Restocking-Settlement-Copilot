"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"

import { SidebarNav } from "@/components/layout/sidebar-nav"
import { TopHeader } from "@/components/layout/top-header"

type AppShellProps = {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  
  // Detach system shell for the chat interfaces
  if (pathname?.startsWith("/chat")) {
    return <div className="min-h-screen bg-[#0B1020] text-[#E5E7EB]">{children}</div>
  }

  return (
    <div className="min-h-screen bg-[#0B1020] text-[#E5E7EB]">
      <div className="flex min-h-screen">
        <SidebarNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopHeader />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full flex-col p-6 max-w-[1600px] gap-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
