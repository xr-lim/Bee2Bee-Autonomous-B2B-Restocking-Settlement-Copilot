import {
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
    shortTitle: "Dash",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Inventory",
    shortTitle: "Stock",
    href: "/inventory",
    icon: PackageSearch,
  },
  {
    title: "Conversations",
    shortTitle: "Inbox",
    href: "/conversations",
    icon: MessageSquareText,
  },
  {
    title: "Invoice Management",
    shortTitle: "Bills",
    href: "/invoice-management",
    icon: ReceiptText,
  },
  {
    title: "Suppliers",
    shortTitle: "Supply",
    href: "/suppliers",
    icon: Truck,
  },
]

export const bottomNavigationItems: NavigationItem[] = [
  {
    title: "Settings",
    shortTitle: "Prefs",
    href: "/settings",
    icon: Settings,
  },
]

export const workspaceNavigationMeta = {
  name: "Bee2Bee Restock Copilot",
  assistantLabel: "Z.AI",
}
