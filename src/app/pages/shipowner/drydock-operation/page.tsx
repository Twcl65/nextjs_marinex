"use client"

import { useState, useEffect } from "react"
import { ShipownerSidebar } from "@/components/shipowner-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppHeader } from "@/components/AppHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
// import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Search, Eye, Ship, ChevronLeft, ChevronRight, Download } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import jsPDF from "jspdf"

// Table Skeleton Component for Booked Shipyards
const TableSkeleton = () => (
  <div className="overflow-x-auto pt-0">
    {/* Filter Row Skeleton */}
    <div className="flex items-center gap-4 mb-4">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-10 w-56" />
    </div>

    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="align-middle">
            <TableHead className="whitespace-nowrap py-1">Shipyard</TableHead>
            <TableHead className="whitespace-nowrap py-1">Vessel</TableHead>
            <TableHead className="whitespace-nowrap py-1">Start Date</TableHead>
            <TableHead className="whitespace-nowrap py-1">End Date</TableHead>
            <TableHead className="whitespace-nowrap py-1">Initial Cost</TableHead>
            <TableHead className="whitespace-nowrap py-1">Status</TableHead>
            <TableHead className="whitespace-nowrap py-1">Services</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...Array(3)].map((_, index) => (
            <TableRow key={index} className="align-middle">
              <TableCell className="whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <div>
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Skeleton className="h-6 w-16 rounded-md" />
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <Skeleton className="h-7 w-24 rounded" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    {/* Pagination Skeleton */}
    <div className="flex flex-wrap items-center justify-between mt-2 text-sm">
      <Skeleton className="h-2 w-32" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-16 rounded" />
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-8 rounded" />
      </div>
    </div>
  </div>
)

interface BookedShipyard {
  id: string
  shipyard: {
    name: string
    logo?: string
  }
  vessel: {
    name: string
    imo: string
  }
  startDate: string
  endDate: string
  initialCost: number
  status: string
  services: Array<{
    id: string
    serviceName: string
    startDate: string
    endDate: string
    progress: number
    progressUpdates: Array<{
      progressLevel: string
      progressPercent: number
      comment?: string
      imageUrl?: string
      updatedAt: string
    }>
  }>
  overallProgress: number
}

export default function DrydockOperationPage() {
  const { user, isLoading: authLoading } = useAuth()
  const [bookedShipyards, setBookedShipyards] = useState<BookedShipyard[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedBooking, setSelectedBooking] = useState<BookedShipyard | null>(null)
  const [selectedService, setSelectedService] = useState<BookedShipyard['services'][0] | null>(null)
  const [serviceProgressDetails, setServiceProgressDetails] = useState<Array<{
    progressLevel: string
    progressPercent: number
    comment?: string
    imageUrl?: string
    updatedAt: string
  }>>([])
  const [loadingProgress, setLoadingProgress] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previousBooking, setPreviousBooking] = useState<BookedShipyard | null>(null)
  const [currentShipyardName, setCurrentShipyardName] = useState<string>('')
  
  // Pagination state
  const [rowsPerPage, setRowsPerPage] = useState(5)
  const [page, setPage] = useState(1)
  const rowsPerPageOptions = [5, 10, 25, 50]

  // Filtering logic for search and status
  const filteredRows = bookedShipyards.filter(booking => {
    const matchesSearch =
      booking.vessel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.vessel.imo.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter
    return matchesSearch && matchesStatus
  })
  
  const totalRows = filteredRows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage))
  const paginatedRows = filteredRows.slice((page - 1) * rowsPerPage, page * rowsPerPage)
  const startRow = totalRows === 0 ? 0 : (page - 1) * rowsPerPage + 1
  const endRow = Math.min(page * rowsPerPage, totalRows)
  
  // Reset to first page if rowsPerPage or statusFilter changes
  useEffect(() => {
    setPage(1)
  }, [rowsPerPage, statusFilter])

  useEffect(() => {
    if (user && !authLoading) {
      fetchBookedShipyards()
    }
  }, [searchTerm, statusFilter, user, authLoading])

  const fetchBookedShipyards = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Check if user is authenticated
      if (!user) {
        setError('User not authenticated. Please log in.')
        return
      }

      console.log('Fetching booked shipyards for userId:', user.id)
      
      const response = await fetch(`/api/shipowner/booked-shipyards?userId=${user.id}&search=${searchTerm}`)
      const data = await response.json()
      
      console.log('API Response:', data)
      
      if (data.success) {
        setBookedShipyards(data.data)
      } else {
        setError(data.error || 'Failed to fetch booked shipyards')
        console.error('API Error:', data.error)
      }
    } catch (error) {
      console.error('Error fetching booked shipyards:', error)
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleViewProgress = (booking: BookedShipyard) => {
    setSelectedBooking(booking)
  }

  const handleDownloadCertificates = async (booking: BookedShipyard) => {
    try {
      // Fetch certificates for this booking
      const response = await fetch(`/api/shipowner/booking-certificates?bookingId=${booking.id}`)
      const data = await response.json()

      if (!data.success || !data.data || data.data.length === 0) {
        alert('No certificates found for this booking.')
        return
      }

      const certificates = data.data

      // Download each certificate
      for (const certificate of certificates) {
        if (!certificate.certificateUrl) {
          console.warn(`Certificate ${certificate.certificateName} has no URL`)
          continue
        }

        try {
          // Get signed URL for S3 files
          let downloadUrl = certificate.certificateUrl
          
          if (!certificate.certificateUrl.includes('?') && certificate.certificateUrl.includes('s3.')) {
            const signedUrlResponse = await fetch(`/api/signed-url?url=${encodeURIComponent(certificate.certificateUrl)}`)
            
            if (signedUrlResponse.ok) {
              const signedUrlData = await signedUrlResponse.json()
              if (signedUrlData.signedUrl) {
                downloadUrl = signedUrlData.signedUrl
              }
            }
          }

          // Extract filename from URL or use certificate name
          let filename = `${certificate.certificateName || 'Certificate'}.pdf`
          try {
            const urlParts = certificate.certificateUrl.split('/')
            const lastPart = urlParts[urlParts.length - 1]
            if (lastPart && lastPart.includes('.')) {
              const fileNamePart = lastPart.split('?')[0]
              filename = fileNamePart || filename
            }
          } catch {
            // Use default filename if extraction fails
          }

          // Create a temporary anchor element to trigger download
          const link = document.createElement('a')
          link.href = downloadUrl
          link.download = filename
          link.target = '_blank'
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)

          // Add a small delay between downloads to avoid browser blocking
          await new Promise(resolve => setTimeout(resolve, 500))
        } catch (error) {
          console.error(`Error downloading certificate ${certificate.certificateName}:`, error)
        }
      }
    } catch (error) {
      console.error('Error fetching certificates:', error)
      alert('Failed to download certificates. Please try again.')
    }
  }

  const handleServiceClick = async (service: BookedShipyard['services'][0]) => {
    // Store the current booking and shipyard name, then close the booking dialog
    if (selectedBooking) {
      setPreviousBooking(selectedBooking)
      setCurrentShipyardName(selectedBooking.shipyard.name)
      setSelectedBooking(null)
    }
    
    // Set the selected service and fetch progress
    setSelectedService(service)
    setLoadingProgress(true)
    
    try {
      const response = await fetch(`/api/drydock-progress?serviceId=${service.id}`)
      const data = await response.json()
      
      if (data.success) {
        setServiceProgressDetails(data.data)
      } else {
        console.error('Error fetching progress details:', data.error)
        setServiceProgressDetails([])
      }
    } catch (error) {
      console.error('Error fetching progress details:', error)
      setServiceProgressDetails([])
    } finally {
      setLoadingProgress(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatDateForPDF = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const handleExportHistory = () => {
    try {
      const doc = new jsPDF('landscape', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      
      // Header
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(19, 70, 134) // #134686
      doc.text('Drydock Operations History', pageWidth / 2, 20, { align: 'center' })
      
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 100, 100)
      doc.text(`Generated on: ${new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}`, pageWidth / 2, 28, { align: 'center' })
      
      // Draw a line under the header
      doc.setDrawColor(19, 70, 134)
      doc.setLineWidth(0.5)
      doc.line(15, 35, pageWidth - 15, 35)
      
      // Table headers
      const startY = 42
      const colWidths = [35, 40, 30, 30, 30, 30, 35] // Adjusted for landscape
      const headers = ['Shipyard', 'Vessel', 'Start Date', 'End Date', 'Cost', 'Status', 'Services']
      let currentY = startY
      
      // Header row
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setFillColor(19, 70, 134)
      doc.setTextColor(255, 255, 255)
      let xPos = 15
      headers.forEach((header, index) => {
        doc.rect(xPos, currentY - 5, colWidths[index], 8, 'F')
        doc.text(header, xPos + colWidths[index] / 2, currentY, { align: 'center' })
        xPos += colWidths[index]
      })
      
      currentY += 10
      
      // Table data
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(8)
      
      filteredRows.forEach((booking, index) => {
        // Check if we need a new page
        if (currentY > pageHeight - 20) {
          doc.addPage()
          currentY = startY
          
          // Redraw header on new page
          doc.setFont('helvetica', 'bold')
          doc.setFillColor(19, 70, 134)
          doc.setTextColor(255, 255, 255)
          xPos = 15
          headers.forEach((header, idx) => {
            doc.rect(xPos, currentY - 5, colWidths[idx], 8, 'F')
            doc.text(header, xPos + colWidths[idx] / 2, currentY, { align: 'center' })
            xPos += colWidths[idx]
          })
          currentY += 10
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(0, 0, 0)
        }
        
        // Data row
        const rowData = [
          booking.shipyard.name.length > 20 ? booking.shipyard.name.substring(0, 20) + '...' : booking.shipyard.name,
          `${booking.vessel.name} (${booking.vessel.imo})`.length > 25 ? `${booking.vessel.name.substring(0, 15)}... (${booking.vessel.imo})` : `${booking.vessel.name} (${booking.vessel.imo})`,
          formatDateForPDF(booking.startDate),
          formatDateForPDF(booking.endDate),
          formatCurrency(booking.initialCost),
          booking.status,
          booking.services?.length || 0
        ]
        
        xPos = 15
        rowData.forEach((data, idx) => {
          // Draw cell border
          doc.setDrawColor(200, 200, 200)
          doc.rect(xPos, currentY - 5, colWidths[idx], 6, 'S')
          
          // Add text
          const text = String(data)
          const maxWidth = colWidths[idx] - 2
          const lines = doc.splitTextToSize(text, maxWidth)
          doc.text(lines[0] || '', xPos + 1, currentY, { maxWidth })
          
          xPos += colWidths[idx]
        })
        
        currentY += 8
      })
      
      // Footer
      const totalPages = doc.internal.pages.length - 1
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(100, 100, 100)
        doc.text(
          `Page ${i} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        )
      }
      
      // Save the PDF
      const fileName = `drydock-operations-history-${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(fileName)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF. Please try again.')
    }
  }


  return (
    <SidebarProvider>
      <ShipownerSidebar />
      <SidebarInset>
        <AppHeader 
          breadcrumbs={[
            { label: "Dashboard", href: "/pages/shipowner" },
            { label: "Drydock Operation", isCurrentPage: true }
          ]} 
        />
        
        <div className="p-5 pt-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xl font-bold text-[#134686] mb-1">Ongoing Drydock Operations</div>
              <div className="text-sm text-gray-500">Below are the booked shipyards. See the list of services below.</div>
            </div>
          </div>
          
          {loading ? (
            <TableSkeleton />
          ) : bookedShipyards.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">No booked shipyards found</p>
              <p className="text-sm text-gray-500 mt-1">Your confirmed drydock bookings will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto pt-0">
              {/* Filter Row */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <Label htmlFor="search-input" className="font-semibold text-base">Search:</Label>
                  <Input
                    id="search-input"
                    type="text"
                    className="w-56"
                    placeholder="Search vessel or IMO..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                  <Label htmlFor="status-filter" className="font-semibold text-base whitespace-nowrap">Filter by status:</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40 bg-white border-gray-300" id="status-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-gray-300">
                      <SelectItem value="all" className="bg-white hover:bg-gray-50">All statuses</SelectItem>
                      <SelectItem value="CONFIRMED" className="bg-white hover:bg-gray-50">Confirmed</SelectItem>
                      <SelectItem value="IN_PROGRESS" className="bg-white hover:bg-gray-50">In Progress</SelectItem>
                      <SelectItem value="COMPLETED" className="bg-white hover:bg-gray-50">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleExportHistory}
                  className="bg-[#134686] hover:bg-[#134686]/90 text-white flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export History
                </Button>
              </div>
              
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="align-middle bg-gray-50">
                      <TableHead className="whitespace-nowrap py-1">Shipyard</TableHead>
                      <TableHead className="whitespace-nowrap py-1">Vessel Name</TableHead>
                      <TableHead className="whitespace-nowrap py-1">Start Date</TableHead>
                      <TableHead className="whitespace-nowrap py-1">End Date</TableHead>
                      <TableHead className="whitespace-nowrap py-1">Initial Cost</TableHead>
                      <TableHead className="whitespace-nowrap py-1">Status</TableHead>
                      <TableHead className="whitespace-nowrap py-1">Services</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                          No vessels found matching your search.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedRows.map((booking) => (
                        <TableRow key={booking.id} className="align-middle">
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                                {booking.shipyard.logo ? (
                                  <img 
                                    src={booking.shipyard.logo.includes('s3.amazonaws.com') || booking.shipyard.logo.includes('amazonaws.com') 
                                      ? `/api/proxy-image?url=${encodeURIComponent(booking.shipyard.logo)}`
                                      : booking.shipyard.logo
                                    } 
                                    alt={booking.shipyard.name}
                                    className="h-8 w-8 rounded-full object-cover"
                                    onError={(e) => {
                                      // Fallback to initial if image fails to load
                                      const target = e.target as HTMLImageElement
                                      target.style.display = 'none'
                                      const parent = target.parentElement
                                      if (parent) {
                                        const fallback = document.createElement('span')
                                        fallback.className = 'text-sm font-medium text-gray-600'
                                        fallback.textContent = booking.shipyard.name.charAt(0).toUpperCase()
                                        parent.appendChild(fallback)
                                      }
                                    }}
                                  />
                                ) : (
                                  <span className="text-sm font-medium text-gray-600">
                                    {booking.shipyard.name.charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <div>
                                <p className="font-medium">{booking.shipyard.name}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div>
                              <p><span className="font-medium">{booking.vessel.name}</span> <span>({booking.vessel.imo})</span></p>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span>{formatDate(booking.startDate)}</span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span>{formatDate(booking.endDate)}</span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <span className="font-medium">
                                {formatCurrency(booking.initialCost)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span
                              className={
                                booking.status === 'CONFIRMED' || booking.status === 'COMPLETED'
                                  ? 'bg-green-600 text-white px-3 py-1 rounded-md text-xs capitalize'
                                  : booking.status === 'IN_PROGRESS'
                                  ? 'bg-blue-600 text-white px-3 py-1 rounded-md text-xs capitalize'
                                  : 'bg-gray-200 text-gray-800 px-3 py-1 rounded-md text-xs capitalize'
                              }
                            >
                              {booking.status.toLowerCase()}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {booking.status === 'COMPLETED' ? (
                              <button
                                className="px-4 h-7.5 text-xs cursor-pointer bg-[#FF6C0C] text-white rounded hover:bg-[#FF6C0C]/90 transition font-semibold flex items-center justify-center"
                                onClick={() => handleDownloadCertificates(booking)}
                                type="button"
                              >
                                Download Certificates
                              </button>
                            ) : (
                              <button
                                className="px-4 h-7.5 text-xs bg-black text-white rounded hover:bg-gray-800 transition font-semibold flex items-center justify-center"
                                onClick={() => handleViewProgress(booking)}
                                type="button"
                              >
                                View Progress
                              </button>
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

        {/* Enhanced Service Progress Dialog */}
        <Dialog open={!!selectedBooking} onOpenChange={open => {
          if (!open) {
            setSelectedBooking(null)
            // Clear previous booking state if dialog is closed directly
            setPreviousBooking(null)
            setCurrentShipyardName('')
          }
        }}>
          <DialogContent className="!max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader className="p-0 m-0 flex-shrink-0">
              <DialogTitle className="mb-0 pb-0 text-xl font-bold text-[#134686]">Service Progress Updates</DialogTitle>
              <DialogDescription className="mb-0 pb-0 text-gray-600">Track the status, schedule, and completion of each drydock service</DialogDescription>
            </DialogHeader>
            {selectedBooking && (
              <>
               
                {/* Scrollable Services Section - Side by Side Cards */}
                <div className="flex-1 overflow-y-auto min-h-0">
                  {(!selectedBooking.services || selectedBooking.services.length === 0) ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500 text-lg">No services to display</p>
                      <p className="text-sm text-gray-400 mt-1">Services will appear here once they are added</p>
                    </div>
                  ) : (
                    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pr-2 ${selectedBooking.services.length > 3 ? 'max-h-96 overflow-y-auto' : ''}`}>
                      {selectedBooking.services.map((service, idx) => (
                        <div 
                          key={service.id} 
                          className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => handleServiceClick(service)}
                        >
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-gray-700 text-sm">{idx + 1}.</span>
                              <div className="text-right">
                                <div className="text-lg font-bold text-black">{service.progress}%</div>
                                <div className="text-xs text-gray-500 uppercase tracking-wide">
                                  {service.progress === 100 ? 'Completed' : service.progress > 0 ? 'In Progress' : 'Not Started'}
                                </div>
                              </div>
                            </div>
                            <h3 className="text-sm font-semibold text-gray-900 mb-2 line-clamp-2">{service.serviceName}</h3>
                            <div className="text-xs text-gray-600 mb-3">
                              {service.startDate && service.endDate && (
                                <span>
                                  {(() => {
                                    const start = new Date(service.startDate);
                                    const end = new Date(service.endDate);
                                    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
                                    if (sameMonth) {
                                      const month = start.toLocaleString('en-US', { month: 'short' });
                                      const year = start.getFullYear();
                                      return `${month} ${start.getDate()}-${end.getDate()}, ${year}`;
                                    } else {
                                      const startStr = start.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                      const endStr = end.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                      return `${startStr} - ${endStr}`;
                                    }
                                  })()}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Enhanced Progress Bar */}
                          <div className="relative">
                            <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                              <span>Progress</span>
                              <span className="font-medium">{service.progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-500 ease-out relative"
                                style={{ width: `${service.progress}%` }}
                              >
                                {service.progress > 0 && (
                                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

               
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Service Progress Details Dialog */}
        <Dialog open={!!selectedService} onOpenChange={open => {
          if (!open) {
            setSelectedService(null)
            setServiceProgressDetails([])
            // Reopen the previous booking dialog if it existed
            if (previousBooking) {
              // Use setTimeout to ensure the dialog closes first before reopening
              setTimeout(() => {
                setSelectedBooking(previousBooking)
                setPreviousBooking(null)
              }, 100)
            } else {
              // Clear shipyard name if no previous booking
              setCurrentShipyardName('')
            }
          }
        }}>
          <DialogContent className="!max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader className="p-0 m-0 flex-shrink-0">
              <DialogTitle className="mb-0 pb-0 text-xl font-bold text-[#134686]">
                Service Progress Details
              </DialogTitle>
              <DialogDescription className="mb-0 pb-0 text-gray-600">
                {selectedService?.serviceName} - Progress Updates and Documentation
              </DialogDescription>
            </DialogHeader>
            
            {selectedService && (
              <div className="flex-1 overflow-y-auto min-h-0">
                {loadingProgress ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#134686] mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading progress details...</p>
                  </div>
                ) : serviceProgressDetails.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-lg">No progress updates found</p>
                    <p className="text-sm text-gray-400 mt-1">Progress updates will appear here once they are added</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {serviceProgressDetails.map((progress, idx) => (
                      <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-[#134686] text-white rounded-full flex items-center justify-center text-sm font-bold">
                              {idx + 1}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">Progress Update</h3>
                              <p className="text-sm text-gray-500">
                                {new Date(progress.updatedAt).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-[#134686]">{progress.progressPercent}%</div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide">
                              {progress.progressLevel}
                            </div>
                          </div>
                        </div>
                        
                        {progress.comment && (
                          <div className="mb-3">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Comments:</h4>
                            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                              {progress.comment}
                            </p>
                          </div>
                        )}
                        
                        {progress.imageUrl && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Progress Image:</h4>
                            <div className="relative">
                              <img 
                                src={progress.imageUrl} 
                                alt="Progress update"
                                className="w-full max-w-md h-auto rounded-lg shadow-sm border border-gray-200"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none'
                                }}
                              />
                            </div>
                          </div>
                        )}
                        
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>Updated by: {currentShipyardName || previousBooking?.shipyard?.name || selectedBooking?.shipyard?.name || 'Shipyard'}</span>
                            <span>Level: {progress.progressLevel}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
           
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
}

