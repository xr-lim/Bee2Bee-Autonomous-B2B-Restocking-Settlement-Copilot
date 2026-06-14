"use client"

import { Search, SlidersHorizontal } from "lucide-react"
import type { ReactNode } from "react"

type FilterOption = {
  label: string
  value: string
}

type FilterToolbarProps = {
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  filterLabel?: string
  filterValue?: string
  filterOptions?: FilterOption[]
  onFilterChange?: (value: string) => void
  children?: ReactNode
}

export function FilterToolbar({
  searchPlaceholder = "Search...",
  searchValue,
  onSearchChange,
  filterLabel = "Filter",
  filterValue = "all",
  filterOptions,
  onFilterChange,
  children,
}: FilterToolbarProps) {
  return (
    <div className="flex min-h-12 flex-col gap-3 rounded-[14px] border border-[#243047] bg-[#111827] p-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6B7280]"
          aria-hidden="true"
        />
        <input
          type="search"
          value={searchValue}
          onChange={(event) => onSearchChange?.(event.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 w-full rounded-[10px] border border-transparent bg-[#172033] px-10 text-[14px] text-[#E5E7EB] outline-none placeholder:text-[#6B7280] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
        />
      </div>
      {children || filterOptions ? (
        <div className="flex shrink-0 items-center gap-2">
          {children}
          {filterOptions ? (
            <label className="flex h-9 items-center gap-2 rounded-[10px] border border-[#243047] bg-[#172033] px-3 text-[14px] text-[#E5E7EB]">
              <SlidersHorizontal className="size-4 text-[#9CA3AF]" aria-hidden="true" />
              <span className="sr-only">{filterLabel}</span>
              <select
                value={filterValue}
                onChange={(event) => onFilterChange?.(event.target.value)}
                className="h-full bg-transparent text-[14px] text-[#E5E7EB] outline-none"
                aria-label={filterLabel}
              >
                {filterOptions.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    className="bg-[#111827] text-[#E5E7EB]"
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
