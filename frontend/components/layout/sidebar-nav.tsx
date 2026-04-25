"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { PanelLeft, Sparkles } from "lucide-react"

import {
  bottomNavigationItems,
  navigationItems,
  workspaceNavigationMeta,
} from "@/lib/navigation"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

function SidebarLink({
  href,
  icon: Icon,
  title,
  shortTitle,
  pathname,
  compact = false,
}: {
  href: string
  icon: (typeof navigationItems)[number]["icon"]
  title: string
  shortTitle?: string
  pathname: string
  compact?: boolean
}) {
  const isActive = pathname === href || pathname.startsWith(`${href}/`)
  const label = compact ? shortTitle ?? title : title

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      aria-label={title}
      title={title}
      className={cn(
        "group flex items-center gap-3 rounded-2xl px-3 py-3 text-[13px] font-medium text-[#94A3B8] transition-all duration-200 hover:bg-[#172033] hover:text-[#F8FAFC]",
        compact ? "justify-center px-2 2xl:justify-start 2xl:px-3" : "justify-start",
        isActive &&
          "bg-[linear-gradient(90deg,rgba(250,204,21,0.16),rgba(56,189,248,0.08))] text-[#F8FAFC] ring-1 ring-[#FACC15]/20"
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0 text-[#64748B] transition-colors group-hover:text-[#FCD34D]",
          isActive && "text-[#FCD34D]"
        )}
        aria-hidden="true"
      />
      <span className={cn("truncate", compact && "hidden 2xl:inline")}>
        {label}
      </span>
    </Link>
  )
}

function SidebarContent({
  pathname,
  compact = false,
}: {
  pathname: string
  compact?: boolean
}) {
  return (
    <>
      <div className="flex items-center gap-3 border-b border-[#243047] px-5 py-5">
        <div className="flex size-11 items-center justify-center rounded-[14px] border border-[#FACC15]/25 bg-[radial-gradient(circle_at_center,_rgba(250,204,21,0.4),_rgba(250,204,21,0.12)_58%,_rgba(18,26,43,0.92)_100%)] shadow-lg shadow-[#FACC15]/10">
          <Image
            src="/bee2bee-mark.svg"
            alt="Bee2Bee system icon"
            width={34}
            height={34}
            className="size-8"
            priority
          />
        </div>
        <div className={cn("min-w-0", compact && "hidden 2xl:block")}>
          <p className="truncate text-[14px] font-semibold text-[#F8FAFC]">
            {workspaceNavigationMeta.name}
          </p>
          <p className="truncate text-[12px] text-[#94A3B8]">The Restocker</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-2 px-3 py-4">
        {navigationItems.map((item) => (
          <SidebarLink
            key={item.href}
            href={item.href}
            icon={item.icon}
            title={item.title}
            shortTitle={item.shortTitle}
            pathname={pathname}
            compact={compact}
          />
        ))}
      </nav>

      <div className="space-y-4 border-t border-[#243047] p-4">
        {bottomNavigationItems.map((item) => (
          <SidebarLink
            key={item.href}
            href={item.href}
            icon={item.icon}
            title={item.title}
            shortTitle={item.shortTitle}
            pathname={pathname}
            compact={compact}
          />
        ))}
        <div
          className={cn(
            "rounded-3xl border border-[#243047] bg-[linear-gradient(180deg,rgba(56,189,248,0.08),rgba(15,23,42,0.92))] p-4",
            compact && "hidden 2xl:block"
          )}
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-xl border border-[#38BDF8]/20 bg-[#38BDF8]/10 text-[#7DD3FC]">
              <Sparkles className="size-3.5" aria-hidden="true" />
            </span>
            <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#7DD3FC]">
              AI online
            </span>
          </div>
          <p className="text-[12px] leading-5 text-[#94A3B8]">
            Stock, supplier, invoice, and settlement signals are synchronized for operator review.
          </p>
        </div>
      </div>
    </>
  )
}

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-[96px] shrink-0 border-r border-[#22304A] bg-[#101827]/90 backdrop-blur xl:flex 2xl:w-[272px]">
        <div className="flex w-full flex-col">
          <SidebarContent pathname={pathname} compact />
        </div>
      </aside>

      <div className="fixed left-4 top-4 z-40 xl:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon-lg"
              className="rounded-2xl border-[#334155] bg-[#0F172A]/90 text-[#F8FAFC] shadow-lg shadow-black/20 backdrop-blur hover:bg-[#172033]"
              aria-label="Open navigation"
              title="Open navigation"
            >
              <PanelLeft className="size-5" aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[88vw] max-w-[320px] border-r border-[#22304A] bg-[#101827] p-0 text-[#F8FAFC]"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
              <SheetDescription>Navigate through Bee2Bee pages.</SheetDescription>
            </SheetHeader>
            <div className="flex h-full flex-col">
              <SidebarContent pathname={pathname} />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
