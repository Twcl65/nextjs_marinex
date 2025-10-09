"use client"

import * as React from "react"
import { 
  Home,
  Shield,
  Hammer,
  Eye,
  Clock,
  Users
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

// Marina dashboard navigation data
const marinaNavData = {
  navMain: [
    {
      title: "Dashboard",
      url: "/pages/marina",
      icon: Home,
    },
    {
      title: "Authority Approvals",
      url: "/pages/marina/authority-approvals",
      icon: Shield,
    },
    {
      title: "Shipyard Bidding",
      url: "/pages/marina/shipyard-bidding",
      icon: Hammer,
    },
    {
      title: "Monitor Certifications",
      url: "/pages/marina/monitor-certifications",
      icon: Eye,
    },
    {
      title: "Vessel Recertifications",
      url: "/pages/marina/vessel-recertifications",
      icon: Clock,
    },
    {
      title: "Manage Users",
      url: "/pages/marina/manage-users",
      icon: Users,
    },
  ],
}

export function MarinaSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { user } = useAuth()

  return (
    <Sidebar {...props} className="bg-gray-50">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="h-14" asChild>
              <a href="/pages/marina">
                <div className="bg-[#134686] text-white flex aspect-square size-8 items-center justify-center rounded-full">
                  <span className="text-xs font-bold">M</span>
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-medium">
                    {user?.fullName || user?.shipyardName || user?.email || "Marine Authority"}
                  </span>
                  <span className="text-xs">Marina Portal</span>
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
            {marinaNavData.navMain.map((item) => {
              const isRoot = item.url === "/pages/marina"
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