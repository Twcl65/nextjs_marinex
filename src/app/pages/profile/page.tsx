'use client'

import { useAuth } from '@/contexts/AuthContext'
import { AppHeader } from '@/components/AppHeader'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { MarinaSidebar } from '@/components/marina-sidebar'
import { ShipownerSidebar } from '@/components/shipowner-sidebar'
import { ShipyardSidebar } from '@/components/shipyard-sidebar'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Mail, Save, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import Image from 'next/image'

export default function ProfilePage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [signedLogoUrl, setSignedLogoUrl] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<{
    fullName?: string;
    shipyardName?: string;
    contactNumber?: string;
    officeAddress?: string;
    businessRegNumber?: string;
    contactPerson?: string;
    shipyardDryDock?: string;
    certificateBuilder?: string;
    certificateRepair?: string;
    certificateOther?: string;
  }>({})
  const [loading, setLoading] = useState(false)
  const [recentlySuccessful, setRecentlySuccessful] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [services, setServices] = useState<{
    id?: string;
    name: string;
    squareMeters: number;
    hours: number;
    workers: number;
    days: number;
    price: string;
  }[]>([])
  const [addServiceDialogOpen, setAddServiceDialogOpen] = useState(false)
  const [addingService, setAddingService] = useState(false)
  const [newService, setNewService] = useState({
    name: '',
    squareMeters: '',
    hours: '',
    workers: '',
    days: '',
    price: ''
  })
  const [imageError, setImageError] = useState(false)

  // Fetch latest user data and initialize form data
  useEffect(() => {
    const fetchUserData = async () => {
      if (user?.id) {
        try {
          const response = await fetch(`/api/users/${user.id}`)
          if (response.ok) {
            const result = await response.json()
            const userData = result.user
            
            console.log('Fetched user data:', userData)
            
            setFormData({
              fullName: userData.fullName || '',
              shipyardName: userData.shipyardName || '',
              contactNumber: userData.contactNumber || '',
              officeAddress: userData.officeAddress || '',
              businessRegNumber: userData.businessRegNumber || '',
              contactPerson: userData.contactPerson || '',
              shipyardDryDock: userData.shipyardDryDock || '',
              certificateBuilder: userData.certificateBuilder || '',
              certificateRepair: userData.certificateRepair || '',
              certificateOther: userData.certificateOther || '',
            })
            
            // Set services data if user is a shipyard
            if (userData.role === 'SHIPYARD' && userData.services) {
              setServices(userData.services)
              console.log('Fetched services data:', userData.services)
              console.log('Number of services:', userData.services.length)
            } else {
              console.log('No services data found for user role:', userData.role)
            }
            
            setDataLoaded(true)
          }
        } catch (error) {
          console.error('Error fetching user data:', error)
          // Fallback to user data from context
          setFormData({
            fullName: user.fullName || '',
            shipyardName: user.shipyardName || '',
            contactNumber: user.contactNumber || '',
            officeAddress: user.officeAddress || '',
            businessRegNumber: user.businessRegNumber || '',
            contactPerson: user.contactPerson || '',
            shipyardDryDock: user.shipyardDryDock || '',
            certificateBuilder: user.certificateBuilder || '',
            certificateRepair: user.certificateRepair || '',
            certificateOther: user.certificateOther || '',
          })
          setDataLoaded(true)
        }
      }
    }

    fetchUserData()
  }, [user?.id, user?.businessRegNumber, user?.certificateBuilder, user?.certificateOther, user?.certificateRepair, user?.contactNumber, user?.contactPerson, user?.fullName, user?.officeAddress, user?.shipyardDryDock, user?.shipyardName])

  // Set the logo URL
  useEffect(() => {
    setImageError(false) // Reset error state when logoUrl changes
    if (user?.logoUrl) {
      if (user.logoUrl.includes('s3.amazonaws.com')) {
        // Use the proxy for S3 URLs
        setSignedLogoUrl(`/api/proxy-image?url=${encodeURIComponent(user.logoUrl)}`)
      } else {
        // Use the URL directly if it's not on S3
        setSignedLogoUrl(user.logoUrl)
      }
    } else {
      setSignedLogoUrl(null)
    }
  }, [user?.logoUrl])

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }))
  }

  const handleServiceInputChange = (field: string, value: string) => {
    setNewService((prev) => ({
      ...prev,
      [field]: value
    }))
  }

  const handleAddService = async () => {
    // Validate required fields
    if (!newService.name || !newService.squareMeters || !newService.hours || !newService.workers || !newService.days || !newService.price) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }

    setAddingService(true)
    try {
      const response = await fetch('/api/user-services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.id,
          name: newService.name,
          squareMeters: parseInt(newService.squareMeters),
          hours: parseInt(newService.hours),
          workers: parseInt(newService.workers),
          days: parseInt(newService.days),
          price: newService.price,
        }),
      })

      if (response.ok) {
        // Refresh services data
        const userResponse = await fetch(`/api/users/${user?.id}`)
        if (userResponse.ok) {
          const result = await userResponse.json()
          setServices(result.user.services || [])
        }
        
        // Reset form and close dialog
        setNewService({
          name: '',
          squareMeters: '',
          hours: '',
          workers: '',
          days: '',
          price: ''
        })
        setAddServiceDialogOpen(false)
        toast({
          title: "Success",
          description: "Service added successfully!",
          variant: "success"
        })
      } else {
        const errorData = await response.json()
        toast({
          title: "Error",
          description: errorData.error || 'Failed to add service',
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error adding service:', error)
      toast({
        title: "Error",
        description: "An error occurred while adding the service",
        variant: "destructive"
      })
    } finally {
      setAddingService(false)
    }
  }

  const handleCancelAddService = () => {
    setNewService({
      name: '',
      squareMeters: '',
      hours: '',
      workers: '',
      days: '',
      price: ''
    })
    setAddServiceDialogOpen(false)
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/users/${user?.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        const result = await response.json()
        setIsEditing(false)
        setRecentlySuccessful(true)
        
        // Update localStorage with new user data
        const updatedUser = { ...user, ...result.user }
        localStorage.setItem('user', JSON.stringify(updatedUser))
        
        // Hide success message after 3 seconds
        setTimeout(() => setRecentlySuccessful(false), 3000)
        toast({
          title: "Success",
          description: "Profile updated successfully!",
          variant: "success"
        })
      } else {
        const errorData = await response.json()
        console.error('Failed to update profile')
        toast({
          title: "Error",
          description: errorData.error || 'Failed to update profile. Please try again.',
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      toast({
        title: "Error",
        description: "An error occurred while updating profile. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Please log in to view your profile</h1>
        </div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800'
      case 'INACTIVE':
        return 'bg-gray-100 text-gray-800'
      case 'SUSPENDED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'MARINA':
        return 'bg-blue-100 text-blue-800'
      case 'SHIPOWNER':
        return 'bg-green-100 text-green-800'
      case 'SHIPYARD':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const renderSidebar = () => {
    switch (user.role) {
      case 'MARINA':
        return <MarinaSidebar />
      case 'SHIPOWNER':
        return <ShipownerSidebar />
      case 'SHIPYARD':
        return <ShipyardSidebar />
      default:
        return <MarinaSidebar />
    }
  }

  const renderRoleSpecificFields = () => {
    switch (user.role) {
      case 'SHIPOWNER':
        return (
          <Card className="rounded-sm">
            <CardHeader className="flex flex-col items-start gap-1 pb-0 mb-0">
              <CardTitle className="text-[#134686]">Personal Information</CardTitle>
              <p className="text-sm text-gray-500">Your personal details and contact information for vessel management and drydock operations.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <p className="text-xs text-gray-500 mb-1">This is the name that will be displayed on your account and communications.</p>
                  <Input
                    id="fullName"
                    value={formData.fullName || ''}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                    disabled={!isEditing}
                    placeholder="Enter your full name"
                    className="text-black"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="contactNumber">Contact Number</Label>
                  <p className="text-xs text-gray-500 mb-1">Your primary contact number for business communications.</p>
                  <Input
                    id="contactNumber"
                    value={formData.contactNumber || ''}
                    onChange={(e) => handleInputChange('contactNumber', e.target.value)}
                    disabled={!isEditing}
                    placeholder="Enter your contact number"
                    className="text-black"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="officeAddress">Office Address</Label>
                <p className="text-xs text-gray-500 mb-1">Your business office address for official correspondence.</p>
                  <Textarea
                    id="officeAddress"
                    value={formData.officeAddress || ''}
                    onChange={(e) => handleInputChange('officeAddress', e.target.value)}
                    disabled={!isEditing}
                    placeholder="Enter your office address"
                    rows={3}
                    className="text-black"
                  />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="businessRegNumber">Business Registration Number</Label>
                <p className="text-xs text-gray-500 mb-1">Your official business registration number for verification purposes.</p>
                <Input
                  id="businessRegNumber"
                  value={formData.businessRegNumber || ''}
                  onChange={(e) => handleInputChange('businessRegNumber', e.target.value)}
                  disabled={!isEditing}
                  placeholder="Enter business registration number"
                  className="text-gray-500"
                />
              </div>
            </CardContent>
            {isEditing && (
              <CardFooter className="flex flex-col gap-2 pt-5 mb-5">
                <Button className="w-full" disabled={loading} onClick={handleSave}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
                {recentlySuccessful && (
                  <p className="text-sm text-green-600">Changes are saved securely.</p>
                )}
              </CardFooter>
            )}
          </Card>
        )

      case 'SHIPYARD':
        return (
          <>
            <Card className="rounded-sm">
              <CardHeader className="flex flex-col items-start gap-1 pb-0 mb-0">
                <CardTitle>Shipyard Information</CardTitle>
                <p className="text-sm text-gray-500">Your shipyard business details and operational information for client services.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="shipyardName">Shipyard Name</Label>
                    <p className="text-xs text-gray-500 mb-1">The official name of your shipyard business.</p>
                    <Input
                      id="shipyardName"
                      value={formData.shipyardName || ''}
                      onChange={(e) => handleInputChange('shipyardName', e.target.value)}
                      disabled={!isEditing}
                      placeholder="Enter shipyard name"
                      className="text-black"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="contactPerson">Contact Person</Label>
                    <p className="text-xs text-gray-500 mb-1">Primary contact person for business inquiries.</p>
                    <Input
                      id="contactPerson"
                      value={formData.contactPerson || ''}
                      onChange={(e) => handleInputChange('contactPerson', e.target.value)}
                      disabled={!isEditing}
                      placeholder="Enter contact person name"
                      className="text-black"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="contactNumber">Contact Number</Label>
                    <p className="text-xs text-gray-500 mb-1">Primary business contact number.</p>
                    <Input
                      id="contactNumber"
                      value={formData.contactNumber || ''}
                      onChange={(e) => handleInputChange('contactNumber', e.target.value)}
                      disabled={!isEditing}
                      placeholder="Enter contact number"
                      className="text-black"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="businessRegNumber">Business Registration Number</Label>
                    <p className="text-xs text-gray-500 mb-1">Official business registration number.</p>
                    <Input
                      id="businessRegNumber"
                      value={formData.businessRegNumber || ''}
                      onChange={(e) => handleInputChange('businessRegNumber', e.target.value)}
                      disabled={!isEditing}
                      placeholder="Enter business registration number"
                      className="text-black"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="officeAddress">Office Address</Label>
                  <p className="text-xs text-gray-500 mb-1">Your shipyard&apos;s business office address.</p>
                  <Textarea
                    id="officeAddress"
                    value={formData.officeAddress || ''}
                    onChange={(e) => handleInputChange('officeAddress', e.target.value)}
                    disabled={!isEditing}
                    placeholder="Enter office address"
                    rows={3}
                    className="text-black"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="shipyardDryDock">Dry Dock Information</Label>
                  <p className="text-xs text-gray-500 mb-1">Specifications and capacity details of your dry dock facilities.</p>
                  <Textarea
                    id="shipyardDryDock"
                    value={formData.shipyardDryDock || ''}
                    onChange={(e) => handleInputChange('shipyardDryDock', e.target.value)}
                    disabled={!isEditing}
                    placeholder="Enter dry dock specifications and capacity"
                    rows={3}
                    className="text-black"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-0 mb-0">
                <div className="flex flex-col items-start gap-1">
                  <CardTitle>Drydock Services</CardTitle>
                  <p className="text-sm text-gray-500">Services and capabilities offered by your drydock facility.</p>
                </div>
                <Dialog open={addServiceDialogOpen} onOpenChange={setAddServiceDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="bg-[#134686] text-white border-[#134686] hover:bg-[#0f3a6b] hover:border-[#0f3a6b]"
                    >
                      Add Services
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle className='text-[#134686]'>Add New Service</DialogTitle>
                      <DialogDescription>
                        Add a new drydock service to your shipyard&apos;s offerings.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="serviceName">
                            What is the service name?
                          </Label>
                          <Input
                            id="serviceName"
                            value={newService.name}
                            onChange={(e) => handleServiceInputChange('name', e.target.value)}
                            className="text-black"
                            placeholder="Enter service name"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="squareMeters">
                            How many square meters?
                          </Label>
                          <Input
                            id="squareMeters"
                            type="number"
                            value={newService.squareMeters}
                            onChange={(e) => handleServiceInputChange('squareMeters', e.target.value)}
                            className="text-black"
                            placeholder="Enter square meters"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="hours">
                            How many hours does it take?
                          </Label>
                          <Input
                            id="hours"
                            type="number"
                            value={newService.hours}
                            onChange={(e) => handleServiceInputChange('hours', e.target.value)}
                            className="text-black"
                            placeholder="Enter hours required"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="workers">
                            How many workers are needed?
                          </Label>
                          <Input
                            id="workers"
                            type="number"
                            value={newService.workers}
                            onChange={(e) => handleServiceInputChange('workers', e.target.value)}
                            className="text-black"
                            placeholder="Enter number of workers"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="days">
                            How many days will it take to be done?
                          </Label>
                          <Input
                            id="days"
                            type="number"
                            value={newService.days}
                            onChange={(e) => handleServiceInputChange('days', e.target.value)}
                            className="text-black"
                            placeholder="Enter days to complete"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="price">
                            How much does it cost?
                          </Label>
                          <Input
                            id="price"
                            value={newService.price}
                            onChange={(e) => handleServiceInputChange('price', e.target.value)}
                            className="text-black"
                            placeholder="Enter price"
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={handleCancelAddService}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleAddService}
                        disabled={addingService}
                        className="bg-[#134686] text-white border-[#134686] hover:bg-[#0f3a6b] hover:border-[#0f3a6b]"
                      >
                        {addingService ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Adding Service...
                          </>
                        ) : (
                          'Add Service'
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {!dataLoaded ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                    <span className="text-sm text-gray-600">Loading services...</span>
                  </div>
                ) : services.length === 0 ? (
                  <div className="border border-dashed rounded-md p-6 text-center text-gray-500 text-lg italic">
                    No drydock services added yet. Services will appear here once they are added to your shipyard profile.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Service Name</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Square Meters</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Hours Required</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Workers Needed</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Days to Complete</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {services.map((service, index) => (
                          <tr key={service.id || index} className={index < services.length - 1 ? "border-b" : ""}>
                            <td className="px-3 py-2 text-gray-500">{service.name}</td>
                            <td className="px-3 py-2 text-gray-500">{service.squareMeters}</td>
                            <td className="px-3 py-2 text-gray-500">{service.hours}</td>
                            <td className="px-3 py-2 text-gray-500">{service.workers}</td>
                            <td className="px-3 py-2 text-gray-500">{service.days}</td>
                            <td className="px-3 py-2 text-gray-500">₱{parseFloat(service.price).toLocaleString('en-PH')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-sm mb-5">
              <CardHeader className="flex flex-col items-start gap-1 pb-0 mb-0">
                <CardTitle>Certifications & Licenses</CardTitle>
                <p className="text-sm text-gray-500">Your shipyard&apos;s certifications and licenses for regulatory compliance.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="certificateBuilder">Builder Certificate</Label>
                    <p className="text-xs text-gray-500 mb-1">Certificate for ship building operations.</p>
                    <Input
                      id="certificateBuilder"
                      value={formData.certificateBuilder || ''}
                      onChange={(e) => handleInputChange('certificateBuilder', e.target.value)}
                      disabled={!isEditing}
                      placeholder="Enter builder certificate details"
                      className="text-black"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="certificateRepair">Repair Certificate</Label>
                    <p className="text-xs text-gray-500 mb-1">Certificate for ship repair operations.</p>
                    <Input
                      id="certificateRepair"
                      value={formData.certificateRepair || ''}
                      onChange={(e) => handleInputChange('certificateRepair', e.target.value)}
                      disabled={!isEditing}
                      placeholder="Enter repair certificate details"
                      className="text-black"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="certificateOther">Other Certificates</Label>
                  <p className="text-xs text-gray-500 mb-1">Additional certifications and licenses your shipyard holds.</p>
                    <Input
                      id="certificateOther"
                      value={formData.certificateOther || ''}
                      onChange={(e) => handleInputChange('certificateOther', e.target.value)}
                      disabled={!isEditing}
                      placeholder="Enter other certificate details"
                      className="text-black"
                    />
                </div>
              </CardContent>
            </Card>
          </>
        )

      case 'MARINA':
        return (
          <Card className="rounded-sm">
            <CardHeader className="flex flex-col items-start gap-1 pb-0 mb-0">
              <CardTitle>Marina Authority Information</CardTitle>
              <p className="text-sm text-gray-500">Your marina authority details and contact information for regulatory oversight.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="contactNumber">Contact Number</Label>
                  <p className="text-xs text-gray-500 mb-1">Primary contact number for marina authority communications.</p>
                  <Input
                    id="contactNumber"
                    value={formData.contactNumber || ''}
                    onChange={(e) => handleInputChange('contactNumber', e.target.value)}
                    disabled={!isEditing}
                    placeholder="Enter contact number"
                    className="text-black"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="businessRegNumber">Authority Registration Number</Label>
                  <p className="text-xs text-gray-500 mb-1">Official marina authority registration number.</p>
                  <Input
                    id="businessRegNumber"
                    value={formData.businessRegNumber || ''}
                    onChange={(e) => handleInputChange('businessRegNumber', e.target.value)}
                    disabled={!isEditing}
                    placeholder="Enter authority registration number"
                    className="text-black"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 mb-5">
                <Label htmlFor="officeAddress">Office Address</Label>
                <p className="text-xs text-gray-500 mb-1">Official marina authority office address for correspondence.</p>
                <Textarea
                  id="officeAddress"
                  value={formData.officeAddress || ''}
                  onChange={(e) => handleInputChange('officeAddress', e.target.value)}
                  disabled={!isEditing}
                  placeholder="Enter office address"
                  rows={3}
                  className="text-gray-500"
                />
              </div>
            </CardContent>
          </Card>
        )

      default:
        return null
    }
  }

  return (
    <ProtectedRoute allowedRoles={['MARINA', 'SHIPOWNER', 'SHIPYARD']}>
      <SidebarProvider>
        {renderSidebar()}
        <SidebarInset>
          <AppHeader breadcrumbs={[{ label: 'Profile', href: '/pages/profile' }]} />
          
          <div className="flex flex-col justify-start min-h-[80vh] pl-0">
            <div className="w-full max-w-4xl space-y-8 pl-6 pb-0 mb-0">
              <div className='pt-5'>
                <h3 className="text-lg font-bold mb-2">Profile Settings</h3>
                <p className="text-gray-500 text-sm mb-2 max-w-2xl">
                  Manage your personal information and account details here. Keeping your profile up to date helps us serve you better.
                </p>
              </div>

              {/* Profile Header */}
              <div className="flex items-center space-x-4 mb-6">
                <div className="relative">
                  {signedLogoUrl && !imageError ? (
                    <Image
                      src={signedLogoUrl}
                      alt="Profile Picture"
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded-full object-cover border-2 border-gray-200"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-lg font-bold border-2 border-gray-200">
                      {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h1 className="text-xl font-bold text-gray-900">
                    {user.fullName || user.shipyardName || 'User Profile'}
                  </h1>
                  <div className="flex items-center space-x-3 mb-2">
                    <Badge className={getRoleColor(user.role)}>
                      {user.role.charAt(0) + user.role.slice(1).toLowerCase()}
                    </Badge>
                    <Badge className={getStatusColor(user.status)}>
                      {user.status.charAt(0) + user.status.slice(1).toLowerCase()}
                    </Badge>
                  </div>
                  <p className="text-gray-600 text-sm flex items-center">
                    <Mail className="h-3 w-3 mr-1" />
                    {user.email}
                  </p>
                </div>
                <div className="flex space-x-2">
                  {isEditing && (
                    <>
                      <Button onClick={() => setIsEditing(false)} variant="outline" size="sm">
                        Cancel
                      </Button>
                      <Button onClick={handleSave} disabled={loading} size="sm">
                        <Save className="h-4 w-4 mr-2" />
                        {loading ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Role-specific Profile Fields */}
              {!dataLoaded ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-sm text-gray-600">Loading profile data...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {renderRoleSpecificFields()}
                </div>
              )}

              {/* Success Message */}
              {recentlySuccessful && (
                <div className="mt-4 p-3 rounded-md bg-green-50 border border-green-200">
                  <p className="text-sm text-green-600">Changes are saved securely.</p>
                </div>
              )}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRoute>
  )
}
