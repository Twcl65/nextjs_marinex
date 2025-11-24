"use client"

import { ShipyardSidebar } from "@/components/shipyard-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppHeader } from "@/components/AppHeader"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Ship, ChevronLeft, ChevronRight, Calendar } from "lucide-react"
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
  lengthOverall?: number | null
  grossTonnage?: number | null
  priorityLevel: 'NORMAL' | 'EMERGENCY'
  requestStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'IN_PROGRESS' | 'COMPLETED'
  companyName: string
  companyLogoUrl?: string
  shipyardName: string
  totalBid: number
  totalDays: number
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
  const [servicesDialogOpen, setServicesDialogOpen] = useState(false)
  const [selectedServices, setSelectedServices] = useState<Record<string, { squareMeters: number; price: number; days: number }>>({})
  const [workDays, setWorkDays] = useState<Date[]>([])
  const [totalWorkDays, setTotalWorkDays] = useState(0)
  const [scheduleStartDate, setScheduleStartDate] = useState<Date | null>(null)
  const [scheduleDuration, setScheduleDuration] = useState(50)
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [draftScheduleDate, setDraftScheduleDate] = useState<Date | null>(null)
  const [serviceSchedules, setServiceSchedules] = useState<Array<{
    serviceName: string
    startDate: Date
    endDate: Date
    color: string
  }>>([])
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
      console.log('First booking sample:', data.bookings?.[0])
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

  const openScheduleDialog = () => {
    const defaultDate = scheduleStartDate ?? workDays[0] ?? new Date()
    setDraftScheduleDate(defaultDate)
    setScheduleDialogOpen(true)
  }

  const handleScheduleSave = () => {
    if (!draftScheduleDate) {
      toast({
        variant: "destructive",
        title: "Invalid date",
        description: "Please select a valid start date.",
      })
      return
    }

    setScheduleStartDate(draftScheduleDate)
    calculateWorkDays(draftScheduleDate, scheduleDuration)
    toast({
      variant: "success",
      title: "Schedule Updated",
      description: "Work schedule has been updated successfully.",
    })
    setScheduleDialogOpen(false)
  }

  const regenerateServiceSchedules = (
    workDaysSource: Date[],
    servicesMap: Record<string, { squareMeters: number; price: number; days: number }> = selectedServices
  ) => {
    const serviceColors = ['green-500', 'blue-500', 'purple-500', 'orange-500', 'red-500', 'yellow-500']
    const updatedSchedules: Array<{
      serviceName: string
      startDate: Date
      endDate: Date
      color: string
    }> = []

    let currentDateIndex = 0

    Object.entries(servicesMap).forEach(([serviceName, service], index) => {
      const requiredDays = service?.days || 0
      if (requiredDays <= 0 || currentDateIndex >= workDaysSource.length) {
        return
      }

      const serviceWorkDays = workDaysSource.slice(currentDateIndex, currentDateIndex + requiredDays)

      if (serviceWorkDays.length > 0) {
        updatedSchedules.push({
          serviceName,
          startDate: serviceWorkDays[0],
          endDate: serviceWorkDays[serviceWorkDays.length - 1],
          color: serviceColors[index % serviceColors.length]
        })
        currentDateIndex += serviceWorkDays.length
      }
    })

    setServiceSchedules(updatedSchedules)
  }

  const handleEditBooking = (booking: DrydockBooking) => {
    setSelectedBooking(booking)
    setEditDialogOpen(true)
  }

  const handleConfirmClick = () => {
    if (!selectedBooking) return
    
    // Initialize services from the bid data
    const services = selectedBooking.servicesOffered as Record<string, unknown>
    const calculations = selectedBooking.serviceCalculations as Record<string, unknown>
    
    const initialServices: Record<string, { squareMeters: number; price: number; days: number }> = {}
    
    // Parse services and calculations
    Object.keys(services).forEach(serviceKey => {
      const service = services[serviceKey] as Record<string, unknown>
      const calculation = calculations[serviceKey] as Record<string, unknown>
      
      if (service && calculation) {
        // Get the actual service name from the calculation data
        const actualServiceName = (calculation.name as string) || serviceKey
        initialServices[actualServiceName] = {
          squareMeters: (calculation.squareMeters as number) || 0,
          price: (calculation.totalPrice as number) || 0,
          days: (calculation.serviceDays as number) || 0
        }
      }
    })
    
    setSelectedServices(initialServices)
    
    // Calculate total days from all services
    const calculatedTotalDays = Object.values(initialServices).reduce((total, service) => {
      return total + (service.days || 0)
    }, 0)
    
    // Generate work days (excluding Sundays)
    const days = []
    // Start from the booking date
    const startDate = new Date(selectedBooking.bookingDate)
    const totalDays = calculatedTotalDays // Use calculated total instead of stored value
    let workDayCount = 0
    
    // Generate enough days to get the required number of work days (excluding Sundays)
    for (let i = 0; workDayCount < totalDays; i++) {
      const currentDate = new Date(startDate)
      currentDate.setDate(startDate.getDate() + i)
      
      // Skip Sundays (day 0)
      if (currentDate.getDay() !== 0) {
        days.push(new Date(currentDate))
        workDayCount++
      }
    }
    
    // Filter out any invalid dates and ensure all are Date objects
    const validWorkDays = days.filter(day => day instanceof Date && !isNaN(day.getTime()))
    setWorkDays(validWorkDays)
    setTotalWorkDays(totalDays)
    
    console.log('Services data:', services)
    console.log('Calculations data:', calculations)
    console.log('Initial services:', initialServices)
    console.log('Booking date used as start:', selectedBooking.bookingDate)
    console.log('Valid work days:', validWorkDays)

    regenerateServiceSchedules(validWorkDays, initialServices)
    setEditDialogOpen(false)
    setServicesDialogOpen(true)
    
    // Initialize schedule editing state
    if (validWorkDays.length > 0) {
      setScheduleStartDate(validWorkDays[0])
      setScheduleDuration(totalDays)
    }
  }

  const handleServicesConfirm = () => {
    if (!selectedBooking || workDays.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please ensure work schedule is properly set.",
      })
      return
    }

    // Just close the services dialog and show confirmation dialog
    setServicesDialogOpen(false)
    setConfirmDialogOpen(true)
  }

  const handleConfirmBooking = async () => {
    if (!selectedBooking || isConfirming) return

    setIsConfirming(true)

    try {
      // First, save the drydock services data for each service
      if (serviceSchedules.length > 0) {
        console.log('Saving drydock service data for services:', serviceSchedules)

        // Save each service individually
        for (const serviceSchedule of serviceSchedules) {
          console.log('Saving service:', serviceSchedule.serviceName, {
            drydockBidId: selectedBooking.drydockBidId,
            drydockBookingId: selectedBooking.id,
            serviceName: serviceSchedule.serviceName,
            startDate: serviceSchedule.startDate.toISOString(),
            endDate: serviceSchedule.endDate.toISOString(),
            progress: 0
          })

          const serviceResponse = await fetch('/api/drydock-services', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              drydockBidId: selectedBooking.drydockBidId,
              drydockBookingId: selectedBooking.id,
              serviceName: serviceSchedule.serviceName,
              startDate: serviceSchedule.startDate.toISOString(),
              endDate: serviceSchedule.endDate.toISOString(),
              progress: 0
            }),
          })

          const serviceResult = await serviceResponse.json()
          console.log('Service API response for', serviceSchedule.serviceName, ':', serviceResult)

          if (!serviceResponse.ok) {
            throw new Error(serviceResult.error || `Failed to save drydock service schedule for ${serviceSchedule.serviceName}`)
          }
        }
      }

      // Then, confirm the booking
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
          title: "Booking Confirmed Successfully!",
          description: `Booking for ${selectedBooking.vesselName} has been confirmed and work schedule saved.`,
        })

        setConfirmDialogOpen(false)
        setSelectedBooking(null)
        setSelectedServices({})
        setWorkDays([])
        setTotalWorkDays(0)
        setServiceSchedules([])
      } else {
        throw new Error('Failed to confirm booking')
      }
    } catch (error) {
      console.error('Error confirming booking:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to confirm booking. Please try again.",
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
          title: "Booking Declined",
          description: `Booking for ${selectedBooking.vesselName} has been declined.`,
        })

        setCancelDialogOpen(false)
        setSelectedBooking(null)
        setCancelReason("")
      } else {
        throw new Error('Failed to decline booking')
      }
    } catch (error) {
      console.error('Error declining booking:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to decline booking. Please try again.",
      })
    } finally {
      setIsCancelling(false)
    }
  }

  const handleCompleteClick = () => {
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

  const calculateWorkDays = (startDate: Date, duration: number) => {
    const workDays: Date[] = []
    const currentDate = new Date(startDate)
    let workDaysCount = 0

    while (workDaysCount < duration) {
      // Skip Sundays (day 0)
      if (currentDate.getDay() !== 0) {
        workDays.push(new Date(currentDate))
        workDaysCount++
      }
      currentDate.setDate(currentDate.getDate() + 1)
    }

    setWorkDays(workDays)
    setTotalWorkDays(workDays.length)
    regenerateServiceSchedules(workDays)
  }

  const formatScheduleDate = (value: Date | string | null | undefined) => {
    if (!value) return 'No date selected'
    const parsedDate = value instanceof Date ? value : new Date(value)
    if (isNaN(parsedDate.getTime())) return 'No date selected'
    return parsedDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
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

  const formatPriority = (priority: string) => {
    switch (priority) {
      case 'EMERGENCY':
        return 'Emergency'
      case 'NORMAL':
        return 'Normal'
      default:
        return priority
    }
  }

  const formatStatus = (status: string) => {
    return status.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <ProtectedRoute allowedRoles={['SHIPYARD']}>
      <SidebarProvider>
        <ShipyardSidebar />
        <SidebarInset className="overflow-x-hidden">
          <AppHeader 
            breadcrumbs={[
              { label: "Dashboard", href: "/pages/shipyard" },
              { label: "View & Confirm Bookings", isCurrentPage: true }
            ]} 
          />
          
          {loading ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#134686]"></div>
                <p className="text-sm text-gray-600">Loading bookings data...</p>
              </div>
            </div>
          ) : (
            <div className="px-6 py-0 pb-6 overflow-x-hidden">
            <div className="mb-6">
              <h1 className="text-lg md:text-lg font-bold text-[#134686]">Drydock Bookings Management</h1>
              <p className="text-sm text-muted-foreground mt-1">View and manage drydock bookings with vessel information and booking status.</p>
            </div>

            {/* Search and Filter Section */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Label htmlFor="search" className="text-xs font-normal whitespace-nowrap">Search:</Label>
                <Input
                  id="search"
                  placeholder="Search by vessel name, company, IMO number, or shipowner..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full max-w-80"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="status-filter" className="text-xs font-normal whitespace-nowrap">Filter by status:</Label>
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
                <Label htmlFor="priority-filter" className="text-xs font-normal whitespace-nowrap">Filter by priority:</Label>
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
            <div className="border border-gray-300 rounded-lg overflow-x-auto w-full mb-3">
              <Table className="w-full min-w-[600px]">
                <TableHeader>
                  <TableRow className="align-middle h-4 bg-gray-50">
                    <TableHead className="whitespace-nowrap py-0 h-11 min-w-[120px]">Vessel</TableHead>
                    <TableHead className="whitespace-nowrap py-0 h-11 min-w-[150px]">Company</TableHead>
                    <TableHead className="whitespace-nowrap py-0 h-11 min-w-[100px]">IMO</TableHead>
                    <TableHead className="whitespace-nowrap py-0 h-11 w-20">Priority</TableHead>
                    <TableHead className="whitespace-nowrap py-0 h-11 w-24">Status</TableHead>
                    <TableHead className="whitespace-nowrap py-0 h-11 w-24">Booking Date</TableHead>
                    <TableHead className="whitespace-nowrap py-0 h-11 min-w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        <p className="text-gray-600">Loading bookings...</p>
                      </TableCell>
                    </TableRow>
                  ) : currentBookings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        <Ship className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-gray-600">No bookings found</p>
                        <p className="text-sm text-gray-500 mt-1">No drydock bookings match your search criteria</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentBookings.map((booking) => (
                      <TableRow key={booking.id} className="align-middle h-6">
                        <TableCell className="py-2">
                          <span className="font-medium text-gray truncate block max-w-[120px]" title={booking.vesselName}>
                            {booking.vesselName}
                          </span>
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-2">
                            <CompanyLogo booking={booking} />
                            <span className="text-sm text-gray-600 truncate flex-1" title={booking.companyName}>
                              {booking.companyName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          <span className="text-sm text-gray-600 truncate block max-w-[100px]" title={booking.imoNumber}>
                            {booking.imoNumber}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-2">
                          <Badge className={getPriorityColor(booking.priorityLevel)}>
                            {formatPriority(booking.priorityLevel)}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-2">
                          <Badge className={getStatusColor(booking.status)}>
                            {formatStatus(booking.status)}
                          </Badge>
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
                          {booking.status === 'COMPLETED' ? (
                            <span className="text-sm font-medium text-gray-500">Closed</span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:text-white h-7 px-3 text-xs whitespace-nowrap"
                              onClick={() => handleEditBooking(booking)}
                            >
                              View Information
                            </Button>
                          )}
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
          )}
        </SidebarInset>

        {/* Booking Details Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
            <DialogHeader>
              <DialogTitle className="text-[#134686]">
                Booking Details - {selectedBooking?.vesselName}
              </DialogTitle>
              <DialogDescription>
                View and manage this drydock booking information.
              </DialogDescription>
            </DialogHeader>
            
            {selectedBooking && (
              <div className="space-y-6 overflow-x-hidden">
                {/* Vessel Information Section */}
                <div className="space-y-4">
                  <div className="flex justify-start pb-0 mb-2">
                    <h3 className="text-md font-semibold">Vessel Information</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-normal text-black mb-1 block">Vessel Name</Label>
                      <Input
                        value={selectedBooking.vesselName}
                        readOnly
                        className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-normal text-black mb-1 block">IMO Number</Label>
                      <Input
                        value={selectedBooking.imoNumber}
                        readOnly
                        className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-normal text-black mb-1 block">Ship Type</Label>
                      <Input
                        value={selectedBooking.shipType}
                        readOnly
                        className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-normal text-black mb-1 block">Flag</Label>
                      <Input
                        value={selectedBooking.flag}
                        readOnly
                        className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-normal text-black mb-1 block">Length Overall (m)</Label>
                      <Input
                        value={selectedBooking.lengthOverall ? selectedBooking.lengthOverall.toString() : 'N/A'}
                        readOnly
                        className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                        title={`Debug: lengthOverall = ${selectedBooking.lengthOverall} (type: ${typeof selectedBooking.lengthOverall})`}
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-normal text-black mb-1 block">Gross Tonnage</Label>
                      <Input
                        value={selectedBooking.grossTonnage ? selectedBooking.grossTonnage.toString() : 'N/A'}
                        readOnly
                        className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                        title={`Debug: grossTonnage = ${selectedBooking.grossTonnage} (type: ${typeof selectedBooking.grossTonnage})`}
                      />
                    </div>
                  </div>
                </div>

                {/* Booking Information Section */}
                <div className="space-y-4">
                  <div className="flex justify-start pb-0 mb-2">
                    <h3 className="text-md font-semibold">Booking Information</h3>
                  </div>

                  {/* Company Information */}
                  <div>
                    <Label className="text-xs font-normal text-black mb-1 block">Company Name</Label>
                    <Input
                      value={selectedBooking.companyName}
                      readOnly
                      className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                    />
                  </div>

                  {selectedBooking.shipownerName && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs font-normal text-black mb-1 block">Shipowner Name</Label>
                        <Input
                          value={selectedBooking.shipownerName}
                          readOnly
                          className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-normal text-black mb-1 block">Shipowner Email</Label>
                        <Input
                          value={selectedBooking.shipownerEmail || ''}
                          readOnly
                          className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                        />
                      </div>
                    </div>
                  )}

                  {/* Bid Information */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs font-normal text-black mb-1 block">Total Bid</Label>
                      <Input
                        value={`₱${selectedBooking.totalBid.toLocaleString()}`}
                        readOnly
                        className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-normal text-black mb-1 block">Total Days</Label>
                      <Input
                        value={(() => {
                          // Calculate total days from all services
                          const calculations = selectedBooking.serviceCalculations as Record<string, unknown>
                          const calculatedTotalDays = Object.values(calculations).reduce((total: number, calculation: unknown) => {
                            const calc = calculation as Record<string, unknown>
                            return total + ((calc.serviceDays as number) || 0)
                          }, 0)
                          return calculatedTotalDays.toString()
                        })()}
                        readOnly
                        className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-normal text-black mb-1 block">Priority Level</Label>
                      <Input
                        value={formatPriority(selectedBooking.priorityLevel)}
                        readOnly
                        className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                      />
                    </div>
                  </div>

                  {/* Status Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-normal text-black mb-1 block">Booking Status</Label>
                      <Input
                        value={formatStatus(selectedBooking.status)}
                        readOnly
                        className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-normal text-black mb-1 block">Booking Date</Label>
                      <Input
                        value={new Date(selectedBooking.bookingDate).toLocaleDateString()}
                        readOnly
                        className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                      />
                    </div>
                  </div>

                  {/* Bid Certificate */}
                  {selectedBooking.bidCertificateUrl && (
                    <div>
                      <Label className="text-xs font-normal text-black mb-1 block">Drydock Bid Qoutation</Label>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const response = await fetch(`/api/signed-url?url=${encodeURIComponent(selectedBooking.bidCertificateUrl!)}`)
                              const data = await response.json()
                              if (data.signedUrl) {
                                window.open(data.signedUrl, '_blank')
                              } else {
                                console.error('Failed to get signed URL for bid certificate')
                              }
                            } catch (error) {
                              console.error('Error fetching signed URL:', error)
                            }
                          }}
                          className="bg-blue-50 border-blue-200 text-blue-700 cursor-pointer hover:bg-blue-100"
                        >
                          View Drydock Bid Quotation
                        </Button>
                      </div>
                    </div>
                  )}

                  
                </div>
              </div>
            )}

            {selectedBooking?.status === 'PENDING' && (
              <DialogFooter className="flex justify-center">
                <div className="flex gap-3">
                  <Button className="bg-red-600 cursor-pointer hover:bg-red-700 text-white border-red-600" onClick={handleCancelClick}>
                    Decline
                  </Button>
                  <Button className="bg-green-600 cursor-pointer hover:bg-green-700 text-white border-green-600" onClick={handleConfirmClick}>
                    Confirm
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

        {/* Services Confirmation Dialog */}
        <Dialog open={servicesDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setServicesDialogOpen(false)
            setEditDialogOpen(true)
            setSelectedServices({})
            setWorkDays([])
            setTotalWorkDays(0)
            setServiceSchedules([])
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
            <DialogHeader>
              <DialogTitle className="text-[#134686]">
                Confirm Booking Services - {selectedBooking?.vesselName}
              </DialogTitle>
              <DialogDescription>
                Review the schedule before confirming this booking.
              </DialogDescription>
            </DialogHeader>
            
            {selectedBooking && (
              <div className="space-y-6 overflow-x-hidden">

                {/* Individual Services Section */}
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Individual Service Schedule Details</p>
                  </div>
                  <div className="border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600 text-left">
                        <tr>
                          <th className="px-4 py-2 font-medium">Service</th>
                          <th className="px-4 py-2 font-medium">Start Date</th>
                          <th className="px-4 py-2 font-medium">End Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {serviceSchedules.map((schedule, index) => (
                          <tr key={index} className="border-t border-gray-100">
                            <td className="px-4 py-2 font-medium text-gray-900">{schedule.serviceName}</td>
                            <td className="px-4 py-2">{formatScheduleDate(schedule.startDate)}</td>
                            <td className="px-4 py-2">{formatScheduleDate(schedule.endDate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Duration Section - Full Width Below */}
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">Total Duration</h3>
                      <p className="text-sm text-gray-600">Overall work window (excluding Sundays).</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200"
                        onClick={openScheduleDialog}
                      >
                        <Calendar className="w-4 h-4 mr-2 text-gray-600" />
                        Edit Schedule
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs font-normal text-black mb-1 block">Duration</Label>
                      <div className="p-2 border border-gray-200 rounded text-sm font-medium">
                        {totalWorkDays} days
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-normal text-black mb-1 block">Start Date</Label>
                      <div className="p-2 border border-gray-200 rounded text-sm">
                        {workDays.length > 0 ? workDays[0].toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        }) : 'No date selected'}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-normal text-black mb-1 block">End Date</Label>
                      <div className="p-2 border border-gray-200 rounded text-sm">
                        {workDays.length > 0 ? workDays[workDays.length - 1].toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        }) : 'No date selected'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="flex justify-center">
              <div className="flex gap-3">
                <Button className="bg-gray-500 hover:bg-gray-600 text-white border-gray-500" onClick={() => {
                  setServicesDialogOpen(false)
                  setEditDialogOpen(true)
                  setSelectedServices({})
                  setWorkDays([])
                  setTotalWorkDays(0)
                  setServiceSchedules([])
                }}>
                  Back
                </Button>
                <Button 
                  className="bg-green-600 hover:bg-green-700 text-white border-green-600 cursor-pointer" 
                  onClick={handleServicesConfirm}
                >
                  Proceed to Confirm
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Schedule Edit Dialog */}
        <Dialog open={scheduleDialogOpen} onOpenChange={(open) => {
          setScheduleDialogOpen(open)
          if (!open) {
            setDraftScheduleDate(null)
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[#134686]">Edit Work Schedule</DialogTitle>
              <DialogDescription>
                You only need to edit the start date and the system will calculate the start and end dates automatically.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 space-y-4">
              <div>
                <Label className="text-xs font-normal text-black mb-1 block">Start Date</Label>
                <Input
                  type="date"
                  value={draftScheduleDate ? draftScheduleDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    const newDate = e.target.value ? new Date(e.target.value) : null
                    setDraftScheduleDate(newDate && !isNaN(newDate.getTime()) ? newDate : null)
                  }}
                  className="border-gray-300"
                />
              </div>
            </div>

            <DialogFooter className="flex justify-center">
              <div className="flex gap-3">
                <Button 
                  className="bg-gray-500 cursor-pointer hover:bg-gray-600 text-white border-gray-500"
                  onClick={() => {
                    setScheduleDialogOpen(false)
                    setDraftScheduleDate(null)
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  className="bg-green-600 cursor-pointer hover:bg-green-700 text-white border-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleScheduleSave}
                  disabled={!draftScheduleDate}
                >
                  Save Schedule
                </Button>
              </div>
            </DialogFooter>
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
                Are you sure you want to confirm this booking? This will update the booking status to &quot;Confirmed&quot;.
              </DialogDescription>
            </DialogHeader>
            
           

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
              <DialogTitle className="text-[#134686]">Decline Booking</DialogTitle>
              <DialogDescription>
                Please provide a reason for declining this booking.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="cancel-reason" className="text-xs font-normal text-black mb-2 block">
                    Decline Reason *
                  </Label>
                  <textarea
                    id="cancel-reason"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Please provide a reason for declining..."
                    className="w-full h-24 p-3 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-[#134686] focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="flex justify-center">
              <div className="flex gap-3">
                <Button className="bg-gray-500 cursor-pointer hover:bg-gray-600 text-white border-gray-500" onClick={() => {
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
                  {isCancelling ? "Declining..." : "Decline Booking"}
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
                  <Label htmlFor="completion-notes" className="text-xs font-normal text-black mb-2 block">
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
