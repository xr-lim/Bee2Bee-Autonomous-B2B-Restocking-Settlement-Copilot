import { Bell, Bot, Command, ScanSearch } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

export function TopHeader() {
  return (
    <header className="sticky top-0 z-20 flex h-20 shrink-0 items-center justify-between border-b border-[#22304A] bg-[#0B1020]/85 px-4 backdrop-blur sm:px-6">
      <div className="hidden items-center gap-3 lg:flex">
        <div className="flex h-10 items-center gap-2 rounded-2xl border border-[#334155] bg-[#101827]/80 px-3 text-[13px] text-[#94A3B8]">
          <ScanSearch className="size-4 text-[#7DD3FC]" aria-hidden="true" />
          Monitoring supplier signals, stock pressure, and invoice risk
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <div className="hidden h-10 items-center gap-2 rounded-2xl border border-[#FACC15]/20 bg-[#FACC15]/10 px-3 text-[12px] font-semibold text-[#FCD34D] md:flex">
          <Command className="size-4" aria-hidden="true" />
          Bee2Bee Ops
        </div>

        <div className="hidden h-10 items-center gap-2 rounded-2xl border border-[#38BDF8]/20 bg-[#38BDF8]/10 px-3 text-[12px] font-semibold text-[#7DD3FC] md:flex">
          <Bot className="size-4" aria-hidden="true" />
          AI Active
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="relative rounded-2xl border border-transparent text-[#9CA3AF] hover:border-[#334155] hover:bg-[#172033] hover:text-[#E5E7EB]"
          aria-label="Notifications"
        >
          <Bell className="size-5" aria-hidden="true" />
          <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-[#EF4444]" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="rounded-2xl border border-[#334155] bg-[#101827]/60 text-[#E5E7EB] hover:bg-[#172033]"
          aria-label="Open user menu"
        >
          <Avatar className="size-8 border border-[#243047]">
            <AvatarFallback className="bg-[#172033] text-[12px] font-semibold text-[#E5E7EB]">
              MA
            </AvatarFallback>
          </Avatar>
        </Button>
      </div>
    </header>
  )
}
