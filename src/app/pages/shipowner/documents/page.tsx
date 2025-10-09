import { ShipownerSidebar } from "@/components/shipowner-sidebar"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { ProfileDropdown } from "@/components/ProfileDropdown"

export default function ManageDocumentsPage() {
  return (
    <SidebarProvider>
      <ShipownerSidebar />
      <SidebarInset>
        <header className="flex h-12 md:h-14 shrink-0 items-center gap-1 px-3 md:px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
          <div className="flex-1">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/pages/shipowner">Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Manage Documents</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto">
            <ProfileDropdown />
          </div>
        </header>
        <div className="p-3 md:p-4">
          <h1 className="text-xl md:text-2xl font-bold text-[#134686]">Manage Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">Store and organize vessel and operation documents.</p>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

