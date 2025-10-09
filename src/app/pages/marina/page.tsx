import { MarinaSidebar } from "@/components/marina-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppHeader } from "@/components/AppHeader"
import { ProtectedRoute } from "@/components/ProtectedRoute"

export default function MarinaPage() {
  return (
    <ProtectedRoute allowedRoles={['MARINA']}>
      <SidebarProvider>
      <MarinaSidebar />
      <SidebarInset>
        <AppHeader 
          breadcrumbs={[
            { label: "Dashboard", href: "/pages/marina" },
            { label: "Marina", isCurrentPage: true }
          ]} 
        />
        <div className="pl-5 pt-0">
          <h1 className="text-lg md:text-lg font-bold text-[#134686]">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-1">Overview of marina operations and regulatory oversight.</p>
        </div>
      </SidebarInset>
    </SidebarProvider>
    </ProtectedRoute>
  )
}