import type { ReactNode } from "react"
import { Sparkles } from "lucide-react"

type PageHeaderProps = {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <div className="panel-surface rounded-3xl px-6 py-6 sm:px-7 sm:py-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#FACC15]/20 bg-[#FACC15]/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#FCD34D]">
              <Sparkles className="size-3.5" aria-hidden="true" />
              {eyebrow}
            </div>
          ) : null}
          <h1 className="max-w-4xl text-[2rem] font-semibold leading-tight text-[#F8FAFC] sm:text-[2.35rem]">
            {title}
          </h1>
          {description ? (
            <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[#94A3B8] sm:text-[16px]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </div>
  )
}
