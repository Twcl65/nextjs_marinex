"use client"

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
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Ship } from "lucide-react"
import { useState, useEffect } from "react"
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
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, Building2 } from "lucide-react"

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
  const [selectedVessel, setSelectedVessel] = useState<{
    id: string;
    name: string;
    imoNumber: string;
    shipType: string;
    flag: string;
    vesselImageUrl?: string;
  } | null>(null)
  const [vessels, setVessels] = useState<{
    id: string;
    name: string;
    imoNumber: string;
    shipType: string;
    flag: string;
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
    companyName: '',
    imoNumber: '',
    vesselName: '',
    flag: '',
    shipType: '',
    priorityLevel: 'Normal' as 'Normal' | 'Emergency',
    servicesNeeded: [] as string[],
    scopeOfWork: null as File | null
  })
  const [serviceAreas, setServiceAreas] = useState<Record<string, string>>({})
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Table states
  const [drydockRequests, setDrydockRequests] = useState<{
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
  }[]>([])
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
          setVessels(data.vessels || [])
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

  // Fetch drydock requests from database
  useEffect(() => {
    const fetchDrydockRequests = async () => {
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
    }

    if (user?.id) {
      fetchDrydockRequests()
    }
  }, [user?.id, toast])

  const vesselHasRequest = () => {
    // Mock function - in real app, check if vessel already has a request
    return false
  }

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
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const handleVesselSelect = (vessel: { id: string; name: string; imoNumber: string; shipType: string; flag: string; vesselImageUrl?: string }) => {
    setSelectedVessel(vessel)
    setForm(prev => ({
      ...prev,
      companyName: user?.fullName || '',
      imoNumber: vessel.imoNumber,
      vesselName: vessel.name,
      flag: vessel.flag || '',
      shipType: vessel.shipType || ''
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
      submitFormData.append('vesselId', selectedVessel?.id || '')
      submitFormData.append('companyName', form.companyName)
      submitFormData.append('vesselName', form.vesselName)
      submitFormData.append('imoNumber', form.imoNumber)
      submitFormData.append('flag', form.flag)
      submitFormData.append('shipType', form.shipType)
      submitFormData.append('priorityLevel', form.priorityLevel)
      submitFormData.append('servicesNeeded', JSON.stringify(servicesWithAreas))
      submitFormData.append('companyLogoUrl', user?.logoUrl || '')
      submitFormData.append('vesselImageUrl', selectedVessel?.vesselImageUrl || '')
      
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
          companyName: '',
          imoNumber: '',
          vesselName: '',
          flag: '',
          shipType: '',
          priorityLevel: 'Normal',
          servicesNeeded: [],
          scopeOfWork: null
        })
        setServiceAreas({})
        setSelectedVessel(null)
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

  return (
    <SidebarProvider>
      <ShipownerSidebar />
      <SidebarInset>
        <header className="flex h-12 md:h-14 shrink-0 items-center gap-1 px-3 ml-1 mb-0 pb-0">
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
                  <BreadcrumbPage>Drydock Management</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto">
            <ProfileDropdown />
          </div>
        </header>
        <div className="px-5 pt-0 mt-0">
          <h1 className="text-xl md:text-2xl font-bold text-[#134686]">Drydock Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Plan and track drydock schedules and tasks.</p>
          <Button 
            className="mt-4 bg-[#134686] hover:bg-[#134686]/90 text-white"
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
                        <p className="text-sm text-gray-500 mt-1">Submit your first drydock request using the button above</p>
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
                          <Button
                            size="sm"
                            variant="outline"
                            className="bg-[#134686] text-white border-[#134686] hover:bg-[#134686]/90 hover:text-white h-7 w-7 p-0"
                            title="Browse Shipyard"
                            onClick={() => {
                              setSelectedRequest(request)
                              setShowBrowseShipyard(true)
                            }}
                          >
                            <Building2 className="h-4 w-4" />
                          </Button>
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
                    value={selectedVessel?.id?.toString() || ''}
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
                {vessels.length > 0 && vessels.every(vessel => false) && (
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-700">
                      All your vessels already have drydock requests. You can view their status in the table above.
                    </p>
                  </div>
                )}
              </div>

              {/* Drydock Request Form (only if vessel selected) */}
              {selectedVessel && (
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
                        <p>No services available. Please add services first.</p>
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white border border-gray-200">
            <DialogHeader className="bg-white">
              <DialogTitle className="bg-white font-bold text-[#134686] text-xl">Browse Shipyards</DialogTitle>
              <DialogDescription className="bg-white text-gray-600">
                Select a shipyard to book your drydock services for {selectedRequest?.vesselName || 'your vessel'}.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 bg-white">
              {/* Shipyard Selection Content */}
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Choose from available shipyards that can provide the services you need for your drydock request.
                </p>
                
                {/* Placeholder for shipyard list */}
                <div className="border border-gray-200 rounded-lg p-6 text-center">
                  <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500">Shipyard selection functionality will be implemented here</p>
                  <p className="text-sm text-gray-400 mt-2">This will show available shipyards based on your requirements</p>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  className="cursor-pointer"
                  type="button"
                  variant="outline"
                  onClick={() => setShowBrowseShipyard(false)}
                >
                  Cancel
                </Button>
                <Button
                  className='cursor-pointer text-white bg-[#134686] hover:bg-[#134686]/90'
                  type="button"
                  onClick={() => {
                    // Handle shipyard booking logic here
                    setShowBrowseShipyard(false)
                    toast({
                      title: "Success",
                      description: "Shipyard booking functionality will be implemented",
                      variant: "default"
                    })
                  }}
                >
                  Book Shipyard
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
}

