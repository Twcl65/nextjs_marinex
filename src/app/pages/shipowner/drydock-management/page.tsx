"use client"

import Image from "next/image"
import { ShipownerSidebar } from "@/components/shipowner-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppHeader } from "@/components/AppHeader"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Ship } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ChevronLeft, ChevronRight, Building2, FileText } from "lucide-react"

// Type definitions
interface DrydockRequest {
  id: string;
  userId: string;
  vesselId: string;
  companyName?: string;
  companyLogoUrl?: string;
  vesselName: string;
  imoNumber: string;
  flag: string;
  shipType: string;
  vesselImageUrl?: string;
  priorityLevel: string;
  servicesNeeded: string | Array<{ name: string } | string>;
  scopeOfWorkUrl: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  bookingId?: string;
  authorityCertificate?: string;
}

interface BookedShipyard {
  id: string;
  shipyardName: string;
  drydockRequestId: string;
}

// ShipyardLogo component to handle S3 signed URLs
function ShipyardLogo({ logoUrl, shipyardName }: { logoUrl: string; shipyardName: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    if (logoUrl) {
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
            setImageError(true)
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
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
        <Building2 className="h-6 w-6 text-gray-400" />
      </div>
    )
  }

  return (
    <Image 
      src={imageUrl} 
      alt={`${shipyardName} logo`}
      width={48}
      height={48}
      className="w-12 h-12 rounded-full object-cover"
      onError={() => setImageError(true)}
    />
  )
}

export default function DrydockManagementPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [showBrowseShipyard, setShowBrowseShipyard] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<{
    id: string;
    vesselId: string;
    servicesNeeded: string | Array<{ name: string } | string>;
    priorityLevel: string;
    scopeOfWorkUrl: string;
    status: string;
    createdAt: string;
    vesselName: string;
    imoNumber: string;
    companyName?: string;
  } | null>(null)
  const [shipyardsWithBids, setShipyardsWithBids] = useState<{
    bidId: string;
    drydockRequestId: string;
    shipyardUserId: string;
    shipyardName: string;
    shipyardAddress: string;
    shipyardContactNumber: string;
    shipyardContactPerson: string;
    shipyardBusinessReg: string;
    shipyardLogoUrl: string;
    certificateBuilder: string;
    certificateRepair: string;
    certificateOther: string;
    bidCertificateUrl: string;
    servicesOffered: Record<string, unknown>;
    serviceCalculations: Record<string, unknown>;
    totalBid: number;
    totalDays: number;
    parallelDays: number;
    sequentialDays: number;
    bidStatus: string;
    bidDate: string;
  }[]>([])
  const [loadingShipyards, setLoadingShipyards] = useState(false)
  const [shipyardSearchTerm, setShipyardSearchTerm] = useState('')
  const [openBidDialog, setOpenBidDialog] = useState(false)
  const [selectedBid, setSelectedBid] = useState<{
    bidId: string;
    drydockRequestId: string;
    shipyardUserId: string;
    shipyardName: string;
    shipyardAddress: string;
    shipyardContactNumber: string;
    shipyardContactPerson: string;
    shipyardBusinessReg: string;
    shipyardLogoUrl: string;
    certificateBuilder: string;
    certificateRepair: string;
    certificateOther: string;
    bidCertificateUrl: string;
    servicesOffered: Record<string, unknown>;
    serviceCalculations: Record<string, unknown>;
    totalBid: number;
    totalDays: number;
    parallelDays: number;
    sequentialDays: number;
    bidStatus: string;
    bidDate: string;
  } | null>(null)
  const [showBookingConfirmation, setShowBookingConfirmation] = useState(false)
  const [openBookedShipyardsDialog, setOpenBookedShipyardsDialog] = useState(false)
  const [bookedShipyards, setBookedShipyards] = useState<{
    id: string;
    drydockRequestId: string;
    drydockBidId: string;
    userId: string;
    shipyardUserId: string;
    status: string;
    bookingDate: string;
    notes: string | null;
    vesselName: string;
    imoNumber: string;
    requestStatus: string;
    shipyardName: string;
    totalBid: number;
    totalDays: number;
    parallelDays: number;
    sequentialDays: number;
    bidStatus: string;
    servicesOffered: Record<string, unknown>;
    serviceCalculations: Record<string, unknown>;
    bidCertificateUrl: string | null;
    bidDate: string;
    shipyardContactName: string;
    shipyardContactEmail: string;
    shipyardContactNumber: string;
    shipyardAddress: string;
    shipyardContactPerson: string;
    shipyardBusinessReg: string;
    shipyardLogoUrl: string | null;
    certificateBuilder: string | null;
    certificateRepair: string | null;
    certificateOther: string | null;
  }[]>([])
  const [loadingBookedShipyards, setLoadingBookedShipyards] = useState(false)
  const [bookedBidIds, setBookedBidIds] = useState<Set<string>>(new Set())
  const [cancelledBidIds, setCancelledBidIds] = useState<Set<string>>(new Set())
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false)
  const [bookingToCancel, setBookingToCancel] = useState<{
    id: string;
    drydockBidId: string;
    status: string;
  } | null>(null)
  const [isFromBookedView, setIsFromBookedView] = useState(false)
  const [isBookingLoading, setIsBookingLoading] = useState(false)
  const [showAuthorityApprovalDialog, setShowAuthorityApprovalDialog] = useState(false)
  const [showCreateAuthorityDialog, setShowCreateAuthorityDialog] = useState(false)
  const [selectedDrydockRequest, setSelectedDrydockRequest] = useState<DrydockRequest | null>(null)
  const [authorityRequests, setAuthorityRequests] = useState<{
    id: string;
    requestDate: string;
    status: string;
    finalScopeOfWorkUrl?: string;
    authorityCertificate?: string;
    drydockRequest?: {
      id: string;
      status: string;
      vesselName: string;
      imoNumber: string;
    } | null;
  }[]>([])
  const [isLoadingAuthorityRequests, setIsLoadingAuthorityRequests] = useState(false)
  const [isCreatingAuthorityRequest, setIsCreatingAuthorityRequest] = useState(false)
  const [vessels, setVessels] = useState<{
    id: string;
    name: string;
    imoNumber: string;
    shipType: string;
    flag: string;
    yearOfBuild?: number;
    lengthOverall?: number;
    grossTonnage?: number;
    vesselImageUrl?: string;
  }[]>([])
  const [loadingVessels, setLoadingVessels] = useState(true)
  const [userServices, setUserServices] = useState<{
    id: string;
    name: string;
    squareMeters: number;
    hours: number;
    workers: number;
    days: number;
    price: string;
  }[]>([])
  const [loadingServices, setLoadingServices] = useState(true)
  const [form, setForm] = useState({
    vesselId: '',
    companyName: '',
    imoNumber: '',
    vesselName: '',
    flag: '',
    shipType: '',
    priorityLevel: 'Normal' as 'Normal' | 'Emergency',
    servicesNeeded: [] as string[],
    scopeOfWork: null as File | null,
    vesselImageUrl: ''
  })
  const [serviceAreas, setServiceAreas] = useState<Record<string, string>>({})
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Table states
  const [drydockRequests, setDrydockRequests] = useState<DrydockRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(5)
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')


  // Fetch vessels from database
  useEffect(() => {
    const fetchVessels = async () => {
      if (!user?.id) return
      
      try {
        setLoadingVessels(true)
        const response = await fetch(`/api/vessels?userId=${user.id}`)
        if (response.ok) {
          const data = await response.json()
          // Map vesselName to name for frontend compatibility
          const mappedVessels = (data.vessels || []).map((vessel: {
            id: string;
            vesselName: string;
            imoNumber: string;
            shipType: string;
            flag: string;
            yearOfBuild?: number;
            lengthOverall?: number;
            grossTonnage?: number;
            vesselImageUrl?: string;
          }) => ({
            ...vessel,
            name: vessel.vesselName
          }))
          setVessels(mappedVessels)
        } else {
          console.error('Failed to fetch vessels')
          toast({
            title: "Error",
            description: "Failed to load vessels. Please refresh the page.",
            variant: "destructive"
          })
        }
      } catch (error) {
        console.error('Error fetching vessels:', error)
        toast({
          title: "Error",
          description: "Error loading vessels. Please try again.",
          variant: "destructive"
        })
      } finally {
        setLoadingVessels(false)
      }
    }

    if (user?.id) {
      fetchVessels()
    }
  }, [user?.id, toast])

  // Fetch all services from database
  useEffect(() => {
    const fetchAllServices = async () => {
      console.log('Fetching all services from user_services table')
      
      try {
        setLoadingServices(true)
        const response = await fetch(`/api/user-services`)
        if (response.ok) {
          const data = await response.json()
          console.log('All services data:', data)
          setUserServices(data.services || [])
        } else {
          console.error('Failed to fetch user services')
          toast({
            title: "Error",
            description: "Failed to load services. Please refresh the page.",
            variant: "destructive"
          })
        }
      } catch (error) {
        console.error('Error fetching user services:', error)
        toast({
          title: "Error",
          description: "Error loading services. Please try again.",
          variant: "destructive"
        })
      } finally {
        setLoadingServices(false)
      }
    }

    fetchAllServices()
  }, [toast])

  // Fetch authority requests for the user
  const fetchAuthorityRequests = useCallback(async () => {
    if (!user?.id) return []
    
    setIsLoadingAuthorityRequests(true)
    try {
      const response = await fetch(`/api/authority-approval-certificates?userId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        setAuthorityRequests(data.authorityRequests || [])
        return data.authorityRequests || []
      }
    } catch (error) {
      console.error('Error fetching authority requests:', error)
    } finally {
      setIsLoadingAuthorityRequests(false)
    }
    return []
  }, [user?.id])

  // Check if authority request exists for a specific drydock request
  const hasAuthorityRequest = useCallback((drydockRequestId: string) => {
    return authorityRequests.some(request => 
      request.drydockRequest && request.drydockRequest.id === drydockRequestId
    )
  }, [authorityRequests])

  // Get authority request with certificate for a specific drydock request
  const getAuthorityRequestWithCert = useCallback((drydockRequestId: string) => {
    return authorityRequests.find(request => 
      request.drydockRequest && 
      request.drydockRequest.id === drydockRequestId &&
      request.authorityCertificate
    )
  }, [authorityRequests])

  // Create authority request
  const createAuthorityRequest = useCallback(async (formData: FormData) => {
    setIsCreatingAuthorityRequest(true)
    try {
      const response = await fetch('/api/authority-approval-certificates', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const result = await response.json()
        toast({
          title: "Success",
          description: "Authority request submitted successfully",
          variant: "default"
        })
        
        // Refresh authority requests
        await fetchAuthorityRequests()
        
        // Close the create dialog and show the table dialog
        setShowCreateAuthorityDialog(false)
        setShowAuthorityApprovalDialog(true)
        
        return result
      } else {
        const errorData = await response.json()
        toast({
          title: "Error",
          description: errorData.error || "Failed to submit authority request",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error creating authority request:', error)
      toast({
        title: "Error",
        description: "Failed to submit authority request",
        variant: "destructive"
      })
    } finally {
      setIsCreatingAuthorityRequest(false)
    }
  }, [fetchAuthorityRequests, toast])

  // Fetch drydock requests from database
  const fetchDrydockRequests = useCallback(async () => {
    if (!user?.id) return
    
    try {
      setLoadingRequests(true)
      const response = await fetch(`/api/drydock-requests?userId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        setDrydockRequests(data.requests || [])
      } else {
        console.error('Failed to fetch drydock requests')
        toast({
          title: "Error",
          description: "Failed to load drydock requests. Please refresh the page.",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error fetching drydock requests:', error)
      toast({
        title: "Error",
        description: "Error loading drydock requests. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoadingRequests(false)
    }
  }, [user?.id, toast])

  useEffect(() => {
    if (user?.id) {
      fetchDrydockRequests()
      fetchAuthorityRequests()
    }
  }, [user?.id, fetchDrydockRequests, fetchAuthorityRequests])


  // Filter and search functions
  const filteredRequests = drydockRequests.filter(request => {
    const matchesSearch = searchTerm === '' || 
      request.vesselName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.imoNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.companyName?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter
    const matchesPriority = priorityFilter === 'all' || request.priorityLevel === priorityFilter
    
    return matchesSearch && matchesStatus && matchesPriority
  })

  // Table functions
  const totalPages = Math.ceil(filteredRequests.length / rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const currentRequests = filteredRequests.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'APPROVED':
        return 'bg-green-100 text-green-800'
      case 'REJECTED':
        return 'bg-red-100 text-red-800'
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800'
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleVesselSelect = (vessel: { id: string; name: string; imoNumber: string; shipType: string; flag: string; vesselImageUrl?: string }) => {
    setForm(prev => ({
      ...prev,
      vesselId: vessel.id,
      companyName: user?.fullName || '',
      imoNumber: vessel.imoNumber,
      vesselName: vessel.name,
      flag: vessel.flag || '',
      shipType: vessel.shipType || '',
      vesselImageUrl: vessel.vesselImageUrl || ''
    }))
  }

  const handleServiceToggle = (service: string) => {
    setForm(prev => ({
      ...prev,
      servicesNeeded: prev.servicesNeeded.includes(service)
        ? prev.servicesNeeded.filter(s => s !== service)
        : [...prev.servicesNeeded, service]
    }))
  }

  const handleServiceAreaChange = (service: string, value: string) => {
    setServiceAreas(prev => ({
      ...prev,
      [service]: value
    }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setForm(prev => ({ ...prev, scopeOfWork: file }))
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}
    
    if (!form.companyName) errors.companyName = 'Company name is required'
    if (!form.imoNumber) errors.imoNumber = 'IMO number is required'
    if (!form.vesselName) errors.vesselName = 'Vessel name is required'
    if (!form.flag) errors.flag = 'Flag is required'
    if (!form.shipType) errors.shipType = 'Ship type is required'
    if (form.servicesNeeded.length === 0) errors.servicesNeeded = 'At least one service is required'
    if (!form.scopeOfWork) errors.file = 'Scope of work file is required'
    
    // Validate that all selected services have square meter areas
    const missingAreas = form.servicesNeeded.filter(serviceName => {
      const area = serviceAreas[serviceName]
      return !area || area === '' || parseFloat(area) <= 0
    })
    
    if (missingAreas.length > 0) {
      errors.servicesNeeded = 'Please specify square meters for all selected services'
    }
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmitDrydockRequest = async () => {
    if (!validateForm()) return

    setIsSubmitting(true)
    try {
      // Prepare services data with areas
      const servicesWithAreas = form.servicesNeeded.map(serviceName => {
        const area = serviceAreas[serviceName] || '0'
        return {
          name: serviceName,
          area: parseFloat(area) || 0
        }
      })

      console.log('Services with areas:', servicesWithAreas)

      // Create FormData for file upload
      const submitFormData = new FormData()
      submitFormData.append('userId', user?.id || '')
      submitFormData.append('vesselId', form.vesselId || '')
      submitFormData.append('companyName', form.companyName)
      submitFormData.append('vesselName', form.vesselName)
      submitFormData.append('imoNumber', form.imoNumber)
      submitFormData.append('flag', form.flag)
      submitFormData.append('shipType', form.shipType)
      submitFormData.append('priorityLevel', form.priorityLevel)
      submitFormData.append('servicesNeeded', JSON.stringify(servicesWithAreas))
      submitFormData.append('companyLogoUrl', user?.logoUrl || '')
      submitFormData.append('vesselImageUrl', form.vesselImageUrl || '')
      
      if (form.scopeOfWork) {
        submitFormData.append('scopeOfWork', form.scopeOfWork)
      }

      const response = await fetch('/api/drydock-requests', {
        method: 'POST',
        body: submitFormData,
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Drydock request submitted:', result)
        setShowRequestForm(false)
        // Reset form
        setForm({
          vesselId: '',
          companyName: '',
          imoNumber: '',
          vesselName: '',
          flag: '',
          shipType: '',
          priorityLevel: 'Normal',
          servicesNeeded: [],
          scopeOfWork: null,
          vesselImageUrl: ''
        })
        setServiceAreas({})
        // Refresh the drydock requests table
        await fetchDrydockRequests()
        // Show success toast
        toast({
          title: "Success",
          description: "Drydock request submitted successfully!",
          variant: "success"
        })
      } else {
        const errorData = await response.json()
        console.error('Failed to submit drydock request:', errorData)
        toast({
          title: "Error",
          description: errorData.error || "Failed to submit drydock request. Please try again.",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error submitting drydock request:', error)
      toast({
        title: "Error",
        description: "An error occurred while submitting the request. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const fetchShipyardsWithBids = async (drydockRequestId: string) => {
    try {
      setLoadingShipyards(true)
      const response = await fetch(`/api/shipowner/shipyards-with-bids?drydockRequestId=${drydockRequestId}`)
      if (response.ok) {
        const data = await response.json()
        setShipyardsWithBids(data.shipyards || [])
        
        // Check which bids are already booked by this user
        if (user?.id) {
          await checkBookedBids(drydockRequestId, user.id)
        }
      } else {
        console.error('Failed to fetch shipyards with bids')
        toast({
          title: "Error",
          description: "Failed to load shipyards. Please try again.",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error fetching shipyards with bids:', error)
      toast({
        title: "Error",
        description: "Error loading shipyards. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoadingShipyards(false)
    }
  }

  const checkBookedBids = async (drydockRequestId: string, userId: string) => {
    try {
      const response = await fetch(`/api/shipowner/drydock-bookings?drydockRequestId=${drydockRequestId}&userId=${userId}`)
      if (response.ok) {
        const data = await response.json()
        const bookings = data.bookings || []
        
        // Separate active bookings from cancelled ones
        const activeBookingIds = bookings
          .filter((booking: { status: string }) => booking.status !== 'CANCELLED')
          .map((booking: { drydockBidId: string }) => booking.drydockBidId as string)
        
        const cancelledBookingIds = bookings
          .filter((booking: { status: string }) => booking.status === 'CANCELLED')
          .map((booking: { drydockBidId: string }) => booking.drydockBidId as string)
        
        setBookedBidIds(new Set<string>(activeBookingIds))
        setCancelledBidIds(new Set<string>(cancelledBookingIds))
      }
    } catch (error) {
      console.error('Error checking booked bids:', error)
    }
  }




  const handleViewBidInformation = (shipyard: {
    bidId: string;
    drydockRequestId: string;
    shipyardUserId: string;
    shipyardName: string;
    shipyardAddress: string;
    shipyardContactNumber: string;
    shipyardContactPerson: string;
    shipyardBusinessReg: string;
    shipyardLogoUrl: string;
    certificateBuilder: string;
    certificateRepair: string;
    certificateOther: string;
    bidCertificateUrl: string;
    servicesOffered: Record<string, unknown>;
    serviceCalculations: Record<string, unknown>;
    totalBid: number;
    totalDays: number;
    parallelDays: number;
    sequentialDays: number;
    bidStatus: string;
    bidDate: string;
  }) => {
    setSelectedBid(shipyard)
    setIsFromBookedView(false)
    setOpenBidDialog(true)
  }

  const handleCloseBidDialog = () => {
    setOpenBidDialog(false)
  }

  const handleBookingConfirmation = () => {
    setShowBookingConfirmation(true)
  }

  const handleConfirmBooking = async () => {
    if (!selectedBid || !user?.id) return
    
    setIsBookingLoading(true)
    try {
      const response = await fetch('/api/shipowner/drydock-bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          drydockRequestId: selectedBid.drydockRequestId,
          drydockBidId: selectedBid.bidId,
          userId: user.id,
          shipyardUserId: selectedBid.shipyardUserId,
          notes: `Booking request for ${selectedBid.shipyardName}`
        })
      })

      if (response.ok) {
        const data = await response.json()
        setShowBookingConfirmation(false)
        handleCloseBidDialog()
        
        // Update booked bids to include the new booking and remove from cancelled if it was there
        if (selectedBid?.bidId) {
          setBookedBidIds(prev => new Set([...prev, selectedBid.bidId]))
          setCancelledBidIds(prev => {
            const newSet = new Set(prev)
            newSet.delete(selectedBid.bidId)
            return newSet
          })
        }
        
        toast({
          title: "Booking Successful",
          description: `Your booking request has been sent to ${selectedBid.shipyardName}. Status: ${data.booking.status}`,
          variant: "success"
        })
      } else {
        const errorData = await response.json()
        toast({
          title: "Booking Failed",
          description: errorData.error || "Failed to send booking request. Please try again.",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error creating booking:', error)
      toast({
        title: "Booking Failed",
        description: "An error occurred while sending the booking request. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsBookingLoading(false)
    }
  }

  const fetchBookedShipyards = async (drydockRequestId: string) => {
    if (!user?.id) return []
    
    setLoadingBookedShipyards(true)
    try {
      const response = await fetch(`/api/shipowner/drydock-bookings?drydockRequestId=${drydockRequestId}&userId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        const bookings = data.bookings || []
        setBookedShipyards(bookings)
        return bookings
      } else {
        console.error('Failed to fetch booked shipyards')
        setBookedShipyards([])
        return []
      }
    } catch (error) {
      console.error('Error fetching booked shipyards:', error)
      setBookedShipyards([])
      return []
    } finally {
      setLoadingBookedShipyards(false)
    }
  }

  const handleViewBookedShipyards = () => {
    if (!selectedRequest?.id) return
    
    // Close browse shipyards dialog first
    setShowBrowseShipyard(false)
    
    // Fetch booked shipyards and open dialog
    fetchBookedShipyards(selectedRequest.id)
    setOpenBookedShipyardsDialog(true)
  }

  const handleCloseBookedShipyardsDialog = () => {
    setOpenBookedShipyardsDialog(false)
    setBookedShipyards([])
    // Reopen browse shipyards dialog
    setShowBrowseShipyard(true)
  }

  const handleCancelBooking = (booking: {
    id: string;
    drydockBidId: string;
    status: string;
  }) => {
    setBookingToCancel(booking)
    setShowCancelConfirmation(true)
  }

  const handleConfirmCancelBooking = async () => {
    if (!bookingToCancel) return
    
    try {
      const response = await fetch(`/api/shipowner/drydock-bookings/${bookingToCancel.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Update the cancelled bids to include the cancelled booking
        if (bookingToCancel?.drydockBidId) {
          setCancelledBidIds(prev => new Set([...prev, bookingToCancel.drydockBidId]))
          setBookedBidIds(prev => {
            const newSet = new Set(prev)
            newSet.delete(bookingToCancel.drydockBidId)
            return newSet
          })
        }
        
        // Refresh the booked shipyards list
        if (selectedRequest?.id) {
          fetchBookedShipyards(selectedRequest.id)
          // Also refresh the booked bids for the shipyard cards
          if (user?.id) {
            checkBookedBids(selectedRequest.id, user.id)
          }
        }
        setShowCancelConfirmation(false)
        setBookingToCancel(null)
        toast({
          title: "Booking Cancelled",
          description: "Your booking has been cancelled successfully.",
          variant: "success"
        })
      } else {
        const errorData = await response.json()
        toast({
          title: "Cancellation Failed",
          description: errorData.error || "Failed to cancel booking. Please try again.",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error cancelling booking:', error)
      toast({
        title: "Cancellation Failed",
        description: "An error occurred while cancelling the booking. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleViewBidInformationFromBooking = (booking: {
    id: string;
    drydockRequestId: string;
    drydockBidId: string;
    userId: string;
    shipyardUserId: string;
    status: string;
    bookingDate: string;
    notes: string | null;
    vesselName: string;
    imoNumber: string;
    requestStatus: string;
    shipyardName: string;
    totalBid: number;
    totalDays: number;
    parallelDays: number;
    sequentialDays: number;
    bidStatus: string;
    servicesOffered: Record<string, unknown>;
    serviceCalculations: Record<string, unknown>;
    bidCertificateUrl: string | null;
    bidDate: string;
    shipyardContactName: string;
    shipyardContactEmail: string;
    shipyardContactNumber: string;
    shipyardAddress: string;
    shipyardContactPerson: string;
    shipyardBusinessReg: string;
    shipyardLogoUrl: string | null;
    certificateBuilder: string | null;
    certificateRepair: string | null;
    certificateOther: string | null;
  }) => {
    // Convert booking data to the format expected by the bid dialog
    const bidData = {
      bidId: booking.drydockBidId,
      drydockRequestId: booking.drydockRequestId,
      shipyardUserId: booking.shipyardUserId,
      shipyardName: booking.shipyardName,
      shipyardAddress: booking.shipyardAddress || '',
      shipyardContactNumber: booking.shipyardContactNumber || '',
      shipyardContactPerson: booking.shipyardContactPerson || '',
      shipyardBusinessReg: booking.shipyardBusinessReg || '',
      shipyardLogoUrl: booking.shipyardLogoUrl || '',
      certificateBuilder: booking.certificateBuilder || '',
      certificateRepair: booking.certificateRepair || '',
      certificateOther: booking.certificateOther || '',
      bidCertificateUrl: booking.bidCertificateUrl || '',
      servicesOffered: booking.servicesOffered || [],
      serviceCalculations: booking.serviceCalculations || {},
      totalBid: booking.totalBid || 0,
      totalDays: booking.totalDays || 0,
      parallelDays: booking.parallelDays || 0,
      sequentialDays: booking.sequentialDays || 0,
      bidStatus: booking.bidStatus || 'PENDING',
      bidDate: booking.bidDate || new Date().toISOString()
    }
    
    setSelectedBid(bidData)
    setIsFromBookedView(true)
    setOpenBidDialog(true)
  }

  const handleBookAgain = (shipyard: {
    bidId: string;
    drydockRequestId: string;
    shipyardUserId: string;
    shipyardName: string;
    shipyardAddress: string;
    shipyardContactNumber: string;
    shipyardContactPerson: string;
    shipyardBusinessReg: string;
    shipyardLogoUrl: string;
    certificateBuilder: string;
    certificateRepair: string;
    certificateOther: string;
    bidCertificateUrl: string;
    servicesOffered: Record<string, unknown>;
    serviceCalculations: Record<string, unknown>;
    totalBid: number;
    totalDays: number;
    parallelDays: number;
    sequentialDays: number;
    bidStatus: string;
    bidDate: string;
  }) => {
    // Convert shipyard data to the format expected by the bid dialog
    const bidData = {
      bidId: shipyard.bidId,
      drydockRequestId: shipyard.drydockRequestId,
      shipyardUserId: shipyard.shipyardUserId,
      shipyardName: shipyard.shipyardName,
      shipyardAddress: shipyard.shipyardAddress || '',
      shipyardContactNumber: shipyard.shipyardContactNumber || '',
      shipyardContactPerson: shipyard.shipyardContactPerson || '',
      shipyardBusinessReg: shipyard.shipyardBusinessReg || '',
      shipyardLogoUrl: shipyard.shipyardLogoUrl || '',
      certificateBuilder: shipyard.certificateBuilder || '',
      certificateRepair: shipyard.certificateRepair || '',
      certificateOther: shipyard.certificateOther || '',
      bidCertificateUrl: shipyard.bidCertificateUrl || '',
      servicesOffered: shipyard.servicesOffered || [],
      serviceCalculations: shipyard.serviceCalculations || {},
      totalBid: shipyard.totalBid || 0,
      totalDays: shipyard.totalDays || 0,
      parallelDays: shipyard.parallelDays || 0,
      sequentialDays: shipyard.sequentialDays || 0,
      bidStatus: shipyard.bidStatus || 'PENDING',
      bidDate: shipyard.bidDate || new Date().toISOString()
    }
    
    setSelectedBid(bidData)
    setIsFromBookedView(false)
    setOpenBidDialog(true)
  }

  // Filter shipyards based on search term
  const filteredShipyards = shipyardsWithBids.filter(shipyard => {
    const searchLower = shipyardSearchTerm.toLowerCase()
    return (
      shipyard.shipyardName.toLowerCase().includes(searchLower) ||
      shipyard.shipyardAddress.toLowerCase().includes(searchLower) ||
      (shipyard.servicesOffered && Array.isArray(shipyard.servicesOffered) && 
        shipyard.servicesOffered.some((service: Record<string, unknown>) => 
          (typeof service === 'object' ? (service.name as string) : (service as string)).toLowerCase().includes(searchLower)
        )
      )
    )
  })







  return (
    <SidebarProvider>
      <ShipownerSidebar />
      <SidebarInset>
        <AppHeader 
          breadcrumbs={[
            { label: "Dashboard", href: "/pages/shipowner" },
            { label: "Drydock Management", isCurrentPage: true }
          ]} 
        />
        <div className="px-5 pt-0 mt-0">
          <h1 className="text-lg md:text-xl font-bold text-[#134686]">Drydock Management</h1>
          <p className="text-sm text-gray-500 mt-1">Plan and track drydock schedules and tasks.</p>
          <Button 
            className="mt-4 bg-green-600 hover:bg-green-700/90 text-white cursor-pointer"
            onClick={() => setShowRequestForm(true)}
          >
            Request Drydock
          </Button>
        </div>

        {/* Drydock Requests Table */}
        <div className="mt-0">
         
          
          {/* Search and Filter Section */}
          <div className="flex flex-col sm:flex-row gap-4 mb-0 pl-6 pr-6 pt-3 pb-5 bg-white rounded-lg">
            <div className="flex-1 flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Search:</label>
              <Input
                type="text"
                placeholder="Search by vessel name, IMO number, or company name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Filter by status:</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40 bg-white border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300">
                    <SelectItem value="all" className="bg-white hover:bg-gray-50">All statuses</SelectItem>
                    <SelectItem value="PENDING" className="bg-white hover:bg-gray-50">Pending</SelectItem>
                    <SelectItem value="APPROVED" className="bg-white hover:bg-gray-50">Approved</SelectItem>
                    <SelectItem value="IN_PROGRESS" className="bg-white hover:bg-gray-50">In Progress</SelectItem>
                    <SelectItem value="COMPLETED" className="bg-white hover:bg-gray-50">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Filter by priority:</label>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-40 bg-white border-gray-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-gray-300">
                    <SelectItem value="all" className="bg-white hover:bg-gray-50">All priorities</SelectItem>
                    <SelectItem value="Normal" className="bg-white hover:bg-gray-50">Normal</SelectItem>
                    <SelectItem value="Emergency" className="bg-white hover:bg-gray-50">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          {/* Table Container */}
          <div className="px-6">
            <div className="border border-gray-300 rounded-lg overflow-hidden w-full mb-3">
            <div className="overflow-x-auto w-full">
              <Table className="w-full min-w-[800px]">
                <TableHeader>
                  <TableRow className="align-middle h-3 bg-gray-50">
                    <TableHead className="whitespace-nowrap py-3 h-11 w-[150px] px-4">Vessel Name</TableHead>
                    <TableHead className="whitespace-nowrap py-3 h-11 w-[120px] px-4">IMO Number</TableHead>
                    <TableHead className="whitespace-nowrap py-3 h-11 w-[200px] px-4">Services Needed</TableHead>
                    <TableHead className="whitespace-nowrap py-3 h-11 w-[100px] px-4">Priority</TableHead>
                    <TableHead className="whitespace-nowrap py-3 h-11 w-[120px] px-4">Status</TableHead>
                    <TableHead className="whitespace-nowrap py-3 h-11 w-[100px] px-4">Request Date</TableHead>
                    <TableHead className="whitespace-nowrap py-3 h-11 w-[100px] px-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingRequests ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        <p className="text-gray-600">Loading requests...</p>
                      </TableCell>
                    </TableRow>
                  ) : currentRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground px-4">
       
                        <p className="text-gray-600">No drydock requests found</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentRequests.map((request) => (
                      <TableRow key={request.id} className="align-middle h-6">
                        <TableCell className="whitespace-nowrap py-3 px-4">
                          <span className="font-medium text-gray">{request.vesselName || 'N/A'}</span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-3 px-4">
                          <span className="text-sm text-gray-600">{request.imoNumber || 'N/A'}</span>
                        </TableCell>
                        <TableCell className="py-3 px-4">
                          <span className="text-sm text-gray-600">
                            {request.servicesNeeded && Array.isArray(request.servicesNeeded) 
                              ? request.servicesNeeded.map((service: { name: string } | string) => typeof service === 'object' ? service.name : service).join(', ')
                              : 'N/A'
                            }
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-3 px-4">
                          <Badge className={request.priorityLevel === 'EMERGENCY' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}>
                            {request.priorityLevel === 'EMERGENCY' ? 'Emergency' : 
                             request.priorityLevel === 'NORMAL' ? 'Normal' : 
                             request.priorityLevel || 'Normal'}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-3 px-4">
                          <Badge className={getStatusColor(request.status)}>
                            {request.status === 'PENDING' ? 'Pending' : 
                             request.status === 'APPROVED' ? 'Approved' :
                             request.status === 'REJECTED' ? 'Rejected' :
                             request.status === 'IN_PROGRESS' ? 'In Progress' :
                             request.status === 'COMPLETED' ? 'Completed' : request.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-3 px-4">
                          <span className="text-sm text-gray">
                            {new Date(request.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-3 px-4">
                          {request.status === 'COMPLETED' ? (
                            <span className="text-sm text-gray-600">Completed</span>
                          ) : request.status === 'IN_PROGRESS' ? (
                            (() => {
                              const authorityRequestWithCert = getAuthorityRequestWithCert(request.id)
                              if (authorityRequestWithCert?.authorityCertificate) {
                                // Show "View Authority Cert" button if certificate exists
                                return (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-blue-600 cursor-pointer text-white border-blue-600 hover:bg-blue-700 hover:text-white px-3 py-1.5"
                                    onClick={async () => {
                                      if (authorityRequestWithCert.authorityCertificate) {
                                        try {
                                          // Get signed URL for the certificate
                                          const response = await fetch(`/api/view-certificate?url=${encodeURIComponent(authorityRequestWithCert.authorityCertificate)}`)
                                          
                                          if (response.ok) {
                                            const data = await response.json()
                                            
                                            if (data.signedUrl) {
                                              // Extract filename from URL or use default
                                              let filename = 'Authority_Certificate.pdf'
                                              try {
                                                const urlParts = authorityRequestWithCert.authorityCertificate.split('/')
                                                const lastPart = urlParts[urlParts.length - 1]
                                                if (lastPart && lastPart.includes('.')) {
                                                  const fileNamePart = lastPart.split('?')[0]
                                                  filename = fileNamePart || filename
                                                }
                                              } catch (e) {
                                                // Use default filename
                                              }

                                              // Open PDF in new tab
                                              window.open(data.signedUrl, '_blank')
                                            } else {
                                              console.error('No signed URL in response')
                                              toast({
                                                title: "Error",
                                                description: "Failed to generate certificate URL. Please try again.",
                                                variant: "destructive"
                                              })
                                            }
                                          } else {
                                            const errorText = await response.text().catch(() => 'Unknown error')
                                            console.error('Failed to generate signed URL:', response.status, errorText)
                                            toast({
                                              title: "Error",
                                              description: "Failed to load certificate. Please try again.",
                                              variant: "destructive"
                                            })
                                          }
                                        } catch (error) {
                                          console.error('Error opening certificate:', error)
                                          toast({
                                            title: "Error",
                                            description: "An error occurred while opening the certificate.",
                                            variant: "destructive"
                                          })
                                        }
                                      }
                                    }}
                                  >
                                    View Authority Cert
                                  </Button>
                                )
                              } else {
                                // Show "Request Authority Cert" button if no certificate exists
                                return (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-green-600 cursor-pointer text-white border-green-600 hover:bg-green-700 hover:text-white px-3 py-1.5"
                                    onClick={async () => {
                                      // Check if authority request already exists
                                      if (hasAuthorityRequest(request.id)) {
                                        // Show the table dialog if authority request exists
                                        setShowAuthorityApprovalDialog(true)
                                      } else {
                                        // Load booked shipyards for this specific request
                                        const bookings = await fetchBookedShipyards(request.id)
                                        
                                        // Find the booking ID for this drydock request
                                        const booking = bookings.find((booking: BookedShipyard) => booking.drydockRequestId === request.id)
                                        const requestWithBooking = {
                                          ...request,
                                          bookingId: booking?.id || ''
                                        }
                                        
                                        // Show create dialog if no authority request exists
                                        setSelectedDrydockRequest(requestWithBooking)
                                        setShowCreateAuthorityDialog(true)
                                      }
                                    }}
                                  >
                                    Request Authority Cert
                                  </Button>
                                )
                              }
                            })()
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-[#134686] cursor-pointer text-white border-[#134686] hover:bg-[#134686]/90 hover:text-white px-3 py-1.5"
                              onClick={() => {
                                setSelectedRequest(request)
                                setShowBrowseShipyard(true)
                                fetchShipyardsWithBids(request.id)
                              }}
                            >
                              Browse Bidders
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          </div>

          {/* Pagination Controls */}
          {!loadingRequests && filteredRequests.length > 0 && (
            <div className="flex flex-wrap items-center justify-between text-sm px-6">
              <div className='text-sm text-gray-500'>
                {filteredRequests.length === 0 ? '0' : `${startIndex + 1} - ${Math.min(endIndex, filteredRequests.length)}`} of {filteredRequests.length} row(s)
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
                  className="h-8 w-8 flex cursor-pointer items-center justify-center rounded hover:bg-gray-100 disabled:opacity-50"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                  type="button"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2">Page {currentPage} of {totalPages}</span>
                <button
                  className="h-8 w-8 flex cursor-pointer items-center justify-center rounded hover:bg-gray-100 disabled:opacity-50"
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

        {/* Request Drydock Modal */}
        <Dialog open={showRequestForm} onOpenChange={setShowRequestForm}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white border border-gray-200">
            <DialogHeader className="bg-white">
              <DialogTitle className="bg-white font-bold text-[#134686]">Drydock Request</DialogTitle>
              <DialogDescription className="bg-white">
                Click to select vessel and fill in the drydock request details.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 bg-white">
              {/* Vessel Selection Section */}
              <div className="space-y-2 bg-white">
                <div className="flex items-center justify-between">
                  <Label htmlFor="vesselSelect">Select Vessel</Label>
                  {vessels.length > 0 && (
                    <span className="text-xs text-gray-500">
                      {vessels.length} available
                    </span>
                  )}
                </div>
                {loadingVessels ? (
                  <div className="text-center py-8 text-gray-500">
                    <Ship className="h-12 w-12 mx-auto mb-4 text-gray-300 animate-pulse" />
                    <p>Loading vessels...</p>
                  </div>
                ) : vessels.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    
                    <p>No vessels found. Please add vessels first.</p>
                  </div>
                ) : (
                  <Select
                    value={form.vesselId || ''}
                    onValueChange={(value) => {
                      const vessel = vessels.find(v => v.id.toString() === value);
                      if (vessel) {
                        handleVesselSelect(vessel);
                      }
                    }}
                  >
                    <SelectTrigger className='cursor-pointer bg-white border-gray-300'>
                      <SelectValue placeholder="Choose a vessel" />
                    </SelectTrigger>
                    <SelectContent className="cursor-pointer bg-white border-gray-300">
                      {vessels.map((vessel) => {
                        const hasRequest = false; // Mock function - in real app, check if vessel already has a request
                        return (
                          <SelectItem
                            key={vessel.id}
                            value={vessel.id.toString()}
                            disabled={hasRequest}
                            className={`bg-white hover:bg-gray-50 ${hasRequest ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span>{vessel.name} - IMO: {vessel.imoNumber}</span>
                              {hasRequest && (
                                <span className="ml-2 text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded-full font-medium">
                                  Already Requested
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}
                {/* Helpful message about vessel requests */}
                {vessels.length > 0 && vessels.every(() => false) && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-700">
                      All your vessels already have drydock requests. You can view their status in the table above.
                    </p>
                  </div>
                )}
              </div>

              {/* Drydock Request Form (only if vessel selected) */}
              {form.vesselId && (
                <form className="space-y-6 mt-6 bg-white">
                  {/* Form Fields - 2 inputs per row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company Name</Label>
                      <Input
                        id="companyName"
                        value={form.companyName}
                        onChange={(e) => setForm(prev => ({ ...prev, companyName: e.target.value }))}
                        placeholder="Company name"
                      />
                      {formErrors.companyName && <p className="text-red-500 text-xs mt-1">{formErrors.companyName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="imoNumber">IMO Number</Label>
                      <Input
                        id="imoNumber"
                        value={form.imoNumber}
                        onChange={(e) => setForm(prev => ({ ...prev, imoNumber: e.target.value }))}
                        placeholder="IMO number"
                      />
                      {formErrors.imoNumber && <p className="text-red-500 text-xs mt-1">{formErrors.imoNumber}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vesselName">Vessel Name</Label>
                      <Input
                        id="vesselName"
                        value={form.vesselName}
                        onChange={(e) => setForm(prev => ({ ...prev, vesselName: e.target.value }))}
                        placeholder="Vessel name"
                      />
                      {formErrors.vesselName && <p className="text-red-500 text-xs mt-1">{formErrors.vesselName}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="flag">Flag</Label>
                      <Input
                        id="flag"
                        value={form.flag}
                        onChange={(e) => setForm(prev => ({ ...prev, flag: e.target.value }))}
                        placeholder="Flag"
                      />
                      {formErrors.flag && <p className="text-red-500 text-xs mt-1">{formErrors.flag}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shipType">Type of Ship</Label>
                      <Input
                        id="shipType"
                        value={form.shipType}
                        onChange={(e) => setForm(prev => ({ ...prev, shipType: e.target.value }))}
                        placeholder="Ship type"
                      />
                      {formErrors.shipType && <p className="text-red-500 text-xs mt-1">{formErrors.shipType}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priorityLevel">Priority Level</Label>
                      <Select
                        value={form.priorityLevel}
                        onValueChange={(value: 'Normal' | 'Emergency') =>
                          setForm(prev => ({ ...prev, priorityLevel: value }))
                        }
                      >
                        <SelectTrigger className="bg-white border-gray-300">
                          <SelectValue placeholder="Select priority level" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-gray-300">
                          <SelectItem value="Normal" className="bg-white hover:bg-gray-50">Normal</SelectItem>
                          <SelectItem value="Emergency" className="bg-white hover:bg-gray-50">Emergency</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* Services Needed */}
                  <div className="space-y-3">
                    <Label>Services Needed</Label>
                    {loadingServices ? (
                      <div className="text-center py-4 text-gray-500">
                        <p>Loading services...</p>
                      </div>
                    ) : userServices.length === 0 ? (
                      <div className="text-center py-4 text-gray-500">
                        <p>No services available.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {userServices.map((service) => (
                          <div key={service.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                            <div className="flex items-center">
                              <Checkbox
                                id={service.id}
                                checked={form.servicesNeeded.includes(service.name)}
                                onCheckedChange={() => handleServiceToggle(service.name)}
                                className="mr-3"
                              />
                              <div className="flex-1">
                                <Label htmlFor={service.id} className="text-sm font-medium cursor-pointer select-none">
                                  {service.name}
                                </Label>
                                <div className="text-xs text-gray-500 mt-1">
                                  Price: ₱{parseFloat(service.price).toLocaleString('en-PH')} per {service.squareMeters} m²
                                </div>
                              </div>
                            </div>
                            {form.servicesNeeded.includes(service.name) && (
                              <div className="mt-3 pl-6">
                                <Label htmlFor={`area-${service.id}`} className="text-xs text-gray-600">
                                  How many square meters?
                                </Label>
                                <Input
                                  id={`area-${service.id}`}
                                  className="mt-1"
                                  type="number"
                                  min="0"
                                  step="any"
                                  placeholder="Enter square meters"
                                  value={serviceAreas[service.name] || ''}
                                  onChange={e => handleServiceAreaChange(service.name, e.target.value)}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {formErrors.servicesNeeded && <p className="text-red-500 text-xs mt-1">{formErrors.servicesNeeded}</p>}
                  </div>
                  {/* File Upload */}
                  <div className="space-y-2 cursor-pointer">
                    <Label htmlFor="scopeOfWork">Initial Scope of Works</Label>
                    <Input
                      id="scopeOfWork"
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileChange}
                      className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {form.scopeOfWork && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-700">{form.scopeOfWork.name}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="px-2 py-0 h-8 text-xs"
                          onClick={() => setForm(prev => ({ ...prev, scopeOfWork: null }))}
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                    {formErrors.file && <p className="text-red-500 text-xs mt-1">{formErrors.file}</p>}
                  </div>
                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 pt-4">
                    <Button
                      className="cursor-pointer"
                      type="button"
                      variant="outline"
                      onClick={() => setShowRequestForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className='cursor-pointer text-white bg-[#134686] hover:bg-[#134686]/90'
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleSubmitDrydockRequest}
                    >
                      {isSubmitting ? 'Submitting...' : 'Request Drydock'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Browse Shipyard Dialog */}
        <Dialog open={showBrowseShipyard} onOpenChange={setShowBrowseShipyard}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white border border-gray-200">
            <DialogHeader className="bg-white">
              <DialogTitle className="bg-white font-bold text-[#134686] text-xl">Browse Bidders</DialogTitle>
              <DialogDescription className="bg-white text-gray-600">
                Select a recommended bidder to book your drydock services for {selectedRequest?.vesselName || 'your vessel'}. Only recommended bidders are shown.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 bg-white">
                {/* Shipyard Selection Content */}
                <div className="space-y-4">
                  {/* Search Input */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Search:</label>
                      <Input
                        type="text"
                        placeholder="Search by shipyard name, address, or services..."
                        value={shipyardSearchTerm}
                        onChange={(e) => setShipyardSearchTerm(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleViewBookedShipyards}
                        className="whitespace-nowrap bg-green-600 hover:bg-green-700 text-white border-green-600 hover:border-green-700"
                      >
                        View Booked Shipyard
                      </Button>
                    </div>
                    {shipyardSearchTerm && shipyardsWithBids.length > 0 && (
                      <p className="text-sm text-gray-500">
                        Showing {filteredShipyards.length} of {shipyardsWithBids.length} recommended shipyards
                      </p>
                    )}
                    {!shipyardSearchTerm && shipyardsWithBids.length > 0 && (
                      <p className="text-sm text-gray-500">
                        {shipyardsWithBids.length} recommended {shipyardsWithBids.length === 1 ? 'bidder' : 'bidders'} available
                      </p>
                    )}
                  </div>
                  
                  {/* Shipyard List */}
                {loadingShipyards ? (
                  <div className="border border-gray-200 rounded-lg p-6 text-center">
                    
                    <p className="text-gray-500">Loading shipyards...</p>
                  </div>
                ) : shipyardsWithBids.length === 0 ? (
                  <div className="border border-gray-200 rounded-lg p-6 text-center">
                   
                    <p className="text-gray-500">No recommended bidders available yet</p>
                    <p className="text-sm text-gray-400 mt-2">Only recommended bidders are shown. Check back later when bidders have been recommended.</p>
                  </div>
                ) : filteredShipyards.length === 0 ? (
                  <div className="border border-gray-200 rounded-lg p-6 text-center">
                  
                    <p className="text-gray-500">No shipyards match your search</p>
                    <p className="text-sm text-gray-400 mt-2">Try adjusting your search terms</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredShipyards.map((shipyard, index) => (
                      <div key={shipyard.bidId} className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm min-h-[280px]">
                        <div className="flex items-start gap-4 mb-4">
                          {/* Shipyard Logo */}
                          <div className="flex-shrink-0">
                            <ShipyardLogo 
                              logoUrl={shipyard.shipyardLogoUrl} 
                              shipyardName={shipyard.shipyardName}
                            />
                          </div>
                          
                          {/* Shipyard Info */}
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Shipyard Name</p>
                                <h3 className="font-bold text-base text-gray-900 truncate">{shipyard.shipyardName}</h3>
                              </div>
                              <div className="text-right">
                                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                                  <span className="text-sm font-medium text-gray-600">{index + 1}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Bid Details */}
                        <div className="space-y-3 mb-4">
                          <div className="flex justify-between items-center py-1">
                            <span className="text-sm text-gray-600">Total Bid:</span>
                            <span className="text-base font-bold text-green-600">₱{shipyard.totalBid.toLocaleString('en-PH')}</span>
                          </div>
                          
                          <div className="flex justify-between items-center py-1">
                            <span className="text-sm text-gray-600">Duration:</span>
                            <span className="text-sm text-gray-900 font-medium">{shipyard.totalDays} days</span>
                          </div>
                          
                          <div className="flex justify-between items-start py-1">
                            <span className="text-sm text-gray-600">Services Offered:</span>
                            <span className="text-sm text-gray-900 text-right max-w-[140px] leading-relaxed">
                              {shipyard.servicesOffered && Array.isArray(shipyard.servicesOffered) 
                                ? shipyard.servicesOffered.map((service: Record<string, unknown>) => service.name || service).join(', ')
                                : 'N/A'
                              }
                            </span>
                          </div>
                          
                          <div className="flex justify-between items-center py-1">
                            <span className="text-sm text-gray-600">Bid Date:</span>
                            <span className="text-sm text-gray-900 font-medium">
                              {new Date(shipyard.bidDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                        
                        {/* Booking Status Display */}
                        {bookedBidIds.has(shipyard.bidId) ? (
                          <div className="w-full bg-green-100 border border-green-200 text-green-800 py-2 rounded-lg text-sm font-medium text-center">
                            Already Booked
                          </div>
                        ) : cancelledBidIds.has(shipyard.bidId) ? (
                          <div className="space-y-2">
                            <div className="w-full bg-red-100 border border-red-200 text-red-800 py-2 rounded-lg text-sm font-medium text-center">
                              Cancelled Booking
                            </div>
                            <Button
                              className="w-full bg-[#134686] hover:bg-[#134686]/90 text-white py-2 rounded-lg text-sm font-medium"
                              onClick={() => handleBookAgain(shipyard)}
                            >
                              Book Again
                            </Button>
                          </div>
                        ) : (
                          <Button
                            className="w-full bg-[#134686] hover:bg-[#134686]/90 text-white py-2 rounded-lg text-sm font-medium"
                            onClick={() => handleViewBidInformation(shipyard)}
                          >
                            View Full Information
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
             
            </div>
          </DialogContent>
        </Dialog>


        {/* Bid Information Dialog */}
        <Dialog open={openBidDialog} onOpenChange={setOpenBidDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#134686]">
                Drydock Bid Information
              </DialogTitle>
              <DialogDescription>
                Detailed bid information from {selectedBid?.shipyardName}
              </DialogDescription>
            </DialogHeader>
            
            {selectedBid && (
              <div className="space-y-6">
                {/* Shipyard Header */}
                <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0">
                    <ShipyardLogo 
                      logoUrl={selectedBid.shipyardLogoUrl} 
                      shipyardName={selectedBid.shipyardName}
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900">{selectedBid.shipyardName}</h3>
                    <p className="text-sm text-gray-600">{selectedBid.shipyardAddress}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">₱{selectedBid.totalBid.toLocaleString('en-PH')}</div>
                    <div className="text-sm text-gray-500">Total Bid Amount</div>
                  </div>
                </div>

                {/* Bid Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h4 className="text-md font-semibold text-gray-900 mb-3 border-b pb-2">
                        Bid Summary
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Total Bid Amount:</span>
                          <span className="text-sm font-semibold text-green-600">₱{selectedBid.totalBid.toLocaleString('en-PH')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Total Duration:</span>
                          <span className="text-sm font-semibold">{selectedBid.totalDays} days</span>
                        </div>
                       
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Bid Status:</span>
                          <Badge className={selectedBid.bidStatus === 'RECOMMENDED' ? 'bg-green-100 text-green-800' : 
                                         selectedBid.bidStatus === 'SUBMITTED' ? 'bg-blue-100 text-blue-800' :
                                         selectedBid.bidStatus === 'ACCEPTED' ? 'bg-green-100 text-green-800' :
                                         selectedBid.bidStatus === 'REJECTED' ? 'bg-red-100 text-red-800' :
                                         'bg-gray-100 text-gray-800'}>
                            {selectedBid.bidStatus}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Bid Date:</span>
                          <span className="text-sm font-semibold">
                            {new Date(selectedBid.bidDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Drydock Bid Quotation */}
                    {selectedBid.bidCertificateUrl && (
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 className="text-md font-semibold text-gray-900 mb-3 border-b pb-2">
                          Drydock Bid Quotation
                        </h4>
                        <div className="flex gap-2">
                          <Input 
                            value="Bid Certificate Available" 
                            readOnly 
                            className="flex-1 text-xs"
                          />
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={async () => {
                              try {
                                const response = await fetch(`/api/signed-url?url=${encodeURIComponent(selectedBid.bidCertificateUrl)}`)
                                const data = await response.json()
                                if (data.signedUrl) {
                                  window.open(data.signedUrl, '_blank')
                                }
                              } catch (error) {
                                console.error('Error accessing certificate:', error)
                              }
                            }}
                            className="px-2 py-1 text-xs bg-[#134686] text-white border-[#134686] hover:bg-[#0f3a6e]"
                          >
                            View
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h4 className="text-md font-semibold text-gray-900 mb-3 border-b pb-2">
                        Services Offered
                      </h4>
                      <div className="space-y-2">
                        {selectedBid.servicesOffered && Array.isArray(selectedBid.servicesOffered) ? (
                          selectedBid.servicesOffered.map((service: Record<string, unknown>, index: number) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <span className="text-sm text-gray-700">
                                {typeof service === 'object' ? (service.name as string) : (service as string)}
                              </span>
                              {typeof service === 'object' && (service.area as string) && (
                                <span className="text-xs text-gray-500">
                                  {service.area as string} m²
                                </span>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500">No services specified</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h4 className="text-md font-semibold text-gray-900 mb-3 border-b pb-2">
                        Shipyard Information
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-gray-500">Location</label>
                          <p className="text-sm font-medium">{selectedBid.shipyardAddress || 'Not provided'}</p>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Contact Person</label>
                          <p className="text-sm font-medium">{selectedBid.shipyardContactPerson || 'Not provided'}</p>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Contact Number</label>
                          <p className="text-sm font-medium">{selectedBid.shipyardContactNumber || 'Not provided'}</p>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Business Registration</label>
                          <p className="text-sm font-medium">{selectedBid.shipyardBusinessReg || 'Not provided'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h4 className="text-md font-semibold text-gray-900 mb-3 border-b pb-2">
                        Certificates
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-gray-500">Builder Certificate</label>
                          <div className="flex gap-2 mt-1">
                            <Input 
                              value={selectedBid.certificateBuilder || 'Not provided'} 
                              readOnly 
                              className="flex-1 text-xs"
                            />
                            {selectedBid.certificateBuilder && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={async () => {
                                  try {
                                    const response = await fetch(`/api/signed-url?url=${encodeURIComponent(selectedBid.certificateBuilder)}`)
                                    const data = await response.json()
                                    if (data.signedUrl) {
                                      window.open(data.signedUrl, '_blank')
                                    }
                                  } catch (error) {
                                    console.error('Error accessing certificate:', error)
                                  }
                                }}
                                className="px-2 py-1 text-xs bg-[#134686] text-white border-[#134686] hover:bg-[#0f3a6e]"
                              >
                                View
                              </Button>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Repair Certificate</label>
                          <div className="flex gap-2 mt-1">
                            <Input 
                              value={selectedBid.certificateRepair || 'Not provided'} 
                              readOnly 
                              className="flex-1 text-xs"
                            />
                            {selectedBid.certificateRepair && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={async () => {
                                  try {
                                    const response = await fetch(`/api/signed-url?url=${encodeURIComponent(selectedBid.certificateRepair)}`)
                                    const data = await response.json()
                                    if (data.signedUrl) {
                                      window.open(data.signedUrl, '_blank')
                                    }
                                  } catch (error) {
                                    console.error('Error accessing certificate:', error)
                                  }
                                }}
                                className="px-2 py-1 text-xs bg-[#134686] text-white border-[#134686] hover:bg-[#0f3a6e]"
                              >
                                View
                              </Button>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">Other Certificates</label>
                          <div className="flex gap-2 mt-1">
                            <Input 
                              value={selectedBid.certificateOther || 'Not provided'} 
                              readOnly 
                              className="flex-1 text-xs"
                            />
                            {selectedBid.certificateOther && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={async () => {
                                  try {
                                    const response = await fetch(`/api/signed-url?url=${encodeURIComponent(selectedBid.certificateOther)}`)
                                    const data = await response.json()
                                    if (data.signedUrl) {
                                      window.open(data.signedUrl, '_blank')
                                    }
                                  } catch (error) {
                                    console.error('Error accessing certificate:', error)
                                  }
                                }}
                                className="px-2 py-1 text-xs bg-[#134686] text-white border-[#134686] hover:bg-[#0f3a6e]"
                              >
                                View
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={handleCloseBidDialog}
              >
                Close
              </Button>
              {!isFromBookedView && (
                <Button 
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleBookingConfirmation}
                >
                  Book Now
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Booking Confirmation Dialog */}
        <Dialog open={showBookingConfirmation} onOpenChange={setShowBookingConfirmation}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm Booking</DialogTitle>
              <DialogDescription>
                Are you sure you want to book this drydock service with {selectedBid?.shipyardName}?
              </DialogDescription>
            </DialogHeader>
           
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setShowBookingConfirmation(false)}
              >
                Cancel
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleConfirmBooking}
                disabled={isBookingLoading}
              >
                {isBookingLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Booking...
                  </div>
                ) : (
                  "Confirm Booking"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel Booking Confirmation Dialog */}
        <Dialog open={showCancelConfirmation} onOpenChange={setShowCancelConfirmation}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm Cancellation</DialogTitle>
              <DialogDescription>
                Are you sure you want to cancel this booking?
              </DialogDescription>
            </DialogHeader>
            
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCancelConfirmation(false)
                  setBookingToCancel(null)
                }}
              >
                Keep Booking
              </Button>
              <Button 
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleConfirmCancelBooking}
              >
                Cancel Booking
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Booked Shipyards Dialog */}
        <Dialog open={openBookedShipyardsDialog} onOpenChange={setOpenBookedShipyardsDialog}>
          <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Booked Shipyards for {selectedRequest?.vesselName || 'Vessel'}</DialogTitle>
              <DialogDescription>
                View and manage your booked shipyards for the {selectedRequest?.vesselName || 'vessel'} drydock request.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {loadingBookedShipyards ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-sm text-gray-500">Loading booked shipyards...</div>
                </div>
              ) : bookedShipyards.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="text-sm text-gray-500 mb-2">No booked shipyards found for {selectedRequest?.vesselName || 'this vessel'}.</div>
                    <div className="text-xs text-gray-400">This vessel has no active bookings at the moment.</div>
                  </div>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead className="font-semibold text-gray-900">Name</TableHead>
                        <TableHead className="font-semibold text-gray-900">Total Bid</TableHead>
                        <TableHead className="font-semibold text-gray-900">Duration</TableHead>
                        <TableHead className="font-semibold text-gray-900">Status</TableHead>
                        <TableHead className="font-semibold text-gray-900">Booking Date</TableHead>
                        <TableHead className="font-semibold text-gray-900">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bookedShipyards.map((booking) => (
                        <TableRow 
                          key={booking.id} 
                          className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50"
                        >
                          <TableCell className="font-medium text-gray-900 py-4">
                            {booking.shipyardName}
                          </TableCell>
                          <TableCell className="py-4">
                            <span className="font-semibold text-green-600">
                              ₱{booking.totalBid?.toLocaleString('en-PH') || 'N/A'}
                            </span>
                          </TableCell>
                          <TableCell className="py-4">
                            <span className="text-gray-700">
                              {booking.totalDays || 'N/A'} days
                            </span>
                          </TableCell>
                          <TableCell className="py-4">
                            <Badge 
                              variant={
                                booking.status === 'PENDING' ? 'secondary' :
                                booking.status === 'CONFIRMED' ? 'default' :
                                booking.status === 'IN_PROGRESS' ? 'default' :
                                booking.status === 'COMPLETED' ? 'default' :
                                'destructive'
                              }
                              className={`font-medium px-3 py-1 rounded-full border ${
                                booking.status === 'PENDING' 
                                  ? 'bg-yellow-100 text-yellow-800 border-yellow-200' 
                                  : booking.status === 'CANCELLED'
                                  ? 'bg-red-100 text-red-800 border-red-200'
                                  : booking.status === 'CONFIRMED'
                                  ? 'bg-blue-100 text-blue-800 border-blue-200'
                                  : booking.status === 'IN_PROGRESS'
                                  ? 'bg-purple-100 text-purple-800 border-purple-200'
                                  : booking.status === 'COMPLETED'
                                  ? 'bg-green-100 text-green-800 border-green-200'
                                  : 'bg-gray-100 text-gray-800 border-gray-200'
                              }`}
                            >
                              {booking.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4">
                            <span className="text-gray-700">
                              {booking.bookingDate ? new Date(booking.bookingDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit'
                              }) : 'N/A'}
                            </span>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewBidInformationFromBooking(booking)}
                                className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600 hover:border-blue-700"
                              >
                                View Full Information
                              </Button>
                              {booking.status !== 'CONFIRMED' && booking.status !== 'COMPLETED' && booking.status !== 'CANCELLED' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCancelBooking(booking)}
                                  className="bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700"
                                >
                                  Cancel
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
           
          </DialogContent>
        </Dialog>

        {/* Authority Requests Table Dialog */}
        <Dialog open={showAuthorityApprovalDialog} onOpenChange={setShowAuthorityApprovalDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-[#134686]">Authority Requests Status</DialogTitle>
              <DialogDescription>
                View and manage your authority requests for drydock operations.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {isLoadingAuthorityRequests ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#134686]"></div>
                  <span className="ml-2">Loading authority requests...</span>
                </div>
              ) : authorityRequests.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No authority requests found.</p>
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Request Date</TableHead>
                        <TableHead>Vessel Name</TableHead>
                        <TableHead>IMO Number</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Scope of Work</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {authorityRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>
                            {new Date(request.requestDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            {request.drydockRequest?.vesselName || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {request.drydockRequest?.imoNumber || 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                request.status === 'APPROVED' ? 'default' :
                                request.status === 'REJECTED' ? 'destructive' :
                                request.status === 'ISSUED' ? 'secondary' :
                                'outline'
                              }
                            >
                              {request.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {request.finalScopeOfWorkUrl ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(request.finalScopeOfWorkUrl, '_blank')}
                              >
                                View File
                              </Button>
                            ) : (
                              <span className="text-gray-500">No file</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {request.status === 'REQUESTED' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    // Add functionality to edit/cancel request
                                    console.log('Edit request:', request.id)
                                  }}
                                >
                                  Edit
                                </Button>
                              )}
                              {request.status === 'APPROVED' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs bg-red-100 text-red-700 border-red-200 hover:bg-red-200 hover:text-red-800"
                                  onClick={async () => {
                                    if (request.authorityCertificate) {
                                      try {
                                        // Get signed URL for the certificate
                                        const response = await fetch(`/api/view-certificate?url=${encodeURIComponent(request.authorityCertificate)}`)
                                        
                                        if (response.ok) {
                                          const data = await response.json()
                                          
                                          if (data.signedUrl) {
                                            // Extract filename from URL or use default
                                            let filename = 'Authority_Certificate.pdf'
                                            try {
                                              const urlParts = request.authorityCertificate.split('/')
                                              const lastPart = urlParts[urlParts.length - 1]
                                              if (lastPart && lastPart.includes('.')) {
                                                const fileNamePart = lastPart.split('?')[0]
                                                filename = fileNamePart || filename
                                              }
                                            } catch (e) {
                                              // Use default filename
                                            }

                                            // Create a temporary anchor element to trigger download
                                            const link = document.createElement('a')
                                            link.href = data.signedUrl
                                            link.download = filename
                                            link.target = '_blank' // Open in new tab as fallback
                                            document.body.appendChild(link)
                                            link.click()
                                            document.body.removeChild(link)
                                          } else {
                                            console.error('No signed URL in response')
                                          }
                                        } else {
                                          const errorText = await response.text().catch(() => 'Unknown error')
                                          console.error('Failed to generate signed URL:', response.status, errorText)
                                        }
                                      } catch (error) {
                                        console.error('Error opening certificate:', error)
                                      }
                                    } else {
                                      console.log('No certificate available for request:', request.id)
                                    }
                                  }}
                                >
                                  <FileText className="h-3 w-3 mr-1" />
                                  View Certificate
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

           
          </DialogContent>
        </Dialog>

        {/* Create Authority Request Dialog */}
        <Dialog open={showCreateAuthorityDialog} onOpenChange={setShowCreateAuthorityDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-[#134686]">Request Authority Approval Certificate</DialogTitle>
              <DialogDescription>
                Submit your final scope of work document to request authority approval for drydock operations.
              </DialogDescription>
            </DialogHeader>

            {selectedDrydockRequest && (
              <form onSubmit={async (e) => {
                e.preventDefault()
                const formData = new FormData(e.currentTarget)
                
                // Add required fields
                formData.append('userId', user?.id || '')
                formData.append('vesselId', selectedDrydockRequest.vesselId)
                formData.append('drydockRequestId', selectedDrydockRequest.id)
                formData.append('drydockBookingId', selectedDrydockRequest.bookingId || '')
                
                await createAuthorityRequest(formData)
              }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="vesselName" className="text-sm font-medium">Vessel Name</Label>
                    <Input
                      id="vesselName"
                      value={selectedDrydockRequest.vesselName}
                      readOnly
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="imoNumber" className="text-sm font-medium">IMO Number</Label>
                    <Input
                      id="imoNumber"
                      value={selectedDrydockRequest.imoNumber}
                      readOnly
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="companyName" className="text-sm font-medium">Company</Label>
                    <Input
                      id="companyName"
                      value={selectedDrydockRequest.companyName}
                      readOnly
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="shipType" className="text-sm font-medium">Ship Type</Label>
                    <Input
                      id="shipType"
                      value={selectedDrydockRequest.shipType}
                      readOnly
                      className="mt-1"
                    />
                  </div>
                </div>

                {selectedDrydockRequest.bookingId && (
                  <div>
                    <Label htmlFor="bookedShipyard" className="text-sm font-medium">Booked Shipyard</Label>
                    <Input
                      id="bookedShipyard"
                      value={bookedShipyards.find((booking: BookedShipyard) => booking.id === selectedDrydockRequest.bookingId)?.shipyardName || 'Loading...'}
                      readOnly
                      className="mt-1"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="finalScopeOfWork" className="text-sm font-medium">
                    Final Scope of Work Document <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="finalScopeOfWork"
                    name="finalScopeOfWork"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    required
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Upload the final scope of work document (PDF, DOC, or DOCX)
                  </p>
                </div>

                <DialogFooter>
                  <Button 
                    type="button"
                    variant="outline" 
                    onClick={() => {
                      setShowCreateAuthorityDialog(false)
                      setSelectedDrydockRequest(null)
                    }}
                    disabled={isCreatingAuthorityRequest}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={isCreatingAuthorityRequest}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {isCreatingAuthorityRequest ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Submitting...
                      </>
                    ) : (
                      'Submit Request'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
}

