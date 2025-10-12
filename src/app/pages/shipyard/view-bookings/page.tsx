"use client"

import { ShipyardSidebar } from "@/components/shipyard-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { ProfileDropdown } from "@/components/ProfileDropdown"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Ship, ChevronLeft, ChevronRight, Eye } from "lucide-react"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import Image from "next/image"
import React, { useEffect, useState } from "react"

interface DrydockBooking {
  id: string
  drydockRequestId: string
  drydockBidId: string
  userId: string
  shipyardUserId: string
  status: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  bookingDate: string
  notes?: string
  createdAt: string
  updatedAt: string
  vesselName: string
  imoNumber: string
  flag: string
  shipType: string
  vesselImageUrl?: string
  priorityLevel: 'NORMAL' | 'EMERGENCY'
  requestStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'IN_PROGRESS' | 'COMPLETED'
  companyName: string
  companyLogoUrl?: string
  shipyardName: string
  totalBid: number
  totalDays: number
  parallelDays: number
  sequentialDays: number
  bidStatus: 'SUBMITTED' | 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | 'RECOMMENDED'
  servicesOffered: Record<string, unknown>
  serviceCalculations: Record<string, unknown>
  bidCertificateUrl?: string
  bidDate: string
  shipownerName?: string
  shipownerEmail?: string
  shipownerContact?: string
  shipownerAddress?: string
  shipownerLogoUrl?: string
}

// CompanyLogo component to handle signed URL fetching
function CompanyLogo({ booking }: { booking: DrydockBooking }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (booking.companyLogoUrl && booking.companyLogoUrl !== 'null' && booking.companyLogoUrl.trim() !== '') {
      setLoading(true)
      fetch(`/api/signed-url?url=${encodeURIComponent(booking.companyLogoUrl)}`)
        .then(res => res.json())
        .then(data => {
          if (data.signedUrl) {
            setSignedUrl(data.signedUrl)
          }
        })
        .catch(err => {
          console.error('Error fetching signed URL:', err)
        })
        .finally(() => {
          setLoading(false)
        })
    }
  }, [booking.companyLogoUrl])

  return (
    <div className="h-8 w-8 bg-gray-100 flex items-center justify-center border border-gray-200 relative overflow-hidden rounded-full">
      {signedUrl && !loading ? (
        <Image
          src={signedUrl}
          alt={`${booking.companyName} logo`}
          fill
          className="object-cover rounded-full"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : null}
      <div className="flex items-center justify-center">
        <Ship className="h-4 w-4" />
      </div>
    </div>
  )
}

export default function ViewBookingsPage() {
  const [bookings, setBookings] = useState<DrydockBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(5)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<DrydockBooking | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const [completionNotes, setCompletionNotes] = useState("")
  const { toast } = useToast()

  useEffect(() => {
    fetchBookings()
  }, [])

  const fetchBookings = async () => {
    try {
      // Get current user ID from localStorage (using 'user' key as per AuthContext)
      const currentUser = localStorage.getItem('user')
      if (!currentUser) {
        console.error('No current user found')
        return
      }
      
      const user = JSON.parse(currentUser)
      console.log('Current user:', user)
      
      const response = await fetch(`/api/shipyard/drydock-bookings?shipyardUserId=${user.id}`)
      const data = await response.json()
      console.log('Bookings data:', data)
      setBookings(data.bookings || [])
    } catch (error) {
      console.error('Error fetching bookings:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter and search bookings
  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = searchTerm === "" || 
      booking.vesselName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.imoNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (booking.shipownerName && booking.shipownerName.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = statusFilter === "all" || booking.status.toLowerCase() === statusFilter.toLowerCase()
    const matchesPriority = priorityFilter === "all" || booking.priorityLevel.toLowerCase() === priorityFilter.toLowerCase()
    
    return matchesSearch && matchesStatus && matchesPriority
  }).sort((a, b) => {
    // Define status priority order: PENDING first, then CONFIRMED, then IN_PROGRESS, then COMPLETED, then CANCELLED
    const statusOrder = { 'PENDING': 1, 'CONFIRMED': 2, 'IN_PROGRESS': 3, 'COMPLETED': 4, 'CANCELLED': 5 }
    const statusA = statusOrder[a.status as keyof typeof statusOrder] || 6
    const statusB = statusOrder[b.status as keyof typeof statusOrder] || 6
    
    // First sort by status priority
    if (statusA !== statusB) {
      return statusA - statusB
    }
    
    // Then sort by creation date (newest first) within the same status
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  // Pagination
  const totalPages = Math.ceil(filteredBookings.length / rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const currentBookings = filteredBookings.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleEditBooking = (booking: DrydockBooking) => {
    setSelectedBooking(booking)
    setEditDialogOpen(true)
  }

  const handleConfirmClick = () => {
    setEditDialogOpen(false)
    setConfirmDialogOpen(true)
  }

  const handleConfirmBooking = async () => {
    if (!selectedBooking || isConfirming) return

    setIsConfirming(true)

    try {
      const response = await fetch('/api/shipyard/drydock-bookings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingId: selectedBooking.id,
          status: 'CONFIRMED'
        }),
      })

      if (response.ok) {
        setBookings(bookings.map(booking => 
          booking.id === selectedBooking.id 
            ? { ...booking, status: 'CONFIRMED' }
            : booking
        ))

        toast({
          variant: "success",
          title: "Booking Confirmed",
          description: `Booking for ${selectedBooking.vesselName} has been confirmed.`,
        })

        setConfirmDialogOpen(false)
        setSelectedBooking(null)
      } else {
        throw new Error('Failed to confirm booking')
      }
    } catch (error) {
      console.error('Error confirming booking:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to confirm booking. Please try again.",
      })
    } finally {
      setIsConfirming(false)
    }
  }

  const handleCancelClick = () => {
    setEditDialogOpen(false)
    setCancelDialogOpen(true)
  }

  const handleCancelBooking = async () => {
    if (!selectedBooking || isCancelling || !cancelReason.trim()) return

    setIsCancelling(true)

    try {
      const response = await fetch('/api/shipyard/drydock-bookings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingId: selectedBooking.id,
          status: 'CANCELLED',
          notes: cancelReason
        }),
      })

      if (response.ok) {
        setBookings(bookings.map(booking => 
          booking.id === selectedBooking.id 
            ? { ...booking, status: 'CANCELLED', notes: cancelReason }
            : booking
        ))

        toast({
          variant: "destructive",
          title: "Booking Cancelled",
          description: `Booking for ${selectedBooking.vesselName} has been cancelled.`,
        })

        setCancelDialogOpen(false)
        setSelectedBooking(null)
        setCancelReason("")
      } else {
        throw new Error('Failed to cancel booking')
      }
    } catch (error) {
      console.error('Error cancelling booking:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to cancel booking. Please try again.",
      })
    } finally {
      setIsCancelling(false)
    }
  }

  const handleCompleteClick = () => {
    setEditDialogOpen(false)
    setCompleteDialogOpen(true)
  }

  const handleInProgressClick = () => {
    setEditDialogOpen(false)
    setCompleteDialogOpen(true)
  }

  const handleCompleteBooking = async () => {
    if (!selectedBooking || isCompleting) return

    setIsCompleting(true)

    try {
      // Determine the next status based on current status
      const nextStatus = selectedBooking.status === 'CONFIRMED' ? 'IN_PROGRESS' : 'COMPLETED'
      
      const response = await fetch('/api/shipyard/drydock-bookings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookingId: selectedBooking.id,
          status: nextStatus,
          notes: completionNotes
        }),
      })

      if (response.ok) {
        setBookings(bookings.map(booking => 
          booking.id === selectedBooking.id 
            ? { ...booking, status: nextStatus, notes: completionNotes }
            : booking
        ))

        const actionText = nextStatus === 'IN_PROGRESS' ? 'marked as in progress' : 'marked as completed'
        toast({
          variant: "success",
          title: `Booking ${actionText}`,
          description: `Booking for ${selectedBooking.vesselName} has been ${actionText}.`,
        })

        setCompleteDialogOpen(false)
        setSelectedBooking(null)
        setCompletionNotes("")
      } else {
        throw new Error('Failed to update booking status')
      }
    } catch (error) {
      console.error('Error updating booking status:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update booking status. Please try again.",
      })
    } finally {
      setIsCompleting(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'CONFIRMED':
        return 'bg-blue-100 text-blue-800'
      case 'IN_PROGRESS':
        return 'bg-orange-100 text-orange-800'
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'EMERGENCY':
        return 'bg-red-100 text-red-800'
      case 'NORMAL':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <ProtectedRoute allowedRoles={['SHIPYARD']}>
      <SidebarProvider>
        <ShipyardSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <div className="flex-1">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbPage>Shipyard</BreadcrumbPage>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>View & Confirm Bookings</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="ml-auto">
              <ProfileDropdown />
            </div>
          </header>
          
          <div className="px-6 py-0 pb-6">
            <div className="mb-6">
              <h1 className="text-2xl md:text-2xl font-bold text-[#134686]">Drydock Bookings Management</h1>
              <p className="text-md text-muted-foreground mt-1">View and manage drydock bookings with vessel information and booking status.</p>
            </div>

            {/* Search and Filter Section */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Label htmlFor="search" className="text-sm font-medium whitespace-nowrap">Search:</Label>
                <Input
                  id="search"
                  placeholder="Search by vessel name, company, IMO number, or shipowner..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full max-w-80"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="status-filter" className="text-sm font-medium whitespace-nowrap">Filter by status:</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-400 focus:border-gray-600 border-box">
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="priority-filter" className="text-sm font-medium whitespace-nowrap">Filter by priority:</Label>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="All priorities" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-400 focus:border-gray-600 border-box">
                    <SelectItem value="all">All priorities</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="EMERGENCY">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Table Container - Responsive */}
            <div className="border border-gray-300 rounded-lg overflow-hidden w-full mb-3">
              <Table className="w-full">
                <TableHeader>
                  <TableRow className="align-middle h-4">
                    <TableHead className="whitespace-nowrap py-0 h-11 w-16">Logo</TableHead>
                    <TableHead className="whitespace-nowrap py-0 h-11 min-w-[120px]">Vessel</TableHead>
                    <TableHead className="whitespace-nowrap py-0 h-11 min-w-[120px]">Company</TableHead>
                    <TableHead className="whitespace-nowrap py-0 h-11 min-w-[100px]">IMO</TableHead>
                    <TableHead className="whitespace-nowrap py-0 h-11 w-20">Priority</TableHead>
                    <TableHead className="whitespace-nowrap py-0 h-11 w-24">Status</TableHead>
                    <TableHead className="whitespace-nowrap py-0 h-11 w-24">Bid Amount</TableHead>
                    <TableHead className="whitespace-nowrap py-0 h-11 w-24">Booking Date</TableHead>
                    <TableHead className="whitespace-nowrap py-0 h-11 w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        <p className="text-gray-600">Loading bookings...</p>
                      </TableCell>
                    </TableRow>
                  ) : currentBookings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        <Ship className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-gray-600">No bookings found</p>
                        <p className="text-sm text-gray-500 mt-1">No drydock bookings match your search criteria</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentBookings.map((booking) => (
                      <TableRow key={booking.id} className="align-middle h-6">
                        <TableCell className="whitespace-nowrap py-2">
                          <CompanyLogo booking={booking} />
                        </TableCell>
                        <TableCell className="py-2">
                          <span className="font-medium text-gray truncate block max-w-[120px]" title={booking.vesselName}>
                            {booking.vesselName}
                          </span>
                        </TableCell>
                        <TableCell className="py-2">
                          <span className="text-sm text-gray-600 truncate block max-w-[120px]" title={booking.companyName}>
                            {booking.companyName}
                          </span>
                        </TableCell>
                        <TableCell className="py-2">
                          <span className="text-sm text-gray-600 truncate block max-w-[100px]" title={booking.imoNumber}>
                            {booking.imoNumber}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-2">
                          <Badge className={getPriorityColor(booking.priorityLevel)}>
                            {booking.priorityLevel}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-2">
                          <Badge className={getStatusColor(booking.status)}>
                            {booking.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-2">
                          <span className="text-sm text-gray-600">
                            ₱{booking.totalBid.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-2">
                          <span className="text-sm text-gray">
                            {new Date(booking.bookingDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-2">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:text-white h-7 w-7 p-0"
                              title="View Details"
                              onClick={() => handleEditBooking(booking)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            {!loading && filteredBookings.length > 0 && (
              <div className="flex flex-wrap items-center justify-between text-sm px-0">
                <div className='text-sm text-gray-500'>
                  {filteredBookings.length === 0 ? '0' : `${startIndex + 1} - ${Math.min(endIndex, filteredBookings.length)}`} of {filteredBookings.length} row(s)
                </div>
                <div className="flex items-center gap-2">
                  <span>Rows per page</span>
                  <select
                    className="border rounded px-2 py-1"
                    value={rowsPerPage}
                    onChange={e => setRowsPerPage(Number(e.target.value))}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                  <button
                    className="h-8 w-8 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-50"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                    type="button"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2">Page {currentPage} of {totalPages}</span>
                  <button
                    className="h-8 w-8 flex items-center justify-center rounded hover:bg-gray-100 disabled:opacity-50"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    aria-label="Next page"
                    type="button"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </SidebarInset>

        {/* Booking Details Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-[#134686]">
                Booking Details - {selectedBooking?.vesselName}
              </DialogTitle>
              <DialogDescription>
                View and manage this drydock booking information.
              </DialogDescription>
            </DialogHeader>
            
            {selectedBooking && (
              <div className="space-y-4">
                {/* Vessel Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-black mb-1 block">Vessel Name</Label>
                    <Input
                      value={selectedBooking.vesselName}
                      readOnly
                      className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-black mb-1 block">IMO Number</Label>
                    <Input
                      value={selectedBooking.imoNumber}
                      readOnly
                      className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-black mb-1 block">Ship Type</Label>
                    <Input
                      value={selectedBooking.shipType}
                      readOnly
                      className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-black mb-1 block">Flag</Label>
                    <Input
                      value={selectedBooking.flag}
                      readOnly
                      className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                    />
                  </div>
                </div>

                {/* Company Information */}
                <div>
                  <Label className="text-sm font-medium text-black mb-1 block">Company Name</Label>
                  <Input
                    value={selectedBooking.companyName}
                    readOnly
                    className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                  />
                </div>

                {selectedBooking.shipownerName && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-black mb-1 block">Shipowner Name</Label>
                      <Input
                        value={selectedBooking.shipownerName}
                        readOnly
                        className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-black mb-1 block">Shipowner Email</Label>
                      <Input
                        value={selectedBooking.shipownerEmail || ''}
                        readOnly
                        className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                      />
                    </div>
                  </div>
                )}

                {/* Bid Information */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-black mb-1 block">Total Bid</Label>
                    <Input
                      value={`₱${selectedBooking.totalBid.toLocaleString()}`}
                      readOnly
                      className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-black mb-1 block">Total Days</Label>
                    <Input
                      value={selectedBooking.totalDays.toString()}
                      readOnly
                      className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-black mb-1 block">Priority Level</Label>
                    <Input
                      value={selectedBooking.priorityLevel}
                      readOnly
                      className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                    />
                  </div>
                </div>

                {/* Status Information */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-black mb-1 block">Booking Status</Label>
                    <Input
                      value={selectedBooking.status.replace('_', ' ')}
                      readOnly
                      className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-black mb-1 block">Booking Date</Label>
                    <Input
                      value={new Date(selectedBooking.bookingDate).toLocaleDateString()}
                      readOnly
                      className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                    />
                  </div>
                </div>

                {selectedBooking.notes && (
                  <div>
                    <Label className="text-sm font-medium text-black mb-1 block">Notes</Label>
                    <Input
                      value={selectedBooking.notes}
                      readOnly
                      className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                    />
                  </div>
                )}
              </div>
            )}

            {selectedBooking?.status === 'PENDING' && (
              <DialogFooter className="flex justify-center">
                <div className="flex gap-3">
                  <Button className="bg-red-600 hover:bg-red-700 text-white border-red-600" onClick={handleCancelClick}>
                    Cancel Booking
                  </Button>
                  <Button className="bg-green-600 hover:bg-green-700 text-white border-green-600" onClick={handleConfirmClick}>
                    Confirm Booking
                  </Button>
                </div>
              </DialogFooter>
            )}

            {selectedBooking?.status === 'CONFIRMED' && (
              <DialogFooter className="flex justify-center">
                <div className="flex gap-3">
                  <Button className="bg-orange-600 hover:bg-orange-700 text-white border-orange-600" onClick={handleInProgressClick}>
                    Mark as In Progress
                  </Button>
                </div>
              </DialogFooter>
            )}

            {selectedBooking?.status === 'IN_PROGRESS' && (
              <DialogFooter className="flex justify-center">
                <div className="flex gap-3">
                  <Button className="bg-green-600 hover:bg-green-700 text-white border-green-600" onClick={handleCompleteClick}>
                    Mark as Completed
                  </Button>
                </div>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>

        {/* Confirm Booking Dialog */}
        <Dialog open={confirmDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setConfirmDialogOpen(false)
            setEditDialogOpen(true)
            setIsConfirming(false)
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[#134686]">Confirm Booking</DialogTitle>
              <DialogDescription>
                Are you sure you want to confirm this booking? This will notify the shipowner.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              <p className="text-sm text-gray-600">
                You are about to confirm the booking for <strong>{selectedBooking?.vesselName}</strong>.
              </p>
            </div>

            <DialogFooter className="flex justify-center">
              <div className="flex gap-3">
                <Button className="bg-gray-500 hover:bg-gray-600 text-white border-gray-500" onClick={() => {
                  setConfirmDialogOpen(false)
                  setEditDialogOpen(true)
                }}>
                  Cancel
                </Button>
                <Button 
                  className="bg-green-600 hover:bg-green-700 text-white border-green-600 disabled:opacity-50 disabled:cursor-not-allowed" 
                  onClick={handleConfirmBooking}
                  disabled={isConfirming}
                >
                  {isConfirming ? "Confirming..." : "Confirm Booking"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel Booking Dialog */}
        <Dialog open={cancelDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setCancelDialogOpen(false)
            setEditDialogOpen(true)
            setIsCancelling(false)
            setCancelReason("")
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[#134686]">Cancel Booking</DialogTitle>
              <DialogDescription>
                Please provide a reason for cancelling this booking.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="cancel-reason" className="text-sm font-medium text-black mb-2 block">
                    Cancellation Reason *
                  </Label>
                  <textarea
                    id="cancel-reason"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Please provide a reason for cancellation..."
                    className="w-full h-24 p-3 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-[#134686] focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="flex justify-center">
              <div className="flex gap-3">
                <Button className="bg-gray-500 hover:bg-gray-600 text-white border-gray-500" onClick={() => {
                  setCancelDialogOpen(false)
                  setEditDialogOpen(true)
                  setCancelReason("")
                }}>
                  Cancel
                </Button>
                <Button 
                  className="bg-red-600 hover:bg-red-700 text-white border-red-600 disabled:opacity-50 disabled:cursor-not-allowed" 
                  onClick={handleCancelBooking}
                  disabled={isCancelling || !cancelReason.trim()}
                >
                  {isCancelling ? "Cancelling..." : "Cancel Booking"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Complete Booking Dialog */}
        <Dialog open={completeDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setCompleteDialogOpen(false)
            setEditDialogOpen(true)
            setIsCompleting(false)
            setCompletionNotes("")
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[#134686]">
                {selectedBooking?.status === 'CONFIRMED' ? 'Mark as In Progress' : 'Complete Booking'}
              </DialogTitle>
              <DialogDescription>
                {selectedBooking?.status === 'CONFIRMED' 
                  ? 'Mark this booking as in progress and add any notes.'
                  : 'Mark this booking as completed and add any completion notes.'
                }
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="completion-notes" className="text-sm font-medium text-black mb-2 block">
                    Completion Notes (Optional)
                  </Label>
                  <textarea
                    id="completion-notes"
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    placeholder="Add any completion notes or remarks..."
                    className="w-full h-24 p-3 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-[#134686] focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="flex justify-center">
              <div className="flex gap-3">
                <Button className="bg-gray-500 hover:bg-gray-600 text-white border-gray-500" onClick={() => {
                  setCompleteDialogOpen(false)
                  setEditDialogOpen(true)
                  setCompletionNotes("")
                }}>
                  Cancel
                </Button>
                <Button 
                  className="bg-green-600 hover:bg-green-700 text-white border-green-600 disabled:opacity-50 disabled:cursor-not-allowed" 
                  onClick={handleCompleteBooking}
                  disabled={isCompleting}
                >
                  {isCompleting 
                    ? (selectedBooking?.status === 'CONFIRMED' ? "Updating..." : "Completing...") 
                    : (selectedBooking?.status === 'CONFIRMED' ? "Mark as In Progress" : "Complete Booking")
                  }
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Toaster />
      </SidebarProvider>
    </ProtectedRoute>
  )
}
