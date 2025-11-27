"use client"

import { useState, useEffect, useCallback } from "react"
import { ShipownerSidebar } from "@/components/shipowner-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { AppHeader } from "@/components/AppHeader"
import { useAuth } from "@/contexts/AuthContext"
import { Ship } from "lucide-react"

interface Vessel {
  id: string
  vesselName: string
  imoNumber: string
  shipType: string
  flag: string
  yearOfBuild: number
  lengthOverall: number
  grossTonnage: number
  vesselCertificationExpiry: string | null
  vesselImageUrl: string | null
  vesselCertificationUrl: string | null
  vesselPlansUrl: string | null
  drydockCertificateUrl: string | null
  safetyCertificateUrl: string | null
  status: string
  createdAt: string
  updatedAt: string
}

// Helper function to check if certificate is expiring within 3 months
const isCertificateExpiringSoon = (expirationDate: string | null) => {
  if (!expirationDate) return false

  const today = new Date()
  const expiration = new Date(expirationDate)
  const threeMonthsFromNow = new Date()
  threeMonthsFromNow.setMonth(today.getMonth() + 3)

  return expiration <= threeMonthsFromNow && expiration >= today
}

// Helper function to get months remaining until expiry
const getMonthsUntilExpiry = (expirationDate: string | null) => {
  if (!expirationDate) return null

  const today = new Date()
  const expiration = new Date(expirationDate)
  
  // Calculate the difference in months
  const yearDiff = expiration.getFullYear() - today.getFullYear()
  const monthDiff = expiration.getMonth() - today.getMonth()
  const totalMonths = yearDiff * 12 + monthDiff
  
  return totalMonths
}

// VesselCard component
function VesselCard({ vessel, onViewInfo }: { vessel: Vessel, onViewInfo: (vessel: Vessel) => void }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isLoadingImage, setIsLoadingImage] = useState(false)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    // Reset states when vessel changes
    setImageUrl(null)
    setIsLoadingImage(false)
    setImageError(false)

    if (vessel.vesselImageUrl) {
      setIsLoadingImage(true)
      console.log('VesselCard - Loading image for', vessel.vesselName, ':', vessel.vesselImageUrl)
      
      // Check if it's an S3 URL - proactively get signed URL
      if (vessel.vesselImageUrl.includes('s3.amazonaws.com') || vessel.vesselImageUrl.includes('amazonaws.com')) {
        // Fetch signed URL for S3 images
        fetch(`/api/signed-url?url=${encodeURIComponent(vessel.vesselImageUrl)}`)
          .then(res => res.json())
          .then(data => {
            if (data.signedUrl) {
              console.log('VesselCard - Got signed URL for', vessel.vesselName)
              setImageUrl(data.signedUrl)
            } else {
              console.error('VesselCard - No signedUrl in response, trying direct URL')
              setImageUrl(vessel.vesselImageUrl)
            }
          })
          .catch(err => {
            console.error('VesselCard - Error fetching signed URL, trying direct URL:', err)
            setImageUrl(vessel.vesselImageUrl)
          })
      } else {
        // For non-S3 URLs, use directly
        setImageUrl(vessel.vesselImageUrl)
      }
    } else {
      console.log('VesselCard - No vesselImageUrl for vessel:', vessel.vesselName)
      setIsLoadingImage(false)
    }
  }, [vessel.id, vessel.vesselImageUrl, vessel.vesselName])
  
  // Handle successful image load
  const handleImageLoad = () => {
    console.log('VesselCard - Image loaded successfully for', vessel.vesselName)
    setIsLoadingImage(false)
    setImageError(false)
  }
  
  // Handle image load error
  const handleImageError = async (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error('VesselCard - Image failed to load for', vessel.vesselName, ':', imageUrl)
    setImageError(true)
    setIsLoadingImage(false)
    
    // If direct URL failed and we haven't tried signed URL yet, try it
    if (vessel.vesselImageUrl && imageUrl === vessel.vesselImageUrl && vessel.vesselImageUrl.includes('s3.amazonaws.com')) {
      console.log('VesselCard - Attempting to fetch signed URL as fallback for:', vessel.vesselImageUrl)
      try {
        const response = await fetch(`/api/signed-url?url=${encodeURIComponent(vessel.vesselImageUrl)}`)
        if (response.ok) {
          const data = await response.json()
          if (data.signedUrl) {
            setImageUrl(data.signedUrl)
            setIsLoadingImage(true)
            setImageError(false)
          }
        }
      } catch (err) {
        console.error('VesselCard - Error fetching signed URL:', err)
      }
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }


  return (
    <div 
      className="bg-white rounded-xl shadow-sm border border-gray-300 flex flex-col items-center overflow-hidden"
      style={{ width: '260px', height: '337px' }}
    >
      {/* Vessel Image */}
      <div className="w-full h-32 bg-gray-100 rounded-t-xl border-b border-gray-200 flex items-center justify-center overflow-hidden">
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={vessel.vesselName}
            className="w-full h-full object-cover"
            onLoad={handleImageLoad}
            onError={handleImageError}
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-400">
            <Ship className="w-12 h-12 mb-2" strokeWidth={1.5} />
            <div className="text-xs text-gray-500">Vessel Image</div>
            {isLoadingImage ? (
              <div className="text-xs text-gray-400 mt-1 text-center px-2">
                Loading...
              </div>
            ) : !vessel.vesselImageUrl ? (
              <div className="text-xs text-gray-400 mt-1 text-center px-2">
                No image
              </div>
            ) : (
              <div className="text-xs text-gray-400 mt-1 text-center px-2">
                Failed to load
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="w-full flex flex-col items-center px-4 py-4 flex-1">
        {/* Certificate Status Banner */}
        {vessel.vesselCertificationExpiry && (() => {
          const monthsRemaining = getMonthsUntilExpiry(vessel.vesselCertificationExpiry)
          if (monthsRemaining === null) return null
          
          if (monthsRemaining <= 3 && monthsRemaining >= 0) {
            // Expiring soon (3 months or less)
            return (
              <div className="text-xs text-red-600 font-bold bg-red-100 border border-red-300 px-3 py-2 rounded-lg mb-2 w-full text-center">
                Certificate Expiring Soon
              </div>
            )
          } else if (monthsRemaining > 3) {
            // More than 3 months remaining
            return (
              <div className="text-xs text-green-700 font-bold bg-green-100 border border-green-300 px-3 py-2 rounded-lg mb-2 w-full text-center">
                {monthsRemaining} Month{monthsRemaining !== 1 ? 's' : ''} Before Expiry
              </div>
            )
          }
          return null
        })()}

        {/* Vessel Name and IMO */}
        <div className="text-base text-gray-900 text-center leading-tight mb-2">
          <span className="font-bold">{vessel.vesselName}</span> <span className="font-normal text-xs">(IMO #: {vessel.imoNumber})</span>
        </div>

                {/* Cert. Expiration */}
                <div className="text-xs font-semibold mb-1 w-full text-left text-black">
                  Cert. Expiration: {vessel.vesselCertificationExpiry ? (
                    <span className={(() => {
                      const monthsRemaining = getMonthsUntilExpiry(vessel.vesselCertificationExpiry)
                      if (monthsRemaining !== null && monthsRemaining <= 3 && monthsRemaining >= 0) {
                        return 'text-black font-bold'
                      }
                      return 'text-black'
                    })()}>
                      {formatDate(vessel.vesselCertificationExpiry)}
                    </span>
                  ) : (
                    <span className='text-gray-400'>-</span>
                  )}
                </div>

        {/* Specifications Grid */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 w-full text-xs text-gray-700 mb-3">
          <div>
            <span className="font-normal text-gray-500">Type:</span> {vessel.shipType || '-'}
          </div>
          <div>
            <span className="font-normal text-gray-500">Flag:</span> {vessel.flag || '-'}
          </div>
          <div>
            <span className="font-normal text-gray-500">Length:</span> {vessel.lengthOverall ? `${vessel.lengthOverall} m` : '-'}
          </div>
          <div>
            <span className="font-normal text-gray-500">Tonnage:</span> {vessel.grossTonnage || '-'}
          </div>
        </div>

        {/* View Information Button */}
        <div className="w-full mt-auto">
          <Button 
            className="w-full bg-[#134686] hover:bg-green-700 text-white cursor-pointer"
            onClick={() => onViewInfo(vessel)}
          >
            View Information
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function VesselManagementPage() {
  const { user } = useAuth()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [isLoadingVessels, setIsLoadingVessels] = useState(true)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [infoDialogOpen, setInfoDialogOpen] = useState(false)
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null)
  const { toast } = useToast()

  const handleViewInfo = (vessel: Vessel) => {
    setSelectedVessel(vessel)
    setInfoDialogOpen(true)
  }

  const handleViewDocument = async (url: string, documentName: string) => {
    try {
      const response = await fetch(`/api/signed-url?url=${encodeURIComponent(url)}`)
      const data = await response.json()
      
      if (data.signedUrl) {
        // Open the signed URL in a new tab
        window.open(data.signedUrl, '_blank')
      } else {
        toast({
          title: "Error",
          description: `Failed to generate access link for ${documentName}`,
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error fetching signed URL:', error)
      toast({
        title: "Error",
        description: `Failed to open ${documentName}`,
        variant: "destructive"
      })
    }
  }

  // Helper function to sort vessels by expiration date (near to far)
  const sortVesselsByExpiration = (vessels: Vessel[]) => {
    return [...vessels].sort((a, b) => {
      // If no expiration date, put at the end
      if (!a.vesselCertificationExpiry && !b.vesselCertificationExpiry) return 0
      if (!a.vesselCertificationExpiry) return 1
      if (!b.vesselCertificationExpiry) return -1

      const dateA = new Date(a.vesselCertificationExpiry)
      const dateB = new Date(b.vesselCertificationExpiry)

      return dateA.getTime() - dateB.getTime()
    })
  }

  const fetchVessels = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken')
      if (!token) {
        setIsLoadingVessels(false)
        return
      }

      const response = await fetch(`/api/vessels?userId=${user?.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        console.log('fetchVessels - API response:', data)
        console.log('fetchVessels - vessels data:', data.vessels)
        console.log('fetchVessels - first vessel certification expiry:', data.vessels?.[0]?.vesselCertificationExpiry)
        setVessels(data.vessels || [])
      } else {
        console.error('Failed to fetch vessels')
      }
    } catch (error) {
      console.error('Error fetching vessels:', error)
    } finally {
      setIsLoadingVessels(false)
    }
  }, [user?.id])

  // Fetch vessels on component mount
  useEffect(() => {
    if (user?.id) {
      fetchVessels()
    }
  }, [user?.id, fetchVessels])

  const [formData, setFormData] = useState({
    vesselName: '',
    imoNumber: '',
    shipType: '',
    flag: '',
    yearOfBuild: '',
    lengthOverall: '',
    grossTonnage: '',
    vesselCertificationExpiry: '',
    vesselImage: null as File | null,
    vesselCertification: null as File | null,
    vesselPlans: null as File | null,
    drydockCertificate: null as File | null,
    safetyCertificate: null as File | null,
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleFileChange = (field: string, file: File | null) => {
    setFormData(prev => ({ ...prev, [field]: file }))
  }

  const uploadFileToS3 = async (file: File, prefix: string): Promise<string | null> => {
    try {
      console.log(`[Vessel] Uploading ${prefix} to S3 via proxy...`, { fileName: file.name, fileType: file.type, fileSize: file.size })
      
      // Use proxy upload API to avoid CORS issues
      const formData = new FormData()
      formData.append('file', file)
      formData.append('prefix', prefix)
      
      const uploadRes = await fetch('/api/uploads/upload', {
        method: 'POST',
        body: formData,
      })
      
      if (!uploadRes.ok) {
        const errorData = await uploadRes.json().catch(() => ({ error: 'Unknown error' }))
        console.error(`[Vessel] Failed to upload ${prefix}:`, uploadRes.status, errorData)
        return null
      }

      const result = await uploadRes.json()
      
      if (result.success && result.url) {
        console.log(`[Vessel] ${prefix} uploaded successfully:`, result.url)
        return result.url
      } else {
        console.error(`[Vessel] ${prefix} upload failed:`, result)
        return null
      }
    } catch (error) {
      console.error(`[Vessel] Error uploading ${prefix}:`, error)
      return null
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    
    try {
      // Get the auth token from localStorage
      const token = localStorage.getItem('authToken')
      
      if (!token) {
        toast({
          variant: "destructive",
          title: "Authentication Required",
          description: "You must be logged in to add a vessel"
        })
        setIsSubmitting(false)
        return
      }

      console.log('Submitting vessel data:', {
        vesselName: formData.vesselName,
        imoNumber: formData.imoNumber,
        shipType: formData.shipType,
        flag: formData.flag,
        yearOfBuild: formData.yearOfBuild,
        lengthOverall: formData.lengthOverall,
        grossTonnage: formData.grossTonnage,
        vesselCertificationExpiry: formData.vesselCertificationExpiry,
      })

      // Upload files to S3 first
      let vesselImageUrl = null
      let vesselCertificationUrl = null
      let vesselPlansUrl = null
      let drydockCertificateUrl = null
      let safetyCertificateUrl = null

      // Upload vessel image if provided
      if (formData.vesselImage) {
        vesselImageUrl = await uploadFileToS3(formData.vesselImage, 'vessel-images')
        if (!vesselImageUrl) {
          toast({
            variant: "destructive",
            title: "Upload Failed",
            description: "Failed to upload vessel image. Please try again."
          })
          setIsSubmitting(false)
          return
        }
      }

      // Upload vessel certification if provided
      if (formData.vesselCertification) {
        vesselCertificationUrl = await uploadFileToS3(formData.vesselCertification, 'vessel-certifications')
        if (!vesselCertificationUrl) {
          toast({
            variant: "destructive",
            title: "Upload Failed",
            description: "Failed to upload vessel certification. Please try again."
          })
          setIsSubmitting(false)
          return
        }
      }

      // Upload vessel plans if provided
      if (formData.vesselPlans) {
        vesselPlansUrl = await uploadFileToS3(formData.vesselPlans, 'vessel-plans')
        if (!vesselPlansUrl) {
          toast({
            variant: "destructive",
            title: "Upload Failed",
            description: "Failed to upload vessel plans. Please try again."
          })
          setIsSubmitting(false)
          return
        }
      }

      // Upload drydock certificate if provided
      if (formData.drydockCertificate) {
        drydockCertificateUrl = await uploadFileToS3(formData.drydockCertificate, 'drydock-certificates')
        if (!drydockCertificateUrl) {
          toast({
            variant: "destructive",
            title: "Upload Failed",
            description: "Failed to upload drydock certificate. Please try again."
          })
          setIsSubmitting(false)
          return
        }
      }

      // Upload safety certificate if provided
      if (formData.safetyCertificate) {
        safetyCertificateUrl = await uploadFileToS3(formData.safetyCertificate, 'safety-certificates')
        if (!safetyCertificateUrl) {
          toast({
            variant: "destructive",
            title: "Upload Failed",
            description: "Failed to upload safety certificate. Please try again."
          })
          setIsSubmitting(false)
          return
        }
      }

      const response = await fetch('/api/vessels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          vesselName: formData.vesselName,
          imoNumber: formData.imoNumber,
          shipType: formData.shipType,
          flag: formData.flag,
          yearOfBuild: formData.yearOfBuild,
          lengthOverall: formData.lengthOverall,
          grossTonnage: formData.grossTonnage,
          vesselCertificationExpiry: formData.vesselCertificationExpiry,
          vesselImageUrl,
          vesselCertificationUrl,
          vesselPlansUrl,
          drydockCertificateUrl,
          safetyCertificateUrl,
          userId: user?.id,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Vessel created successfully:', result)
        
        // Reset form and close dialog
        setFormData({
          vesselName: '',
          imoNumber: '',
          shipType: '',
          flag: '',
          yearOfBuild: '',
          lengthOverall: '',
          grossTonnage: '',
          vesselCertificationExpiry: '',
          vesselImage: null,
          vesselCertification: null,
          vesselPlans: null,
          drydockCertificate: null,
          safetyCertificate: null,
        })
        
        // Reset file inputs
        const fileInputs = ['vessel-image', 'vessel-plans', 'drydock-cert', 'vessel-cert', 'safety-cert']
        fileInputs.forEach(id => {
          const input = document.getElementById(id) as HTMLInputElement
          if (input) input.value = ''
        })
        setIsDialogOpen(false)
        
        // Show success toast
        toast({
          variant: "success",
          title: "Vessel Added Successfully",
          description: `${formData.vesselName} has been added to your fleet`
        })

        // Refresh vessels list
        fetchVessels()
      } else {
        // Try to parse error response, but handle cases where response might be empty
        let errorMessage = 'Failed to create vessel'
        try {
          const contentType = response.headers.get('content-type')
          if (contentType && contentType.includes('application/json')) {
            const error = await response.json()
            errorMessage = error.error || error.message || errorMessage
            console.error('Error creating vessel:', error)
          } else {
            const errorText = await response.text()
            if (errorText) {
              errorMessage = errorText
              console.error('Error creating vessel (text):', errorText)
            }
          }
        } catch (parseError) {
          console.error('Error parsing response:', parseError)
          // Use default error message if parsing fails
        }
        
        console.error('Response status:', response.status)
        toast({
          variant: "destructive",
          title: "Error",
          description: errorMessage
        })
      }
    } catch (error) {
      console.error('Error submitting form:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred while submitting the form"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <SidebarProvider>
      <ShipownerSidebar />
      <SidebarInset>
        <AppHeader 
          breadcrumbs={[
            { label: "Dashboard", href: "/pages/shipowner" },
            { label: "Vessel Management", isCurrentPage: true }
          ]} 
        />
        <div className="px-6 pt-0">
          <div className="mb-4">
         
            <div className="mb-4">
              <h1 className="text-lg  md:text-xl font-bold text-[#134686] mb-0">Vessel Management</h1>
              <p className="text-sm text-gray-500">Manage fleet vessels, details, and maintenance.</p>
            </div>
            <div className="flex items-center gap-4">
              <Button
                className="bg-green-500 hover:bg-green-700 text-white cursor-pointer"
                onClick={() => setIsDialogOpen(true)}
              >
                Add Vessel
              </Button>
              <div className="flex items-center gap-4">
                <div className="flex items-center">
                  <Label className="text-sm font-medium text-gray-700 mr-2">Search:</Label>
                  <Input
                    type="text"
                    placeholder="Search Vessel or IMO Number"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-80"
                  />
                </div>
                <div className="flex items-center">
                  <Label className="text-sm font-medium text-gray-700 mr-2">Filter:</Label>
                  <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="w-40 bg-white">
                      <SelectValue placeholder="All vessels" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="all">All vessels</SelectItem>
                      <SelectItem value="expiring">Expiring Soon</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Vessels Display Section */}
        <div className="w-full flex flex-col">
        <div className="pl-6 pt-0 pb-2">
            <div className="text-sm text-gray-500 mb-2">Below are your registered vessels. Click <span className="font-semibold text-gray-700">View Information</span> to see more details about each vessel.</div>
          </div>
          <div className="flex flex-row flex-wrap gap-5 pl-6 pt-1 pb-5 w-full max-w-7xl">
            {isLoadingVessels ? (
              <div className="flex justify-center items-center py-8">
                <div className="text-gray-500">Loading vessels...</div>
              </div>
            ) : (() => {
              const filteredVessels = vessels.filter(vessel => {
                const q = search.toLowerCase()
                const matchesSearch = (
                  vessel.vesselName?.toLowerCase().includes(q) ||
                  vessel.imoNumber?.toLowerCase().includes(q) ||
                  vessel.shipType?.toLowerCase().includes(q)
                )
                
                let matchesFilter = true
                if (filter === "expiring") {
                  matchesFilter = isCertificateExpiringSoon(vessel.vesselCertificationExpiry)
                } else if (filter === "other") {
                  matchesFilter = !isCertificateExpiringSoon(vessel.vesselCertificationExpiry)
                }
                
                return matchesSearch && matchesFilter
              })

              const sortedVessels = sortVesselsByExpiration(filteredVessels)

              return sortedVessels.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm w-full py-8">No vessel found</div>
              ) : (
                sortedVessels.map(vessel => (
                  <VesselCard key={vessel.id} vessel={vessel} onViewInfo={handleViewInfo} />
                ))
              )
            })()}
          </div>
        </div>
      </SidebarInset>

      {/* Add Vessel Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#134686]">Add Vessel</DialogTitle>
            <DialogDescription>
              Enter vessel details and upload required documents.
            </DialogDescription>
          </DialogHeader>
          
          {/* Picture of the Vessel - Full Width Top Row */}
          <div className="mb-0">
            <div className="space-y-2">
              <Label htmlFor="vessel-image">Picture of the Vessel (Image)</Label>
              <Input
                id="vessel-image"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null
                  handleFileChange('vesselImage', file)
                }}
              />
              {formData.vesselImage && (
                <p className="text-sm text-green-600">Selected: {formData.vesselImage.name}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-0">
            {/* Left Column */}
            <div className="space-y-4">

              {/* IMO Number */}
              <div className="space-y-2">
                <Label htmlFor="imo-number">IMO Number</Label>
                <Input
                  id="imo-number"
                  placeholder="e.g. 1234567"
                  value={formData.imoNumber}
                  onChange={(e) => handleInputChange('imoNumber', e.target.value)}
                  className="h-8"
                />
              </div>

              {/* Ship Type */}
              <div className="space-y-2">
                <Label htmlFor="ship-type">Ship Type</Label>
                <Select value={formData.shipType} onValueChange={(value) => handleInputChange('shipType', value)}>
                  <SelectTrigger className="h-10 bg-white">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="cargo">Cargo</SelectItem>
                    <SelectItem value="tanker">Tanker</SelectItem>
                    <SelectItem value="container">Container</SelectItem>
                    <SelectItem value="bulk-carrier">Bulk Carrier</SelectItem>
                    <SelectItem value="passenger">Passenger</SelectItem>
                    <SelectItem value="fishing">Fishing</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Year of Build */}
              <div className="space-y-2">
                <Label htmlFor="year-build">Year of Build</Label>
                <Input
                  id="year-build"
                  placeholder="e.g. 2010"
                  value={formData.yearOfBuild}
                  onChange={(e) => handleInputChange('yearOfBuild', e.target.value)}
                  className="h-8"
                />
              </div>

              {/* Gross Tonnage */}
              <div className="space-y-2">
                <Label htmlFor="gross-tonnage">Gross Tonnage</Label>
                <Input
                  id="gross-tonnage"
                  placeholder="e.g. 50000"
                  value={formData.grossTonnage}
                  onChange={(e) => handleInputChange('grossTonnage', e.target.value)}
                  className="h-8"
                />
              </div>

              {/* Vessel Plans (PDF) */}
              <div className="space-y-2">
                <Label htmlFor="vessel-plans">Vessel Plans (PDF)</Label>
                <Input
                  id="vessel-plans"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    handleFileChange('vesselPlans', file)
                  }}
                  className="h-8"
                />
                {formData.vesselPlans && (
                  <p className="text-sm text-green-600">Selected: {formData.vesselPlans.name}</p>
                )}
              </div>

              {/* Drydock Certificate (PDF) */}
              <div className="space-y-2">
                <Label htmlFor="drydock-cert">Drydock Certificate (PDF)</Label>
                <Input
                  id="drydock-cert"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    handleFileChange('drydockCertificate', file)
                  }}
                  className="h-8"
                />
                {formData.drydockCertificate && (
                  <p className="text-sm text-green-600">Selected: {formData.drydockCertificate.name}</p>
                )}
              </div>

            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Vessel Certification Expiry Date */}
              <div className="space-y-2">
                <Label htmlFor="vessel-cert-expiry">Vessel Certification Expiry Date</Label>
                <Input
                  id="vessel-cert-expiry"
                  type="date"
                  value={formData.vesselCertificationExpiry}
                  onChange={(e) => handleInputChange('vesselCertificationExpiry', e.target.value)}
                  className="h-8"
                />
              </div>

              {/* Vessel Name */}
              <div className="space-y-2">
                <Label htmlFor="vessel-name">Vessel Name</Label>
                <Input
                  id="vessel-name"
                  placeholder="Vessel Name"
                  value={formData.vesselName}
                  onChange={(e) => handleInputChange('vesselName', e.target.value)}
                  className="h-8"
                />
              </div>

              {/* Flag */}
              <div className="space-y-2">
                <Label htmlFor="flag">Flag</Label>
                <Select value={formData.flag} onValueChange={(value) => handleInputChange('flag', value)}>
                  <SelectTrigger className="h-10 bg-white">
                    <SelectValue placeholder="Select flag" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="panama">Panama</SelectItem>
                    <SelectItem value="liberia">Liberia</SelectItem>
                    <SelectItem value="marshall-islands">Marshall Islands</SelectItem>
                    <SelectItem value="singapore">Singapore</SelectItem>
                    <SelectItem value="malta">Malta</SelectItem>
                    <SelectItem value="cyprus">Cyprus</SelectItem>
                    <SelectItem value="bahamas">Bahamas</SelectItem>
                    <SelectItem value="greek">Greek</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Length Overall (m) */}
              <div className="space-y-2">
                <Label htmlFor="length-overall">Length Overall (m)</Label>
                <Input
                  id="length-overall"
                  placeholder="e.g. 200"
                  value={formData.lengthOverall}
                  onChange={(e) => handleInputChange('lengthOverall', e.target.value)}
                  className="h-8"
                />
              </div>

              {/* Vessel Certification (PDF) */}
              <div className="space-y-2">
                <Label htmlFor="vessel-cert">Vessel Certification (PDF)</Label>
                <Input
                  id="vessel-cert"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    handleFileChange('vesselCertification', file)
                  }}
                  className="h-8"
                />
                {formData.vesselCertification && (
                  <p className="text-sm text-green-600">Selected: {formData.vesselCertification.name}</p>
                )}
              </div>

              {/* Safety Certificate (PDF) */}
              <div className="space-y-2">
                <Label htmlFor="safety-cert">Safety Certificate (PDF)</Label>
                <Input
                  id="safety-cert"
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    handleFileChange('safetyCertificate', file)
                  }}
                  className="h-8"
                />
                {formData.safetyCertificate && (
                  <p className="text-sm text-green-600">Selected: {formData.safetyCertificate.name}</p>
                )}
              </div>
            </div>
          </div>

          {/* Dialog Actions */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Adding...' : 'Add Vessel'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vessel Information Dialog */}
      <Dialog open={infoDialogOpen} onOpenChange={setInfoDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#134686]">Vessel Information</DialogTitle>
            <DialogDescription>
              View all details and uploaded documents for this vessel.
            </DialogDescription>
          </DialogHeader>
          
          {selectedVessel && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Left Column */}
                <div className="space-y-4">
                  {/* IMO Number */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">IMO Number</Label>
                    <div className="px-3 py-1 bg-white rounded-md border">
                      <span className="text-black">{selectedVessel.imoNumber}</span>
                    </div>
                  </div>

                  {/* Ship Type */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Ship Type</Label>
                    <div className="px-3 py-1 bg-white rounded-md border">
                      {selectedVessel.shipType}
                    </div>
                  </div>

                  {/* Year of Build */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Year of Build</Label>
                    <div className="px-3 py-1 bg-white rounded-md border">
                      {selectedVessel.yearOfBuild}
                    </div>
                  </div>

                  {/* Gross Tonnage */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Gross Tonnage</Label>
                    <div className="px-3 py-1 bg-white rounded-md border">
                      {selectedVessel.grossTonnage || <span className="text-gray-500">-</span>}
                    </div>
                  </div>

                  {/* Vessel Plans (PDF) */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Vessel Plans (PDF)</Label>
                    <div className="px-3 py-1 bg-white rounded-md border">
                        {selectedVessel.vesselPlansUrl ? (
                          <button 
                            onClick={() => handleViewDocument(selectedVessel.vesselPlansUrl!, "Vessel Plans")}
                            className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                          >
                            View Plans
                          </button>
                        ) : (
                          <span className="text-gray-500">No plans uploaded</span>
                        )}
                    </div>
                  </div>

                  {/* Drydock Certificate (PDF) */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Drydock Certificate (PDF)</Label>
                    <div className="px-3 py-1 bg-white rounded-md border">
                        {selectedVessel.drydockCertificateUrl ? (
                          <button 
                            onClick={() => handleViewDocument(selectedVessel.drydockCertificateUrl!, "Drydock Certificate")}
                            className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                          >
                            View Drydock Certificate
                          </button>
                        ) : (
                          <span className="text-gray-500">No drydock certificate uploaded</span>
                        )}
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  {/* Vessel Certification Expiry Date */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Vessel Certification Expiry Date</Label>
                    <div className="px-3 py-1 bg-white rounded-md border">
                      {selectedVessel.vesselCertificationExpiry ? (
                        <div>
                          <span className="text-black">
                            {new Date(selectedVessel.vesselCertificationExpiry).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </span>
                          {isCertificateExpiringSoon(selectedVessel.vesselCertificationExpiry) && (
                            <span className="ml-2 text-red-600">Expiring Soon</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500">No expiration date set</span>
                      )}
                    </div>
                  </div>

                  {/* Vessel Name */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Vessel Name</Label>
                    <div className="px-3 py-1 bg-white rounded-md border">
                        <span className="text-black">{selectedVessel.vesselName}</span>
                    </div>
                  </div>

                  {/* Flag */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Flag</Label>
                    <div className="px-3 py-1 bg-white rounded-md border">
                      {selectedVessel.flag || <span className="text-gray-500">-</span>}
                    </div>
                  </div>

                  {/* Length Overall */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Length Overall (m)</Label>
                    <div className="px-3 py-1 bg-white rounded-md border">
                      {selectedVessel.lengthOverall ? `${selectedVessel.lengthOverall} m` : <span className="text-gray-500">-</span>}
                    </div>
                  </div>

                  {/* Vessel Certification (PDF) */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Vessel Certification (PDF)</Label>
                    <div className="px-3 py-1 bg-white rounded-md border">
                        {selectedVessel.vesselCertificationUrl ? (
                          <button 
                            onClick={() => handleViewDocument(selectedVessel.vesselCertificationUrl!, "Vessel Certificate")}
                            className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                          >
                            View Certificate
                          </button>
                        ) : (
                          <span className="text-gray-500">No certificate uploaded</span>
                        )}
                    </div>
                  </div>

                  {/* Safety Certificate (PDF) */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Safety Certificate (PDF)</Label>
                    <div className="px-3 py-1 bg-white rounded-md border">
                        {selectedVessel.safetyCertificateUrl ? (
                          <button 
                            onClick={() => handleViewDocument(selectedVessel.safetyCertificateUrl!, "Safety Certificate")}
                            className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
                          >
                            View Safety Certificate
                          </button>
                        ) : (
                          <span className="text-gray-500">No safety certificate uploaded</span>
                        )}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}
        </DialogContent>
      </Dialog>

      <Toaster />
    </SidebarProvider>
  )
}

