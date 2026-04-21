"use client"

import { ChevronDown } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useState, type ReactNode } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type CollapsibleSectionProps = {
  title: string
  description?: string
  defaultOpen?: boolean
  headerAccessory?: ReactNode
  contentClassName?: string
  className?: string
  children: ReactNode
}

export function CollapsibleSection({
  title,
  description,
  defaultOpen = true,
  headerAccessory,
  contentClassName,
  className,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Card
      className={cn(
        "rounded-[14px] border border-[#243047] bg-[#111827] py-0 shadow-none ring-0",
        className
      )}
    >
      <CardHeader className="p-0">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className={cn(
            "flex w-full items-start justify-between gap-4 border-b border-transparent p-5 text-left transition-colors hover:bg-[#172033]/40",
            open && "border-[#243047]"
          )}
        >
          <div className="min-w-0 flex-1">
            <CardTitle className="text-[17px] font-semibold text-[#E5E7EB]">
              {title}
            </CardTitle>
            {description ? (
              <p className="mt-1 text-[14px] leading-6 text-[#9CA3AF]">
                {description}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {headerAccessory}
            <div className="flex items-center gap-1.5 text-[13px] text-[#9CA3AF]">
              <span>{open ? "Hide" : "Show"}</span>
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  "size-4 text-[#9CA3AF] transition-transform",
                  open && "rotate-180"
                )}
              />
            </div>
          </div>
        </button>
      </CardHeader>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <CardContent className={cn("p-0", contentClassName)}>
              {children}
            </CardContent>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Card>
  )
}
