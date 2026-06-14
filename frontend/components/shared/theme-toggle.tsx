"use client"

import { useState } from "react"
import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ThemeMode = "dark" | "light"

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement
  root.classList.toggle("light", mode === "light")
  root.classList.toggle("dark", mode === "dark")
  root.dataset.theme = mode
  window.localStorage.setItem("bee2bee_theme", mode)
}

export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<ThemeMode>(() =>
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("light")
      ? "light"
      : "dark"
  )

  function toggleTheme() {
    const nextMode = mode === "dark" ? "light" : "dark"
    applyTheme(nextMode)
    setMode(nextMode)
  }

  const isLight = mode === "light"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      onClick={toggleTheme}
      className={cn(
        "rounded-2xl border border-[#334155] bg-[#101827]/60 text-[#E5E7EB] hover:bg-[#172033]",
        className
      )}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Switch to dark mode" : "Switch to light mode"}
    >
      {isLight ? (
        <Moon className="size-5" aria-hidden="true" />
      ) : (
        <Sun className="size-5" aria-hidden="true" />
      )}
    </Button>
  )
}
