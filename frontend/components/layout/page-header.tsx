import type { ReactNode } from "react"

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
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-3 text-[13px] font-medium uppercase tracking-wider text-[#8B5CF6]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[36px] font-semibold leading-tight text-[#E5E7EB]">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-3xl text-[15px] leading-7 text-[#9CA3AF]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  )
}
