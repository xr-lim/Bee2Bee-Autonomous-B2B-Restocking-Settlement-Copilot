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
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full bg-[#0B1020] text-[#E5E7EB]">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
