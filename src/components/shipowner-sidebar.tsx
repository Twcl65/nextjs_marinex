"use client"

import * as React from "react"
import { 
  Ship, 
  Home,
  Anchor,
  Compass,
  FileText,
  Clock
} from "lucide-react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"

// Removed collapsible imports since items are flat links
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

// Shipowner dashboard navigation data
const shipownerNavData = {
  navMain: [
    {
      title: "Dashboard",
      url: "/pages/shipowner",
      icon: Home,
    },
    {
      title: "Vessel Management",
      url: "/pages/shipowner/vessel-management",
      icon: Ship,
    },
    {
      title: "Drydock Management",
      url: "/pages/shipowner/drydock-management",
      icon: Anchor,
    },
    {
      title: "Drydock Operation",
      url: "/pages/shipowner/drydock-operation",
      icon: Compass,
    },
    {
      title: "Vessel Recertifications",
      url: "/pages/shipowner/recertifications",
      icon: Clock,
    },
    {
      title: "Manage Documents",
      url: "/pages/shipowner/documents",
      icon: FileText,
    },
  ],
}

export function ShipownerSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { user } = useAuth()

  return (
    <Sidebar {...props}>
      <SidebarHeader className="bg-[#134686]">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="h-13 text-white" asChild>
              <a href="/pages/shipowner">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#134686]">
                  <Ship className="h-5 w-5 text-white" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-medium">
                    {user?.fullName || user?.shipyardName || user?.email || "Marine Authority"}
                  </span>
                  <span className="text-xs">Shipowner Portal</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        
      </SidebarHeader>
      <SidebarContent>
        <div className="px-2 pt-5 pb-0 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Main Menu</div>
        <SidebarGroup>
          <SidebarMenu>
            {shipownerNavData.navMain.map((item) => {
              const isRoot = item.url === "/pages/shipowner"
              const isActive = isRoot
                ? pathname === item.url
                : pathname === item.url || pathname?.startsWith(item.url + "/")
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    className={isActive ? "bg-[#134686] text-white hover:bg-[#0f3a6e] hover:text-white" : "hover:bg-transparent"}
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
