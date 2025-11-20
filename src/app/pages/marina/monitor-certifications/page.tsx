"use client"

import { MarinaSidebar } from "@/components/marina-sidebar"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Bell, Mail, Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { useState, useEffect } from "react"

// Helper function for initials
const getInitialsHelper = (name: string | null) => {
  if (!name) return '?'
  return name.split(' ').map(word => word.charAt(0)).join('').toUpperCase().slice(0, 2)
}

// CompanyLogo component to handle S3 signed URLs
function CompanyLogo({ logoUrl, companyName }: { logoUrl: string | null; companyName: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    if (logoUrl && logoUrl !== 'null' && logoUrl.trim() !== '') {
      setImageError(false)
      
      if (logoUrl.includes('s3.amazonaws.com')) {
        // Fetch signed URL for S3 images
        fetch(`/api/signed-url?url=${encodeURIComponent(logoUrl)}`)
          .then(res => res.json())
          .then(data => {
            if (data.signedUrl) {
              setImageUrl(data.signedUrl)
            }
          })
          .catch(err => {
            console.error('Error fetching signed URL:', err)
            setImageUrl(logoUrl) // Fallback to original URL
          })
      } else {
        // For non-S3 URLs, use directly
        setImageUrl(logoUrl)
      }
    } else {
      setImageUrl(null)
      setImageError(false)
    }
  }, [logoUrl])

  if (imageError || !imageUrl) {
    return (
      <Avatar className="h-5 w-5">
        <AvatarFallback>{getInitialsHelper(companyName)}</AvatarFallback>
      </Avatar>
    )
  }

  return (
    <Avatar className="h-5 w-5">
      <AvatarImage src={imageUrl} alt={companyName} />
      <AvatarFallback>{getInitialsHelper(companyName)}</AvatarFallback>
    </Avatar>
  )
}

interface Vessel {
  id: string
  vesselName: string
  imoNumber: string
  shipType: string
  yearOfBuild: number
  vesselCertificationExpiry: string | null
  isNotified?: boolean
  user: {
    id: string
    fullName: string | null
    email: string
    logoUrl: string | null
  }
}

interface VesselResponse {
  vessels: Vessel[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export default function MonitorCertificationsPage() {
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 5,
    total: 0,
    totalPages: 0
  })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null)
  const [requirements, setRequirements] = useState({
    drydockReport: false,
    drydockCertificate: false,
    safetyCertificate: false,
    vesselPlans: false
  })
  const [submitting, setSubmitting] = useState(false)

  const fetchVessels = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        search,
        status,
        page: currentPage.toString(),
        limit: "5"
      })
      
      const response = await fetch(`/api/vessels?${params}`)
      const data: VesselResponse = await response.json()
      
      setVessels(data.vessels)
      setPagination(data.pagination)
    } catch (error) {
      console.error("Error fetching vessels:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVessels()
  }, [search, status, currentPage])

  const getExpiryStatus = (expiryDate: string | null) => {
    if (!expiryDate) return { label: "No expiry", color: "default" }
    
    const expiry = new Date(expiryDate)
    const now = new Date()
    const diffTime = expiry.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 0) {
      return { label: "EXPIRED", color: "destructive" }
    } else if (diffDays <= 30) {
      return { label: "URGENT", color: "destructive" }
    } else if (diffDays <= 150) {
      const months = Math.ceil(diffDays / 30)
      return { label: `${months} MONTHS`, color: "destructive" }
    } else {
      return { label: "Valid", color: "default" }
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A"
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    })
  }

  const getInitials = (name: string | null) => {
    if (!name) return "U"
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
  }

  const handleNotifyClick = (vessel: Vessel) => {
    setSelectedVessel(vessel)
    setRequirements({
      drydockReport: false,
      drydockCertificate: false,
      safetyCertificate: false,
      vesselPlans: false
    })
    setDialogOpen(true)
  }

  const handleNotifySubmit = async () => {
    if (!selectedVessel) return

    // Check if at least one requirement is selected
    if (!requirements.drydockReport && !requirements.drydockCertificate && 
        !requirements.safetyCertificate && !requirements.vesselPlans) {
      alert("Please select at least one requirement")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/mc-notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: selectedVessel.user.id,
          vesselId: selectedVessel.id,
          drydockReport: requirements.drydockReport,
          drydockCertificate: requirements.drydockCertificate,
          safetyCertificate: requirements.safetyCertificate,
          vesselPlans: requirements.vesselPlans,
        }),
      })

      if (response.ok) {
        setDialogOpen(false)
        // Refresh vessels to update the status
        fetchVessels()
      } else {
        const error = await response.json()
        alert(error.error || "Failed to send notification")
      }
    } catch (error) {
      console.error("Error sending notification:", error)
      alert("Failed to send notification")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SidebarProvider>
      <MarinaSidebar />
      <SidebarInset>
        <header className="flex h-12 md:h-14 shrink-0 items-center gap-1 px-3 md:px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
          <div className="flex-1">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/pages/marina">Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Monitor Certifications</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto flex items-center gap-2">
         
            <ProfileDropdown />
          </div>
        </header>
        
        <div className="p-5 pt-0 mt-0">
          <div className="mb-6">
          <h1 className="text-md md:text-xl font-bold text-[#134686]">Monitor Certifications</h1>
            <p className="text-sm text-gray-500 mt-1">Click the select vessel and fill in the drydock request details.</p>
          </div>

          {/* Filters and Search */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Status:</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="valid">Valid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search vessel or IMO..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 w-[220px]"
                />
              </div>
            </div>
            <Button variant="outline" onClick={() => { setSearch(""); setStatus("all") }}>
              Clear Filters
            </Button>
          </div>

          {/* Vessel Certifications Table */}
          <div className="border rounded-xs">
            <Table>
              <TableHeader>
                <TableRow className="h-8 [&_th]:py-2">
                  <TableHead>Company</TableHead>
                  <TableHead>Vessel Name</TableHead>
                  <TableHead>IMO Number</TableHead>
                  <TableHead>Ship Type</TableHead>
                  <TableHead>Year Built</TableHead>
                  <TableHead className="flex items-center gap-1">
                    Vessel Expiration
                    <ChevronUp className="h-3 w-3" />
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-5">
                      Loading vessels...
                    </TableCell>
                  </TableRow>
                ) : vessels.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-5">
                      No vessels found
                    </TableCell>
                  </TableRow>
                ) : (
                  vessels.map((vessel) => {
                    const expiryStatus = getExpiryStatus(vessel.vesselCertificationExpiry)
                    return (
                      <TableRow key={vessel.id} className="h-13 [&_td]:py-1">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <CompanyLogo logoUrl={vessel.user.logoUrl} companyName={vessel.user.fullName || "Unknown Company"} />
                            <span className="font-medium">{vessel.user.fullName || "Unknown Company"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-small">{vessel.vesselName}</TableCell>
                        <TableCell>{vessel.imoNumber}</TableCell>
                        <TableCell>{vessel.shipType}</TableCell>
                        <TableCell>{vessel.yearOfBuild}</TableCell>
                        <TableCell>
                          <span className={expiryStatus.color === "destructive" ? "text-red-600" : "text-black"}>
                            {formatDate(vessel.vesselCertificationExpiry)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {vessel.isNotified ? (
                            <span className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-md bg-green-100 text-green-800">
                              Notified
                            </span>
                          ) : (
                            <Button 
                              size="icon" 
                              className="bg-[#134686] text-white hover:bg-[#0f3a6b] h-7 w-7"
                              onClick={() => handleNotifyClick(vessel)}
                            >
                              <Bell className="h-3 w-3" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-2">
            <div className="text-sm text-muted-foreground">
              {pagination.total > 0 ? (
                `${(currentPage - 1) * pagination.limit + 1}-${Math.min(currentPage * pagination.limit, pagination.total)} of ${pagination.total} row(s)`
              ) : (
                "0 of 0 row(s)"
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">Rows per page</span>
                <Select value="5" onValueChange={() => {}}>
                  <SelectTrigger className="w-13 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm px-2">
                  Page {currentPage} of {pagination.totalPages || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                  disabled={currentPage === pagination.totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Notification Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Vessel Certificate Expiration</DialogTitle>
              <DialogDescription>
                Send a notification message for vessel certificate expiration.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="mb-4">
                <h3 className="text-sm font-semibold mb-3">Requirements Needed</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="drydock-report"
                      checked={requirements.drydockReport}
                      onCheckedChange={(checked) =>
                        setRequirements({ ...requirements, drydockReport: checked === true })
                      }
                    />
                    <label
                      htmlFor="drydock-report"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Drydock Report
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="drydock-certificate"
                      checked={requirements.drydockCertificate}
                      onCheckedChange={(checked) =>
                        setRequirements({ ...requirements, drydockCertificate: checked === true })
                      }
                    />
                    <label
                      htmlFor="drydock-certificate"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Drydock Certificate
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="safety-certificate"
                      checked={requirements.safetyCertificate}
                      onCheckedChange={(checked) =>
                        setRequirements({ ...requirements, safetyCertificate: checked === true })
                      }
                    />
                    <label
                      htmlFor="safety-certificate"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Safety Certificate
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="vessel-plans"
                      checked={requirements.vesselPlans}
                      onCheckedChange={(checked) =>
                        setRequirements({ ...requirements, vesselPlans: checked === true })
                      }
                    />
                    <label
                      htmlFor="vessel-plans"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Vessel Plans
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleNotifySubmit}
                disabled={submitting}
                className="bg-black text-white hover:bg-black/90"
              >
                {submitting ? "Sending..." : "Notify"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
}
