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
    <div className="panel-surface rounded-3xl px-5 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#FACC15]/20 bg-[#FACC15]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#FCD34D]">
              <Sparkles className="size-3" aria-hidden="true" />
              {eyebrow}
            </div>
          ) : null}
          <h1 className="max-w-4xl text-[1.7rem] font-semibold leading-tight text-[#F8FAFC] sm:text-[2rem]">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-3xl text-[14px] leading-6 text-[#94A3B8] sm:text-[15px]">
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
