"use client"

import * as React from "react"
import Image from "next/image"
import { 
  Home,
  Hammer,
  Eye,
  Wrench,
  FileText
} from "lucide-react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"

// Shipyard dashboard navigation data
const shipyardNavData = {
  navMain: [
    {
      title: "Dashboard",
      url: "/pages/shipyard",
      icon: Home,
    },
    {
      title: "Bid Drydock",
      url: "/pages/shipyard/bid-drydock",
      icon: Hammer,
    },
    {
      title: "View & Confirm Bookings",
      url: "/pages/shipyard/view-bookings",
      icon: Eye,
    },
    {
      title: "Drydock Operations",
      url: "/pages/shipyard/drydock-operations",
      icon: Wrench,
    },
    {
      title: "Manage Documents",
      url: "/pages/shipyard/manage-documents",
      icon: FileText,
    },
  ],
}

export function ShipyardSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { user } = useAuth()

  return (
    <Sidebar {...props} className="bg-gray-50">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="h-14" asChild>
              <a href="/pages/shipyard">
                <Image 
                  src="/assets/marinex_logo.png" 
                  alt="Marinex Logo" 
                  width={32} 
                  height={32}
                  className="rounded-full"
                />
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-medium">
                    {user?.fullName || user?.shipyardName || user?.email || "Marine Authority"}
                  </span>
                  <span className="text-xs">Shipyard Portal</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="px-2 pt-0 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Main Menu</div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {shipyardNavData.navMain.map((item) => {
              const isRoot = item.url === "/pages/shipyard"
              const isActive = isRoot
                ? pathname === item.url
                : pathname === item.url || pathname?.startsWith(item.url + "/")
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    className={isActive ? "bg-[#134686] text-white hover:bg-[#0f3a6e]  hover:text-white" : "hover:bg-transparent"}
                  >
                    <a href={item.url}>
                      <item.icon className="size-4" />
                      {item.title}
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
        
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
