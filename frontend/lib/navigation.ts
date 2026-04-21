import {
  Bot,
  MessageSquareText,
  LayoutDashboard,
  PackageSearch,
  ReceiptText,
  Settings,
  Truck,
} from "lucide-react"

import type { NavigationItem } from "@/lib/types"

export const navigationItems: NavigationItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Inventory",
    href: "/inventory",
    icon: PackageSearch,
  },
  {
    title: "Conversations",
    href: "/conversations",
    icon: MessageSquareText,
  },
  {
    title: "Invoice Management",
    href: "/invoice-management",
    icon: ReceiptText,
  },
  {
    title: "Suppliers",
    href: "/suppliers",
    icon: Truck,
  },
]

export const bottomNavigationItems: NavigationItem[] = [
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
]

export const workspaceNavigationMeta = {
  name: "Bee2Bee Restock Copilot",
  assistantLabel: "Z.AI",
  assistantIcon: Bot,
}
