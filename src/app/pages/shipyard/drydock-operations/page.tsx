"use client"

import { ShipyardSidebar } from "@/components/shipyard-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppHeader } from "@/components/AppHeader"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Wrench, Ship, Calendar, CheckCircle, Search } from "lucide-react"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { useEffect, useState, useCallback } from "react"
import React from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"

interface DrydockBooking {
  id: string
  status: string
  vesselName: string
  imoNumber: string
  companyName: string
  companyLogoUrl: string | null
  shipownerName: string
  shipownerLogoUrl: string | null
  totalDays: number
  startDate: string
  endDate: string
  progress: number
  shipyardName: string
  totalBid: number
  bookingDate: string;
  servicesOffered?: Record<string, unknown>;
  requestStatus?: string;
}

interface Service {
  id: string
  name: string
  startDate: string
  endDate: string
  progress: number
}

const CompanyAvatar = ({ logoUrl, name }: { logoUrl: string | null; name: string }) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const fetchSignedUrl = async () => {
      if (!logoUrl || logoUrl === 'null' || logoUrl.trim() === '') {
        setSignedUrl(null)
        return
      }

      try {
        const response = await fetch(`/api/signed-url?url=${encodeURIComponent(logoUrl)}`)
        const data = await response.json()
        if (isMounted && data?.signedUrl) {
          setSignedUrl(data.signedUrl)
        }
      } catch (error) {
        console.error('Error fetching signed logo URL:', error)
        if (isMounted) {
          setSignedUrl(null)
        }
      }
    }

    fetchSignedUrl()

    return () => {
      isMounted = false
    }
  }, [logoUrl])

  return (
    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden border border-gray-300">
      {signedUrl ? (
        <img
          src={signedUrl}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setSignedUrl(null)}
        />
      ) : (
        <span className="text-xs font-medium text-gray-600">
          {name?.charAt(0) || 'S'}
        </span>
      )}
    </div>
  )
}

export default function DrydockOperationsPage() {
  const { user, token } = useAuth()
  const { toast } = useToast()
  const [bookings, setBookings] = useState<DrydockBooking[]>([])
  const [filteredBookings, setFilteredBookings] = useState<DrydockBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedBooking, setSelectedBooking] = useState<DrydockBooking | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [loadingServices, setLoadingServices] = useState(false)
  const [isProgressDialogOpen, setIsProgressDialogOpen] = useState(false)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [progressLevel, setProgressLevel] = useState<string>('')
  const [progressComment, setProgressComment] = useState('')
  const [progressImage, setProgressImage] = useState<File | null>(null)
  const [updatingProgress, setUpdatingProgress] = useState(false)
  const [existingProgress, setExistingProgress] = useState<Array<{
    id: string;
    progressLevel: string;
    progressPercent: number;
    comment: string | null;
    imageUrl: string | null;
    updatedAt: string;
  }>>([])
  const [allProgress, setAllProgress] = useState<Array<{
    id: string;
    progressLevel: string;
    progressPercent: number;
    comment: string | null;
    imageUrl: string | null;
    updatedAt: string;
  }>>([])
  const [showNewUpdateForm, setShowNewUpdateForm] = useState(false)
  const [isCertificateDialogOpen, setIsCertificateDialogOpen] = useState(false)
  const [selectAllCertificates, setSelectAllCertificates] = useState(false)
  const [selectedCertificates, setSelectedCertificates] = useState({
    vesselPlans: false,
    drydockReport: false,
    drydockCertificate: false
  })
  const [vesselPlansFile, setVesselPlansFile] = useState<File | null>(null)
  const [issuingCertificates, setIssuingCertificates] = useState(false)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [historyBookings, setHistoryBookings] = useState<DrydockBooking[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedBookingDetails, setSelectedBookingDetails] = useState<DrydockBooking | null>(null);

  interface IssuedCertificate {
    id: string;
    drydockBookingId: string;
    vesselId: string;
    certificateName: string;
    certificateType: string;
    certificateUrl: string | null;
    issuedDate: string;
    createdAt: string;
    updatedAt: string;
  }
  const [issuedCertificates, setIssuedCertificates] = useState<IssuedCertificate[]>([]);
  const [loadingCertificates, setLoadingCertificates] = useState(false);

  const calculateBookingProgress = async (bookingId: string): Promise<number> => {
    try {
      const response = await fetch(`/api/drydock-services?drydockBookingId=${bookingId}`)
      const data = await response.json()
      
      if (data.success && data.data && data.data.length > 0) {
        // Calculate average progress from all services
        const totalProgress = data.data.reduce((sum: number, service: { progress: number }) => {
          return sum + (service.progress || 0)
        }, 0)
        const averageProgress = Math.round(totalProgress / data.data.length)
        return averageProgress
      }
      // If no services found, return 0
      return 0
    } catch (error) {
      console.error('Error calculating booking progress:', error)
      return 0
    }
  }

  const getBookingDatesFromServices = async (bookingId: string, bookingDate: string, totalDays: number): Promise<{ startDate: string; endDate: string }> => {
    try {
      const response = await fetch(`/api/drydock-services?drydockBookingId=${bookingId}`)
      const data = await response.json()
      
      if (data.success && data.data && data.data.length > 0) {
        // Find the earliest start date and latest end date from all services
        const startDates: Date[] = data.data.map((service: { startDate: string }) => new Date(service.startDate))
        const endDates: Date[] = data.data.map((service: { endDate: string }) => new Date(service.endDate))
        
        const startTimestamps = startDates.map((d: Date) => d.getTime())
        const endTimestamps = endDates.map((d: Date) => d.getTime())
        
        const earliestStart = new Date(Math.min(...startTimestamps))
        const latestEnd = new Date(Math.max(...endTimestamps))
        
        return {
          startDate: earliestStart.toLocaleDateString('en-GB'),
          endDate: latestEnd.toLocaleDateString('en-GB')
        }
      }
      
      // Fallback to booking date calculation if no services found
      return {
        startDate: new Date(bookingDate).toLocaleDateString('en-GB'),
        endDate: new Date(new Date(bookingDate).getTime() + totalDays * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB')
      }
    } catch (error) {
      console.error('Error fetching service dates:', error)
      // Fallback to booking date calculation on error
      return {
        startDate: new Date(bookingDate).toLocaleDateString('en-GB'),
        endDate: new Date(new Date(bookingDate).getTime() + totalDays * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB')
      }
    }
  }

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/shipyard/drydock-bookings?shipyardUserId=${user?.id}`)
      const data = await response.json()
      
      if (data.success) {
        // Filter for confirmed bookings and include completed requests
        const confirmedBookingsPromises = data.bookings
          .map(async (booking: {
            id: string;
            status: string;
            vesselName: string;
            imoNumber: string;
            companyName: string;
            companyLogoUrl: string | null;
            shipownerName: string;
            shipownerLogoUrl: string | null;
            totalDays: number;
            bookingDate: string;
            progress: number;
            shipyardName: string;
            totalBid: number;
            servicesOffered: Record<string, unknown>;
            requestStatus?: string;
          }) => {
            // Calculate actual progress from services
            const progress = await calculateBookingProgress(booking.id)
            // Get dates from services (first service start date and last service end date)
            const dates = await getBookingDatesFromServices(booking.id, booking.bookingDate, booking.totalDays)
            
            return {
              id: booking.id,
              status: booking.status,
              vesselName: booking.vesselName,
              imoNumber: booking.imoNumber,
              companyName: booking.companyName,
              companyLogoUrl: booking.companyLogoUrl,
              shipownerName: booking.shipownerName,
              shipownerLogoUrl: booking.shipownerLogoUrl,
              totalDays: booking.totalDays,
              startDate: dates.startDate,
              endDate: dates.endDate,
              progress: progress, // Calculate from actual services
              shipyardName: booking.shipyardName,
              totalBid: booking.totalBid,
              bookingDate: booking.bookingDate,
              servicesOffered: booking.servicesOffered,
              requestStatus: booking.requestStatus
            }
          })
        
        const confirmedBookings = await Promise.all(confirmedBookingsPromises)
        setBookings(confirmedBookings)
        setFilteredBookings(confirmedBookings)
      }
    } catch (error) {
      console.error('Error fetching bookings:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (user?.id) {
      fetchBookings()
    }
  }, [user?.id, fetchBookings])

  useEffect(() => {
    let filtered = bookings

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(booking => 
        booking.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.vesselName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter(booking => booking.status.toLowerCase() === statusFilter.toLowerCase())
    }

    // Sort to show CONFIRMED bookings first, then others
    const sorted = [...filtered].sort((a, b) => {
      if (a.status === 'CONFIRMED' && b.status !== 'CONFIRMED') {
        return -1
      }
      if (a.status !== 'CONFIRMED' && b.status === 'CONFIRMED') {
        return 1
      }
      return 0
    })

    setFilteredBookings(sorted)
  }, [bookings, searchTerm, statusFilter])

  const handleCardClick = async (booking: DrydockBooking) => {
    setSelectedBooking(booking)
    setIsDialogOpen(true)
    setLoadingServices(true)
    
    try {
      // Fetch real services data from API
      console.log('Fetching services for booking ID:', booking.id)
      const response = await fetch(`/api/drydock-services?drydockBookingId=${booking.id}`)
      const data = await response.json()
      console.log('Services API response:', data)
      
      if (data.success && data.data && data.data.length > 0) {
        // Transform the database services to our Service interface
        const transformedServices: Service[] = data.data.map((service: {
          id: string;
          serviceName: string;
          startDate: string;
          endDate: string;
          progress: number;
        }) => {
          return {
            id: service.id,
            name: service.serviceName || `Service ${service.id.slice(-4)}`, // Use the actual serviceName from database
            startDate: new Date(service.startDate).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            }),
            endDate: new Date(service.endDate).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            }),
            progress: service.progress || 0
          }
        })
        
        // Calculate actual progress from services
        const totalProgress = transformedServices.reduce((sum, service) => sum + service.progress, 0)
        const averageProgress = transformedServices.length > 0 
          ? Math.round(totalProgress / transformedServices.length) 
          : 0
        
        // Update the selected booking with calculated progress
        setSelectedBooking({
          ...booking,
          progress: averageProgress
        })
        
        setServices(transformedServices)
      } else {
        // If no services found in database, create services from servicesOffered
        if (booking.servicesOffered && Object.keys(booking.servicesOffered).length > 0) {
          const servicesFromOffered: Service[] = Object.entries(booking.servicesOffered).map(([name, _details]: [string, unknown], index) => ({
            id: `offered-${index}`,
            name: name,
            startDate: booking.startDate,
            endDate: booking.endDate,
            progress: 0 // Default progress for offered services
          }))
          
          // Since all services have 0 progress, set booking progress to 0
          setSelectedBooking({
            ...booking,
            progress: 0
          })
          
          setServices(servicesFromOffered)
        } else {
          // No services at all, progress should be 0
          setSelectedBooking({
            ...booking,
            progress: 0
          })
          setServices([])
        }
      }
    } catch (error) {
      console.error('Error fetching services:', error)
      setServices([])
      // On error, set progress to 0
      setSelectedBooking({
        ...booking,
        progress: 0
      })
    } finally {
      setLoadingServices(false)
    }
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setSelectedBooking(null)
    setServices([])
  }

  const handleEditProgress = async (service: Service) => {
    setSelectedService(service)
    setProgressLevel('')
    setProgressComment('')
    setProgressImage(null)
    setShowNewUpdateForm(false)
    setIsProgressDialogOpen(true)
    
    // Fetch all progress data
    try {
      const response = await fetch(`/api/drydock-progress?serviceId=${service.id}`)
      const data = await response.json()
      
      if (data.success && data.data.length > 0) {
        setAllProgress(data.data)
        // Set the current progress level based on the latest update
        const latestProgress = data.data[0]
        setProgressLevel(latestProgress.progressLevel)
        // Filter progress by the selected level
        filterProgressByLevel(latestProgress.progressLevel, data.data)
      } else {
        setAllProgress([])
        setExistingProgress([])
      }
    } catch (error) {
      console.error('Error fetching progress data:', error)
      setAllProgress([])
      setExistingProgress([])
    }
  }

  const filterProgressByLevel = (level: string, progressData: Array<{
    id: string;
    progressLevel: string;
    progressPercent: number;
    comment: string | null;
    imageUrl: string | null;
    updatedAt: string;
  }>) => {
    const filtered = progressData.filter(progress => progress.progressLevel === level)
    setExistingProgress(filtered)
  }

  const handleLevelChange = (level: string) => {
    setProgressLevel(level)
    setShowNewUpdateForm(false)
    filterProgressByLevel(level, allProgress)
  }

  const closeProgressDialog = () => {
    setIsProgressDialogOpen(false)
    setSelectedService(null)
    setProgressLevel('')
    setProgressComment('')
    setProgressImage(null)
    setExistingProgress([])
    setAllProgress([])
    setShowNewUpdateForm(false)
  }

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setProgressImage(file)
    }
  }

  const getProgressPercentage = (level: string) => {
    switch (level) {
      case 'Level 1': return 15
      case 'Level 2': return 25
      case 'Level 3': return 50
      case 'Level 4': return 75
      case 'Level 5': return 100
      default: return 0
    }
  }

  const handleUpdateProgress = async () => {
    if (!selectedService || !progressLevel) {
      toast({
        title: "Validation Error",
        description: "Please select a progress level",
        variant: "destructive",
      })
      return
    }

    try {
      setUpdatingProgress(true)
      
      const formData = new FormData()
      formData.append('serviceId', selectedService.id)
      formData.append('progress', getProgressPercentage(progressLevel).toString())
      formData.append('comment', progressComment)
      formData.append('date', new Date().toISOString())
      
      if (progressImage) {
        formData.append('image', progressImage)
      }

      const response = await fetch('/api/drydock-progress', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (result.success) {
        const newProgress = getProgressPercentage(progressLevel)
        
        // Calculate updated services with new progress
        const updatedServices = services.map(service => 
          service.id === selectedService.id 
            ? { ...service, progress: newProgress }
            : service
        )
        
        // Calculate new average progress from all updated services
        const totalProgress = updatedServices.reduce((sum, service) => sum + service.progress, 0)
        const averageProgress = updatedServices.length > 0 
          ? Math.round(totalProgress / updatedServices.length) 
          : 0
        
        // Update the service progress in the local state
        setServices(updatedServices)
        
        // Update the booking progress in the bookings list and selected booking
        if (selectedBooking) {
          // Update the selected booking in the dialog
          setSelectedBooking({
            ...selectedBooking,
            progress: averageProgress
          })
          
          // Update the booking in the bookings list
          setBookings(prevBookings =>
            prevBookings.map(booking =>
              booking.id === selectedBooking.id
                ? { ...booking, progress: averageProgress }
                : booking
            )
          )
          
          setFilteredBookings(prevFiltered =>
            prevFiltered.map(booking =>
              booking.id === selectedBooking.id
                ? { ...booking, progress: averageProgress }
                : booking
            )
          )
        }
        
        // Refresh the progress data
        const response = await fetch(`/api/drydock-progress?serviceId=${selectedService.id}`)
        const data = await response.json()
        if (data.success) {
          setAllProgress(data.data)
          // Filter by the current selected level
          filterProgressByLevel(progressLevel, data.data)
        }
        
        // Reset form
        setProgressComment('')
        setProgressImage(null)
        setShowNewUpdateForm(false)
        
        toast({
          title: "Progress Updated Successfully!",
          description: `Progress has been updated to ${getProgressPercentage(progressLevel)}% for ${selectedService.name}.`,
        })
      } else {
        toast({
          title: "Error",
          description: `Failed to update progress: ${result.error}`,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error('Error updating progress:', error)
      toast({
        title: "Error",
        description: "An error occurred while updating progress. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUpdatingProgress(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return 'bg-green-500'
      case 'in_progress':
        return 'bg-blue-500'
      case 'completed':
        return 'bg-gray-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return 'Confirmed'
      case 'in_progress':
        return 'In Progress'
      case 'completed':
        return 'Completed'
      default:
        return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
    }
  }

  const areAllServicesCompleted = (servicesList: Service[]): boolean => {
    if (servicesList.length === 0) return false
    return servicesList.every(service => service.progress >= 100)
  }

  const handleIssueCertificates = () => {
    // Close the services dialog first
    setIsDialogOpen(false)
    // Then open the certificate dialog
    setIsCertificateDialogOpen(true)
  }

  const handleSelectAllCertificates = (checked: boolean) => {
    setSelectAllCertificates(checked)
    setSelectedCertificates({
      vesselPlans: checked,
      drydockReport: checked,
      drydockCertificate: checked
    })
    if (!checked) {
      setVesselPlansFile(null)
    }
  }

  const handleCertificateChange = (certificate: 'vesselPlans' | 'drydockReport' | 'drydockCertificate', checked: boolean) => {
    const newSelected = {
      ...selectedCertificates,
      [certificate]: checked
    }
    setSelectedCertificates(newSelected)
    
    // Clear file if vessel plans is unchecked
    if (certificate === 'vesselPlans' && !checked) {
      setVesselPlansFile(null)
    }
    
    // Update select all based on all certificates being selected
    const allSelected = newSelected.vesselPlans && newSelected.drydockReport && newSelected.drydockCertificate
    setSelectAllCertificates(allSelected)
  }

  const handleSubmitCertificates = async () => {
    if (!selectedBooking) {
      toast({
        title: "Error",
        description: "No booking selected",
        variant: "destructive",
      })
      return
    }

    // Check if at least one certificate is selected
    if (!selectedCertificates.vesselPlans && !selectedCertificates.drydockReport && !selectedCertificates.drydockCertificate) {
      toast({
        title: "Error",
        description: "Please select at least one certificate to issue",
        variant: "destructive",
      })
      return
    }

    // Validate that if vessel plans is selected, a file must be uploaded
    if (selectedCertificates.vesselPlans && !vesselPlansFile) {
      toast({
        title: "Validation Error",
        description: "Please upload a file for Vessel Plans",
        variant: "destructive",
      })
      return
    }

    try {
      setIssuingCertificates(true)

      // Use FormData to handle file upload
      const formData = new FormData()
      formData.append('bookingId', selectedBooking.id)
      formData.append('vesselPlans', selectedCertificates.vesselPlans.toString())
      formData.append('drydockReport', selectedCertificates.drydockReport.toString())
      formData.append('drydockCertificate', selectedCertificates.drydockCertificate.toString())
      
      if (selectedCertificates.vesselPlans && vesselPlansFile) {
        formData.append('vesselPlansFile', vesselPlansFile)
      }

      const response = await fetch('/api/shipyard/issue-certificates', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to issue certificates')
      }

      if (data.success) {
        // Get list of issued certificates
        const issuedCertNames = data.certificates.map((cert: { name: string }) => cert.name).join(', ')
        
        toast({
          title: "Certificates Issued Successfully!",
          description: `Issued certificates: ${issuedCertNames}. A notification has been sent to the vessel owner.`,
        })
        
        // Close certificate dialog
        setIsCertificateDialogOpen(false)
        
        // Reset checkboxes and file
        setSelectAllCertificates(false)
        setSelectedCertificates({
          vesselPlans: false,
          drydockReport: false,
          drydockCertificate: false
        })
        setVesselPlansFile(null)
        
        // Refresh bookings to update progress
        await fetchBookings()
        
        // Close services dialog as well
        setIsDialogOpen(false)
        setSelectedBooking(null)
      } else {
        throw new Error(data.error || 'Failed to issue certificates')
      }
    } catch (error) {
      console.error('Error issuing certificates:', error)
      toast({
        title: "Error",
        description: `Failed to issue certificates: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      })
    } finally {
      setIssuingCertificates(false)
    }
  }

  const closeCertificateDialog = (open: boolean) => {
    setIsCertificateDialogOpen(open)
    // Reset checkboxes and file when closing
    if (!open) {
      setSelectAllCertificates(false)
      setSelectedCertificates({
        vesselPlans: false,
        drydockReport: false,
        drydockCertificate: false
      })
      setVesselPlansFile(null)
      // Reopen the services dialog if certificate dialog is being closed
      if (selectedBooking) {
        setIsDialogOpen(true)
      }
    }
  }

  const shouldShowForm = existingProgress.length === 0 || showNewUpdateForm
    
  const handleShowHistory = () => {
    setIsHistoryDialogOpen(true);
    fetchHistory();
  };

  const fetchHistory = async () => {
    if (!user?.id) return;
    setLoadingHistory(true);
    try {
        const response = await fetch(`/api/shipyard/drydock-bookings?shipyardUserId=${user.id}&status=COMPLETED`);
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                setHistoryBookings(data.bookings);
            }
        } else {
            toast({
                title: "Error",
                description: "Could not load history.",
                variant: "destructive",
            });
        }
    } catch (error) {
        console.error("Error fetching history:", error);
        toast({
            title: "Error",
            description: "An error occurred while fetching history.",
            variant: "destructive",
        });
    } finally {
        setLoadingHistory(false);
    }
  };

  const handleViewDetailsClick = async (booking: DrydockBooking) => {
    setSelectedBookingDetails(booking);
    setIsDetailsDialogOpen(true);
    setLoadingCertificates(true);
    try {
        if (!token) {
            toast({
                title: "Authentication Error",
                description: "You are not logged in.",
                variant: "destructive",
            });
            setLoadingCertificates(false);
            return;
        }

        // Use the correct shipyard-specific API route to fetch issued certificates
        const response = await fetch(`/api/shipyard/issued-certificates?bookingId=${booking.id}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();

        if (response.status === 401) {
            throw new Error('Unauthorized: Invalid token or session expired.');
        }
        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch certificates.');
        }
        
        if (data.success) {
            // The API returns 'data', not 'certificates'
            setIssuedCertificates(data.data);
        } else {
            setIssuedCertificates([]);
            toast({
                title: "Error",
                description: data.error || "Could not load certificates.",
                variant: "destructive",
            });
        }
    } catch (error) {
        console.error("Error fetching certificates:", error);
        setIssuedCertificates([]);
        toast({
            title: "Error",
            description: error instanceof Error ? error.message : "An error occurred while fetching certificates.",
            variant: "destructive",
        });
    } finally {
        setLoadingCertificates(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['SHIPYARD']}>
      <SidebarProvider>
        <ShipyardSidebar />
        <SidebarInset>
          <AppHeader 
            breadcrumbs={[
              { label: "Dashboard", href: "/pages/shipyard" },
              { label: "Drydock Operations", isCurrentPage: true }
            ]} 
          />

          {loading ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#134686]"></div>
                <p className="text-sm text-gray-600">Loading drydock operations data...</p>
              </div>
            </div>
          ) : (
            <div className="px-6 py-0 pb-6 pt-0 mt-0">
              <div className="mb-5 pt-5">
                <h1 className="text-xl font-bold text-[#134686] mb-2">Drydock Operations</h1>
                <p className="text-sm text-muted-foreground">
                  Below are your booked vessels. Click a company to see more details about the drydock progress.
                </p>
              </div>

              {/* Filters and Search */}
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Progress:</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by company or vessel"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                 <Button variant="outline" onClick={handleShowHistory}>
                    Show History
                </Button>
              </div>

              {/* Vessel Cards */}
              {filteredBookings.length === 0 ? (
              <div className="text-center py-12">
              
                <h3 className="text-md font-medium text-gray-500 mb-2">No drydock operations found</h3>
                <p className="text-gray-500">No confirmed bookings match your current filters.</p>
              </div>
            ) : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredBookings.map((booking) => {
                  const isCompleted = booking.status === 'COMPLETED';
                  return (
                    <div key={booking.id} className="relative">
                      <Card 
                        key={booking.id} 
                        className={`shadow-sm rounded-md border border-gray-200 transition-all duration-300 ${isCompleted ? 'filter blur-xs' : 'cursor-pointer'}`}
                        onClick={() => !isCompleted && handleCardClick(booking)}
                      >
                        <CardContent className="px-4 py-1">
                          {/* Company Info */}
                          <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                              <CompanyAvatar logoUrl={booking.companyLogoUrl} name={booking.companyName} />
                              <div>
                                <h3 className="font-semibold text-gray-900 text-sm">{booking.companyName}</h3>
                                <p className="text-xs text-gray-500">Shipowner</p>
                              </div>
                            </div>
                            <Badge className={`${getStatusColor(booking.status)} text-white text-xs px-2 py-1 rounded-full`}>
                              {getStatusText(booking.status)}
                            </Badge>
                          </div>

                          {/* Vessel Details */}
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span className="text-xs font-medium text-gray-700">
                              {booking.vesselName} (IMO: {booking.imoNumber})
                            </span>
                          </div>

                          {/* Dates */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-gray-400" />
                              <span className="text-xs text-gray-600">
                                Start: {booking.startDate}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-gray-400" />
                              <span className="text-xs text-gray-600">
                                End: {booking.endDate}
                              </span>
                            </div>
                          </div>

                          {/* Progress */}
                          <div className="flex items-center gap-2 mt-3 mb-0 pb-0">
                            <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                              <div 
                                className="bg-[#134686] h-2.5 rounded-full transition-all duration-300" 
                                style={{ width: `${booking.progress}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-medium text-gray-700">{booking.progress}%</span>
                          </div>
                        </CardContent>
                      </Card>
                      {isCompleted && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center rounded-md">
                          <span className="bg-green-500 text-white font-bold text-sm px-4 py-2 rounded-lg shadow-md">COMPLETED</span>
                          <Button 
                              variant="secondary" 
                              className="mt-4" 
                              onClick={() => handleViewDetailsClick(booking)}
                          >
                              View Details
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            </div>
          )}

          {/* Services Progress Dialog */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-xl font-bold text-gray-900">Services Progress</DialogTitle>
                </div>
                <p className="text-sm text-gray-600 mt-0">
                  View and update the progress of each drydock service for this booking.
                </p>
              </DialogHeader>

              {selectedBooking && (
                <div className="space-y-6">
                  

                  {/* Services Table */}
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    {loadingServices ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#134686]"></div>
                        <span className="ml-2 text-sm text-gray-600">Loading services...</span>
                      </div>
                    ) : services.length === 0 ? (
                      <div className="text-center py-8">
                       
                        <p className="text-sm text-gray-500">No services found for this booking.</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Service Name</TableHead>
                            <TableHead>Start Date</TableHead>
                            <TableHead>End Date</TableHead>
                            <TableHead>Progress</TableHead>
                            <TableHead className="w-32">Edit</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {services.map((service, index) => (
                            <TableRow key={service.id}>
                              <TableCell className="font-medium">{index + 1}</TableCell>
                              <TableCell className="font-medium">{service.name}</TableCell>
                              <TableCell>{service.startDate}</TableCell>
                              <TableCell>{service.endDate}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                                    <div 
                                      className="bg-gray-800 h-2 rounded-full transition-all duration-300" 
                                      style={{ width: `${service.progress}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-sm font-medium text-gray-700">{service.progress}%</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {service.progress >= 100 ? (
                                  <span className="text-xs font-medium text-green-600">Completed</span>
                                ) : (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-xs"
                                    style={{ backgroundColor: '#134686', color: 'white', borderColor: '#134686' }}
                                    onClick={() => handleEditProgress(service)}
                                  >
                                    Edit Progress
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>

                  {/* Issue Certificates Button - Show when all services are completed */}
                  {services.length > 0 && areAllServicesCompleted(services) && (
                    <div className="flex justify-end pt-4 cursor-pointer">
                      <Button
                        onClick={handleIssueCertificates}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2"
                      >
                        Issue Certificates
                      </Button>
                    </div>
                  )}
                </div>
              )}

             
            </DialogContent>
          </Dialog>

          {/* Progress Update Dialog */}
          <Dialog open={isProgressDialogOpen} onOpenChange={setIsProgressDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-gray-900">
                  Service Progress - {selectedService?.name}
                </DialogTitle>
                <p className="text-sm text-gray-600 mt-0">
                  Current progress level and history for this service
                </p>
              </DialogHeader>

              {selectedService && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Service</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">{selectedService.name}</p>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Start Date</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">{selectedService.startDate}</p>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">End Date</p>
                      <p className="text-base font-semibold text-gray-900 mt-1">{selectedService.endDate}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="space-y-4">
                      <div className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-base font-semibold text-gray-900">Progress Level</h3>
                          {progressLevel && (
                            <span className="text-xs font-medium text-gray-500">
                              Selected: {getProgressPercentage(progressLevel)}%
                            </span>
                          )}
                        </div>
                        <div className="space-y-3">
                          {['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'].map((level) => (
                            <label
                              key={level}
                              htmlFor={level}
                              className="flex items-center gap-3 p-2 rounded-lg border border-gray-200 hover:border-[#134686] cursor-pointer transition-colors"
                            >
                              <input
                                type="radio"
                                id={level}
                                name="progressLevel"
                                value={level}
                                checked={progressLevel === level}
                                onChange={(e) => handleLevelChange(e.target.value)}
                                className="h-4 w-4 text-[#134686] focus:ring-[#134686] border-gray-300"
                              />
                              <span className="text-sm font-medium text-gray-700">
                                {level} ({getProgressPercentage(level)}%)
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-base font-semibold text-gray-900">Progress History</h3>
                          {existingProgress.length > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs border-[#134686] text-[#134686]"
                              onClick={() => setShowNewUpdateForm(true)}
                            >
                              Add Update
                            </Button>
                          )}
                        </div>
                        {existingProgress.length > 0 ? (
                          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                            {existingProgress.map((progress) => (
                              <div key={progress.id} className="border border-gray-100 rounded-md p-3 bg-white shadow-sm">
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <span className="font-semibold text-gray-900 text-sm">{progress.progressLevel}</span>
                                    <span className="text-xs text-gray-500 ml-2">({progress.progressPercent}%)</span>
                                  </div>
                                  <span className="text-xs text-gray-400">
                                    {new Date(progress.updatedAt).toLocaleDateString()}
                                  </span>
                                </div>
                                {progress.comment && (
                                  <p className="text-xs text-gray-700 bg-gray-50 p-2 rounded mb-2">
                                    {progress.comment}
                                  </p>
                                )}
                                {progress.imageUrl && (
                                  <img
                                    src={progress.imageUrl}
                                    alt="Progress attachment"
                                    className="w-full max-h-24 object-cover rounded border"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No logged updates for this level yet.</p>
                        )}
                      </div>
                    </div>

                    <div className="lg:col-span-2">
                      <div className="border border-gray-200 rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-base font-semibold text-gray-900">Comments & Documentation</h3>
                            <p className="text-sm text-gray-500">Log detailed notes and upload supporting files.</p>
                          </div>
                          {existingProgress.length > 0 && showNewUpdateForm && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs text-gray-600"
                              onClick={() => setShowNewUpdateForm(false)}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>

                        {shouldShowForm ? (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Progress Comments
                              </label>
                              <textarea
                                value={progressComment}
                                onChange={(e) => setProgressComment(e.target.value)}
                                placeholder="Describe the work completed, outstanding tasks, or blockers..."
                                className="w-full p-3 border border-gray-300 rounded-md focus:ring-[#134686] focus:border-[#134686] resize-none"
                                rows={4}
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Progress Image (Optional)
                              </label>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                className="w-full p-2 border border-gray-300 rounded-md focus:ring-[#134686] focus:border-[#134686]"
                              />
                              {progressImage && (
                                <p className="text-sm text-gray-600 mt-1">
                                  Selected: {progressImage.name}
                                </p>
                              )}
                            </div>

                            <div className="pt-2">
                              <Button
                                onClick={handleUpdateProgress}
                                disabled={updatingProgress || !progressLevel}
                                className="w-full bg-[#134686] hover:bg-[#0f3a6d] text-white"
                              >
                                {updatingProgress ? 'Updating...' : 'Update Progress'}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-600">
                            <p>Progress entries already exist for this level. Select &quot;Add Update&quot; from the history panel to log another update.</p>
                            <Button
                              className="mt-4 border-[#134686] text-[#134686]"
                              variant="outline"
                              onClick={() => setShowNewUpdateForm(true)}
                            >
                              Add New Update
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              
            </DialogContent>
          </Dialog>

          {/* Issue Certificates Dialog */}
          <Dialog open={isCertificateDialogOpen} onOpenChange={closeCertificateDialog}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-gray-900">
                  Issue Certificates
                </DialogTitle>
                <p className="text-sm text-gray-600 mt-2">
                  Upload or generate certificates for this drydock operation.
                </p>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Upload Certificate Section */}
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">Upload Certificate</h3>
                      <p className="text-xs text-gray-500 mt-1">Upload an existing certificate file</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        id="vesselPlans"
                        checked={selectedCertificates.vesselPlans}
                        onChange={(e) => handleCertificateChange('vesselPlans', e.target.checked)}
                        className="h-4 w-4 text-[#134686] focus:ring-[#134686] border-gray-300 rounded mt-1"
                      />
                      <div className="flex-1">
                        <label htmlFor="vesselPlans" className="text-sm font-medium text-gray-700 cursor-pointer block mb-2">
                          Vessel Plans
                        </label>
                        {selectedCertificates.vesselPlans && (
                          <div className="space-y-2">
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  setVesselPlansFile(file)
                                }
                              }}
                              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[#134686] file:text-white hover:file:bg-[#0f3a6d] cursor-pointer"
                            />
                            {vesselPlansFile && (
                              <p className="text-xs text-gray-600 mt-1">
                                Selected: <span className="font-medium">{vesselPlansFile.name}</span>
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Generate Certificates Section */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">Generate Certificates</h3>
                      <p className="text-xs text-gray-500 mt-1">System will automatically generate these certificates</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="selectAllGenerated"
                        checked={selectedCertificates.drydockReport && selectedCertificates.drydockCertificate}
                        onChange={(e) => {
                          handleCertificateChange('drydockReport', e.target.checked)
                          handleCertificateChange('drydockCertificate', e.target.checked)
                        }}
                        className="h-4 w-4 text-[#134686] focus:ring-[#134686] border-gray-300 rounded"
                      />
                      <label htmlFor="selectAllGenerated" className="text-xs font-medium text-gray-600 cursor-pointer">
                        Select All
                      </label>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="drydockReport"
                        checked={selectedCertificates.drydockReport}
                        onChange={(e) => handleCertificateChange('drydockReport', e.target.checked)}
                        className="h-4 w-4 text-[#134686] focus:ring-[#134686] border-gray-300 rounded"
                      />
                      <label htmlFor="drydockReport" className="text-sm font-medium text-gray-700 cursor-pointer">
                        Drydock Report
                      </label>
                    </div>

                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="drydockCertificate"
                        checked={selectedCertificates.drydockCertificate}
                        onChange={(e) => handleCertificateChange('drydockCertificate', e.target.checked)}
                        className="h-4 w-4 text-[#134686] focus:ring-[#134686] border-gray-300 rounded"
                      />
                      <label htmlFor="drydockCertificate" className="text-sm font-medium text-gray-700 cursor-pointer">
                        Drydock Certificate
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => closeCertificateDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitCertificates}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={(!selectedCertificates.vesselPlans && !selectedCertificates.drydockReport && !selectedCertificates.drydockCertificate) || issuingCertificates}
                >
                  {issuingCertificates ? 'Issuing...' : 'Issue Certificates'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
           <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Completed Drydock History</DialogTitle>
                        <DialogDescription>
                            This is a record of all previously completed drydock bookings for your shipyard.
                        </DialogDescription>
                    </DialogHeader>
                    {loadingHistory ? (
                        <p>Loading history...</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Vessel</TableHead>
                                    <TableHead>Company</TableHead>
                                    <TableHead>Booking Date</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {historyBookings.map(booking => (
                                    <TableRow key={booking.id}>
                                        <TableCell>{booking.vesselName}</TableCell>
                                        <TableCell>{booking.companyName}</TableCell>
                                        <TableCell>{new Date(booking.bookingDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</TableCell>
                                        <TableCell>
                                            <Badge>{booking.status}</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </DialogContent>
            </Dialog>
            <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
              <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                      <DialogTitle>Completed Drydock Details</DialogTitle>
                      <DialogDescription>
                          Showing details and issued certificates for the completed operation.
                      </DialogDescription>
                  </DialogHeader>
                  {selectedBookingDetails && (
                    <div className="mb-6 border-b pb-4">
                        <h3 className="text-lg font-semibold mb-3 text-gray-800">Booking Summary</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-gray-500">Company</p>
                                <p className="font-medium text-gray-900">{selectedBookingDetails.companyName}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">Vessel</p>
                                <p className="font-medium text-gray-900">{selectedBookingDetails.vesselName} (IMO: {selectedBookingDetails.imoNumber})</p>
                            </div>
                            <div>
                                <p className="text-gray-500">Drydock Period</p>
                                <p className="font-medium text-gray-900">{selectedBookingDetails.startDate} to {selectedBookingDetails.endDate}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">Final Bid</p>
                                <p className="font-medium text-gray-900">₱{selectedBookingDetails.totalBid.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                  )}
                  {loadingCertificates ? (
                      <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#134686]"></div>
                          <span className="ml-2 text-sm text-gray-600">Loading certificates...</span>
                      </div>
                  ) : (
                      <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-gray-800">Issued Certificates</h3>
                          {(() => {
                            const allowedCertificateNames = ["Vessel Plans", "Drydock Report", "Drydock Certificate"];
                            const filteredCertificates = issuedCertificates.filter(cert => 
                              allowedCertificateNames.includes(cert.certificateName) &&
                              cert.drydockBookingId === selectedBookingDetails?.id
                            );
                            
                            if (filteredCertificates.length > 0) {
                              return (
                                <Table>
                                  <TableHeader>
                                      <TableRow>
                                          <TableHead>Certificate Name</TableHead>
                                          <TableHead>Date Issued</TableHead>
                                          <TableHead>Action</TableHead>
                                      </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                      {filteredCertificates.map(cert => (
                                          <TableRow key={cert.id}>
                                              <TableCell>{cert.certificateName}</TableCell>
                                              <TableCell>{new Date(cert.issuedDate).toLocaleDateString()}</TableCell>
                                              <TableCell>
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={async () => {
                                                      if (!cert.certificateUrl) return
                                                      try {
                                                        const resp = await fetch(`/api/view-certificate?url=${encodeURIComponent(cert.certificateUrl)}`)
                                                        if (!resp.ok) throw new Error('Failed to get signed URL')
                                                        const data = await resp.json()
                                                        if (!data.signedUrl) throw new Error('Missing signed URL')
                                                        window.open(data.signedUrl, '_blank')
                                                      } catch (err) {
                                                        console.error('Error opening certificate', err)
                                                      }
                                                    }}
                                                    disabled={!cert.certificateUrl}
                                                  >
                                                    View
                                                  </Button>
                                              </TableCell>
                                          </TableRow>
                                      ))}
                                  </TableBody>
                                </Table>
                              );
                            } else {
                              return <p className="text-sm text-gray-500">No vessel plans, drydock reports, or drydock certificates found for this booking.</p>;
                            }
                          })()}
                      </div>
                  )}
              </DialogContent>
          </Dialog>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </ProtectedRoute>
  )
}

