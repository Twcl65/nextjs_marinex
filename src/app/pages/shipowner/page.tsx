import { ShipownerSidebar } from "@/components/shipowner-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppHeader } from "@/components/AppHeader"
import { ProtectedRoute } from "@/components/ProtectedRoute"

export default function ShipownerPage() {
  return (
    <ProtectedRoute allowedRoles={['SHIPOWNER']}>
      <SidebarProvider>
        <ShipownerSidebar />
        <SidebarInset>
          <AppHeader 
            breadcrumbs={[
              { label: "Dashboard", href: "/pages/shipowner" },
              { label: "Shipowner", isCurrentPage: true }
            ]} 
          />
          <div className="pl-5 pt-0">
            <h1 className="text-lg md:text-lg font-bold text-[#134686]">Dashboard</h1>
            <p className="text-xs text-muted-foreground mt-1">Overview of key metrics and quick actions.</p>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRoute>
  )
}
