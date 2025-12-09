"use client"

import { useState, useEffect } from "react"
import { ShipownerSidebar } from "@/components/shipowner-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppHeader } from "@/components/AppHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"
import { Plus, Search, X, ChevronLeft, ChevronRight, FileText, Download } from "lucide-react"

interface Vessel {
  id: string
  vesselName: string
  imoNumber: string
  vesselImageUrl?: string
}

interface Recertification {
  id: string
  vesselName: string
  vesselImoNumber: string
  vesselPlansUrl?: string
  drydockReportUrl?: string
  drydockCertificateUrl?: string
  safetyCertificateUrl?: string
  vesselCertificateFile?: string
  status: string
  requestedDate: string
  vessel: {
    vesselName: string
    imoNumber: string
    vesselImageUrl?: string
  }
}

// Table Skeleton Component
const TableSkeleton = () => (
  <div className="overflow-x-auto pt-0">
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="align-middle">
            <TableHead className="whitespace-nowrap py-1">Vessel Name</TableHead>
            <TableHead className="whitespace-nowrap py-1">IMO Number</TableHead>
            <TableHead className="whitespace-nowrap py-1">Attached Files</TableHead>
            <TableHead className="whitespace-nowrap py-1">Requested Date</TableHead>
            <TableHead className="whitespace-nowrap py-1">Status</TableHead>
            <TableHead className="whitespace-nowrap py-1">Vessel Certificate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(3)].map((_, index) => (
            <TableRow key={index} className="align-middle">
              <TableCell className="whitespace-nowrap">
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Skeleton className="h-6 w-16 rounded-md" />
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Skeleton className="h-4 w-8" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </div>
)

export default function VesselRecertificationsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const { toast } = useToast()
  const [recertifications, setRecertifications] = useState<Recertification[]>([])
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Form state
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null)
  const [formData, setFormData] = useState({
    companyName: "",
    vesselName: "",
    vesselImoNumber: "",
    vesselPlans: null as File | null,
    drydockReport: null as File | null,
    drydockCertificate: null as File | null,
    safetyCertificate: null as File | null
  })
  
  // Pagination state
  const [rowsPerPage, setRowsPerPage] = useState(5)
  const [page, setPage] = useState(1)
  const rowsPerPageOptions = [5, 10, 25, 50]

  // Filtering logic
  const filteredRows = recertifications.filter(recert => {
    const matchesStatus = statusFilter === 'all' ? true : recert.status === statusFilter
    const matchesSearch = 
      recert.vesselName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recert.vesselImoNumber.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesStatus && matchesSearch
  })
  
  const totalRows = filteredRows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage))
  const paginatedRows = filteredRows.slice((page - 1) * rowsPerPage, page * rowsPerPage)
  const startRow = totalRows === 0 ? 0 : (page - 1) * rowsPerPage + 1
  const endRow = Math.min(page * rowsPerPage, totalRows)
  
  // Reset to first page if rowsPerPage changes
  useEffect(() => { setPage(1) }, [rowsPerPage])

  useEffect(() => {
    if (user && !authLoading) {
      fetchRecertifications()
      fetchVessels()
    }
  }, [user, authLoading, statusFilter, searchTerm])

  const fetchRecertifications = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/shipowner/vessel-recertifications?userId=${user?.id}&status=${statusFilter}&search=${searchTerm}`)
      const data = await response.json()
      
      if (data.success) {
        setRecertifications(data.data)
      }
    } catch (error) {
      console.error('Error fetching recertifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchVessels = async () => {
    try {
      const response = await fetch(`/api/shipowner/user-vessels?userId=${user?.id}`)
      const data = await response.json()
      
      if (data.success) {
        setVessels(data.data)
      }
    } catch (error) {
      console.error('Error fetching vessels:', error)
    }
  }

  const handleVesselSelect = (vesselId: string) => {
    const vessel = vessels.find(v => v.id === vesselId)
    if (vessel) {
      setSelectedVessel(vessel)
      setFormData(prev => ({
        ...prev,
        vesselName: vessel.vesselName,
        vesselImoNumber: vessel.imoNumber,
        companyName: user?.fullName || user?.shipyardName || ""
      }))
    }
  }

  const handleFileChange = (field: string, file: File | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: file
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedVessel || !user) return

    setSubmitting(true)
    try {
      const formDataToSend = new FormData()
      formDataToSend.append('userId', user.id)
      formDataToSend.append('vesselId', selectedVessel.id)
      formDataToSend.append('companyName', formData.companyName)
      formDataToSend.append('vesselName', formData.vesselName)
      formDataToSend.append('vesselImoNumber', formData.vesselImoNumber)
      
      if (formData.vesselPlans) formDataToSend.append('vesselPlans', formData.vesselPlans)
      if (formData.drydockReport) formDataToSend.append('drydockReport', formData.drydockReport)
      if (formData.drydockCertificate) formDataToSend.append('drydockCertificate', formData.drydockCertificate)
      if (formData.safetyCertificate) formDataToSend.append('safetyCertificate', formData.safetyCertificate)

      const response = await fetch('/api/shipowner/vessel-recertifications', {
        method: 'POST',
        body: formDataToSend
      })

      const data = await response.json()
      
      if (response.ok && data.success) {
        toast({
          variant: "success",
          title: "Success",
          description: data.message || "Vessel recertification request submitted successfully"
        })
        setShowRequestModal(false)
        setFormData({
          companyName: "",
          vesselName: "",
          vesselImoNumber: "",
          vesselPlans: null,
          drydockReport: null,
          drydockCertificate: null,
          safetyCertificate: null
        })
        setSelectedVessel(null)
        fetchRecertifications()
      } else {
        const errorMessage = data.error || data.message || 'Failed to create vessel recertification request'
        console.error('Error submitting request:', errorMessage)
        toast({
          variant: "destructive",
          title: "Error",
          description: errorMessage
        })
      }
    } catch (error) {
      console.error('Error submitting request:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred while submitting the request"
      })
    } finally {
      setSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    })
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'PENDING': { color: 'bg-yellow-500', text: 'Pending' },
      'IN_REVIEW': { color: 'bg-blue-500', text: 'In Review' },
      'APPROVED': { color: 'bg-green-500', text: 'Approved' },
      'REJECTED': { color: 'bg-red-500', text: 'Rejected' },
      'COMPLETED': { color: 'bg-green-600', text: 'Completed' }
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || { color: 'bg-gray-500', text: status }
    
    return (
      <Badge className={`${config.color} text-white font-semibold`}>
        {config.text}
      </Badge>
    )
  }

  const getAttachedFilesCount = (recert: Recertification) => {
    const files = [
      recert.vesselPlansUrl,
      recert.drydockReportUrl,
      recert.drydockCertificateUrl,
      recert.safetyCertificateUrl
    ].filter(Boolean)
    
    return files.length
  }

  const handleDownloadCertificate = async (certificateUrl: string, vesselName: string) => {
    try {
      let downloadUrl = certificateUrl
      
      // Check if URL is already a signed URL (contains query parameters) or try to get signed URL
      if (!certificateUrl.includes('?') && certificateUrl.includes('s3.')) {
        // Get signed URL for S3 files
        const response = await fetch(`/api/signed-url?url=${encodeURIComponent(certificateUrl)}`)
        
        if (response.ok) {
          const data = await response.json()
          if (data.signedUrl) {
            downloadUrl = data.signedUrl
          }
        }
      }

      // Extract filename from URL or use default
      let filename = `${vesselName}_Certificate.pdf`
      try {
        const urlParts = certificateUrl.split('/')
        const lastPart = urlParts[urlParts.length - 1]
        if (lastPart && lastPart.includes('.')) {
          // Extract filename from URL
          const fileNamePart = lastPart.split('?')[0] // Remove query params if any
          filename = fileNamePart || filename
        }
      } catch (e) {
        // Use default filename if extraction fails
      }

      // Create a temporary anchor element to trigger download
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      link.target = '_blank' // Open in new tab as fallback
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error downloading certificate:', error)
    }
  }

  return (
    <SidebarProvider>
      <ShipownerSidebar />
      <SidebarInset>
        <AppHeader 
          breadcrumbs={[
            { label: "Dashboard", href: "/pages/shipowner" },
            { label: "Vessel Recertification", isCurrentPage: true }
          ]} 
        />
        
        <div className="p-5 pt-0">
          <div className="mb-4">
            
            <div className="pt-5">
              <div className="text-xl font-bold text-[#134686] mb-1">Vessel Recertification</div>
              <div className="text-sm text-gray-500">Below are your vessel recertification requests and their status.</div>
            </div>
          </div>

          {/* Filter Section */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
            <Button 
              onClick={() => setShowRequestModal(true)}
              className="bg-green-600 text-white hover:bg-green-700"
            >
             
              Request Certificate
            </Button>
              <Label htmlFor="status-filter" className="font-semibold">Status:</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="IN_REVIEW">In Review</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search vessel or IMO..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
            
            <Button 
              variant="outline" 
              onClick={() => {
                setStatusFilter("all")
                setSearchTerm("")
              }}
            >
              Clear Filters
            </Button>
          </div>

          {/* Table */}
          {loading ? (
            <TableSkeleton />
          ) : recertifications.length === 0 ? (
            <div className="text-center py-8">
  
              <p className="text-gray-600">No recertification requests found</p>
              <p className="text-sm text-gray-500 mt-1">Your vessel recertification requests will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto pt-0">
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="align-middle bg-gray-50">
                      <TableHead className="whitespace-nowrap py-1">Vessel Name</TableHead>
                      <TableHead className="whitespace-nowrap py-1">IMO Number</TableHead>
                      <TableHead className="whitespace-nowrap py-1">Attached Files</TableHead>
                      <TableHead className="whitespace-nowrap py-1">Requested Date</TableHead>
                      <TableHead className="whitespace-nowrap py-1">Status</TableHead>
                      <TableHead className="whitespace-nowrap py-1">Vessel Certificate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          No requests found matching your search.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedRows.map((recert) => (
                        <TableRow key={recert.id} className="align-middle">
                          <TableCell className="whitespace-nowrap">
                            <div className="font-medium">{recert.vesselName}</div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span>{recert.vesselImoNumber}</span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span className="text-sm text-gray-600">
                              Complete - {getAttachedFilesCount(recert)}/4
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span>{formatDate(recert.requestedDate)}</span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {getStatusBadge(recert.status)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {recert.vesselCertificateFile ? (
                              <Button 
                                className="bg-[#134686] text-white hover:bg-gray-800 cursor-pointer" 
                                size="sm"
                                onClick={() => handleDownloadCertificate(recert.vesselCertificateFile!, recert.vesselName)}
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination Controls */}
              <div className="flex flex-wrap items-center justify-between mt-2 text-sm">
                <div className='text-sm text-gray-500'>
                  {totalRows === 0 ? '0' : `${startRow} - ${endRow}`} of {totalRows} row(s)
                </div>
                <div className="flex items-center gap-2">
                  <span>Rows per page</span>
                  <select
                    className="border rounded px-2 py-1"
                    value={rowsPerPage}
                    onChange={e => setRowsPerPage(Number(e.target.value))}
                  >
                    {rowsPerPageOptions.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                  <button
                    className="h-8 w-8 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-50"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    aria-label="Previous page"
                    type="button"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2">Page {page} of {totalPages}</span>
                  <button
                    className="h-8 w-8 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-50"
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                    aria-label="Next page"
                    type="button"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Request Vessel Certificate Modal */}
        <Dialog open={showRequestModal} onOpenChange={setShowRequestModal}>
          <DialogContent className="!max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader className="p-0 m-0 flex-shrink-0">
              <DialogTitle className="mb-0 pb-0 text-xl font-bold text-[#134686]">
                Request Vessel Certificate
              </DialogTitle>
              <DialogDescription className="mb-0 pb-0 text-gray-600">
                Select a vessel and fill up the required information to request a vessel certificate.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-0">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="select-vessel" className="text-sm font-medium text-gray-700 mb-1 block">
                      Select Vessel
                    </Label>
                    <Select onValueChange={handleVesselSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a vessel" />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {vessels.map((vessel) => (
                          <SelectItem key={vessel.id} value={vessel.id}>
                            {vessel.vesselName} (IMO: {vessel.imoNumber})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="vessel-imo" className="text-sm font-medium text-gray-700 mb-1 block">
                      Vessel IMO Number
                    </Label>
                    <Input
                      id="vessel-imo"
                      value={formData.vesselImoNumber}
                      readOnly
                      className="text-sm bg-gray-50 border-gray-300"
                    />
                  </div>

                  <div>
                    <Label htmlFor="vessel-plans" className="text-sm font-medium text-gray-700 mb-1 block">
                      Vessel Plans (PDF)
                    </Label>
                    <Input
                      id="vessel-plans"
                      type="file"
                      accept=".pdf"
                      onChange={(e) => handleFileChange('vesselPlans', e.target.files?.[0] || null)}
                      className="text-sm"
                    />
                  </div>

                  <div>
                    <Label htmlFor="drydock-certificate" className="text-sm font-medium text-gray-700 mb-1 block">
                      Drydock Certificate (PDF)
                    </Label>
                    <Input
                      id="drydock-certificate"
                      type="file"
                      accept=".pdf"
                      onChange={(e) => handleFileChange('drydockCertificate', e.target.files?.[0] || null)}
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="company-name" className="text-sm font-medium text-gray-700 mb-1 block">
                      Company Name
                    </Label>
                    <Input
                      id="company-name"
                      value={formData.companyName}
                      readOnly
                      className="text-sm bg-gray-50 border-gray-300"
                    />
                  </div>

                  <div>
                    <Label htmlFor="vessel-name" className="text-sm font-medium text-gray-700 mb-1 block">
                      Vessel Name
                    </Label>
                    <Input
                      id="vessel-name"
                      value={formData.vesselName}
                      readOnly
                      className="text-sm bg-gray-50 border-gray-300"
                    />
                  </div>

                  <div>
                    <Label htmlFor="drydock-report" className="text-sm font-medium text-gray-700 mb-1 block">
                      Drydock Report (PDF)
                    </Label>
                    <Input
                      id="drydock-report"
                      type="file"
                      accept=".pdf"
                      onChange={(e) => handleFileChange('drydockReport', e.target.files?.[0] || null)}
                      className="text-sm"
                    />
                  </div>

                  <div>
                    <Label htmlFor="safety-certificate" className="text-sm font-medium text-gray-700 mb-1 block">
                      Safety Certificate (PDF)
                    </Label>
                    <Input
                      id="safety-certificate"
                      type="file"
                      accept=".pdf"
                      onChange={(e) => handleFileChange('safetyCertificate', e.target.files?.[0] || null)}
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="mt-6 flex-shrink-0">
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                <Button 
                  type="submit" 
                  disabled={!selectedVessel || submitting}
                  className="bg-black text-white hover:bg-gray-800"
                >
                  {submitting ? 'Submitting...' : 'Request'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
}