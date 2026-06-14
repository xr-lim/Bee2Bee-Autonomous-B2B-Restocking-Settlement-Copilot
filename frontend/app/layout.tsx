import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { AppShell } from "@/components/layout/app-shell"

import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Bee2Bee Restock Copilot",
  description: "Autonomous restocking and settlement command center",
  icons: {
    icon: "/bee2bee-mark.svg",
    shortcut: "/bee2bee-mark.svg",
    apple: "/bee2bee-mark.svg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const themeScript = `
    (() => {
      try {
        const stored = window.localStorage.getItem("bee2bee_theme");
        const mode = stored === "light" ? "light" : "dark";
        document.documentElement.classList.toggle("light", mode === "light");
        document.documentElement.classList.toggle("dark", mode === "dark");
        document.documentElement.dataset.theme = mode;
      } catch (_) {
        document.documentElement.classList.add("dark");
        document.documentElement.dataset.theme = "dark";
      }
    })();
  `

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-[#0B1020] text-[#E5E7EB]">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
