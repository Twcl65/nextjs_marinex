"use client"

import { MarinaSidebar } from "@/components/marina-sidebar"
import { Separator } from "@/components/ui/separator"
import { AppHeader } from "@/components/AppHeader"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { ProfileDropdown } from "@/components/ProfileDropdown"
import { NotificationDropdown } from "@/components/NotificationDropdown"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TableOfContents, User, ChevronLeft, ChevronRight } from "lucide-react"
import React, { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"

interface User {
  id: string
  email: string
  role: 'SHIPOWNER' | 'SHIPYARD'
  status: 'INACTIVE' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED' | 'PENDING'
  fullName?: string
  shipyardName?: string
  contactNumber?: string
  officeAddress?: string
  businessRegNumber?: string
  logoUrl?: string
  certificateBuilder?: string
  certificateRepair?: string
  certificateOther?: string
  contactPerson?: string
  services: Array<{
    serviceName: string
    servicePrice: string
    squareMeters: string
    hours: string
    workers: string
    days: string
  }>
  dryDockSlots?: string
  shipownerVesselInfo?: unknown
  createdAt: string
  updatedAt: string
}

// UserLogo component to handle signed URL fetching
function UserLogo({ user }: { user: User }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    if (user.logoUrl && user.logoUrl !== 'null' && user.logoUrl.trim() !== '') {
      setLoading(true)
      setImageError(false)
      
      // Check if it's an S3 URL (with or without region)
      if (user.logoUrl.includes('s3') && user.logoUrl.includes('amazonaws.com')) {
        // Fetch signed URL for S3 images
        fetch(`/api/signed-url?url=${encodeURIComponent(user.logoUrl)}`)
          .then(async res => {
            const data = await res.json()
            if (!res.ok) {
              throw new Error(data.error || `HTTP error! status: ${res.status}`)
            }
            return data
          })
          .then(data => {
            if (data.signedUrl && data.signedUrl.includes('?X-Amz-')) {
              setSignedUrl(data.signedUrl)
            } else {
              // Not a valid signed URL, show initials
              setSignedUrl(null)
            }
          })
          .catch(err => {
            console.error('Error fetching signed URL:', err)
            setSignedUrl(null) // Show initials instead
          })
          .finally(() => {
            setLoading(false)
          })
      } else {
        // For non-S3 URLs, use directly
        setSignedUrl(user.logoUrl)
        setLoading(false)
      }
    } else {
      setSignedUrl(null)
      setLoading(false)
    }
  }, [user.logoUrl])

  const getInitials = () => {
    const displayName = user.role === 'SHIPOWNER' ? user.fullName : user.shipyardName
    if (!displayName) return 'U'
    return displayName
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getDisplayName = () => {
    return user.role === 'SHIPOWNER' ? user.fullName : user.shipyardName
  }

  return (
    <div className="h-8 w-8 bg-gray-100 flex items-center justify-center border border-gray-200 relative overflow-hidden rounded-full">
      {signedUrl && !loading && !imageError ? (
        <img
          src={signedUrl}
          alt={`${getDisplayName()} logo`}
          className="h-full w-full object-cover rounded-full"
          onError={() => {
            setImageError(true)
          }}
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center text-xs font-medium text-gray-600">
          {getInitials()}
        </div>
      )}
    </div>
  )
}

// DialogUserLogo component for larger display in dialog
function DialogUserLogo({ user }: { user: User }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    if (user.logoUrl && user.logoUrl !== 'null' && user.logoUrl.trim() !== '') {
      setLoading(true)
      setImageError(false)
      
      // Check if it's an S3 URL (with or without region)
      if (user.logoUrl.includes('s3') && user.logoUrl.includes('amazonaws.com')) {
        // Fetch signed URL for S3 images
        fetch(`/api/signed-url?url=${encodeURIComponent(user.logoUrl)}`)
          .then(async res => {
            const data = await res.json()
            if (!res.ok) {
              throw new Error(data.error || `HTTP error! status: ${res.status}`)
            }
            return data
          })
          .then(data => {
            if (data.signedUrl && data.signedUrl.includes('?X-Amz-')) {
              setSignedUrl(data.signedUrl)
            } else {
              // Not a valid signed URL, show initials
              setSignedUrl(null)
            }
          })
          .catch(err => {
            console.error('Error fetching signed URL:', err)
            setSignedUrl(null) // Show initials instead
          })
          .finally(() => {
            setLoading(false)
          })
      } else {
        // For non-S3 URLs, use directly
        setSignedUrl(user.logoUrl)
        setLoading(false)
      }
    } else {
      setSignedUrl(null)
      setLoading(false)
    }
  }, [user.logoUrl])

  const getInitials = () => {
    const displayName = user.role === 'SHIPOWNER' ? user.fullName : user.shipyardName
    if (!displayName) return 'U'
    return displayName
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getDisplayName = () => {
    return user.role === 'SHIPOWNER' ? user.fullName : user.shipyardName
  }

  return (
    <div className="h-24 w-24 bg-gray-100 flex items-center justify-center border border-gray-200 relative overflow-hidden rounded-full">
      {signedUrl && !loading && !imageError ? (
        <img
          src={signedUrl}
          alt={`${getDisplayName()} logo`}
          className="h-full w-full object-cover rounded-full"
          onError={() => {
            setImageError(true)
          }}
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center text-2xl font-medium text-gray-600">
          {getInitials()}
        </div>
      )}
    </div>
  )
}

export default function ManageUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(5)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false)
  const [isSuspending, setIsSuspending] = useState(false)
  const [suspensionReason, setSuspensionReason] = useState("")
  const [unsuspendDialogOpen, setUnsuspendDialogOpen] = useState(false)
  const [isUnsuspending, setIsUnsuspending] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users')
      const data = await response.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter and search users
  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === "" || 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.fullName && user.fullName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.shipyardName && user.shipyardName.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesRole = roleFilter === "all" || user.role.toLowerCase() === roleFilter.toLowerCase()
    const matchesStatus = statusFilter === "all" || user.status.toLowerCase() === statusFilter.toLowerCase()
    
    return matchesSearch && matchesRole && matchesStatus
  }).sort((a, b) => {
    // Define status priority order: INACTIVE first, then ACTIVE, then REJECTED, then SUSPENDED
    const statusOrder = { 'PENDING': 1, 'INACTIVE': 2, 'ACTIVE': 3, 'REJECTED': 4, 'SUSPENDED': 5 }
    const statusA = statusOrder[a.status as keyof typeof statusOrder] || 5
    const statusB = statusOrder[b.status as keyof typeof statusOrder] || 5
    
    // First sort by status priority
    if (statusA !== statusB) {
      return statusA - statusB
    }
    
    // Then sort by creation date (newest first) within the same status
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const currentUsers = filteredUsers.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }


  const handleEditUser = (user: User) => {
    setSelectedUser(user)
    setEditDialogOpen(true)
  }

  const handleViewCertificate = async (certificateUrl: string) => {
    try {
      const response = await fetch(`/api/signed-url?url=${encodeURIComponent(certificateUrl)}`)
      const data = await response.json()
      if (data.signedUrl) {
        window.open(data.signedUrl, '_blank')
      } else {
        console.error('Failed to get signed URL for certificate')
      }
    } catch (error) {
      console.error('Error fetching signed URL for certificate:', error)
    }
  }

  const handleApproveClick = () => {
    setEditDialogOpen(false)
    setApproveDialogOpen(true)
  }

  const handleApproveConfirm = async () => {
    if (!selectedUser || isApproving) return

    setIsApproving(true)

    try {
      // Update user status to ACTIVE and send email
      const response = await fetch('/api/users/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: selectedUser.id,
          status: 'ACTIVE'
        }),
      })

      if (response.ok) {
        // Update the user in the local state
        setUsers(users.map(user => 
          user.id === selectedUser.id 
            ? { ...user, status: 'ACTIVE' }
            : user
        ))

        // Show success toast
        toast({
          variant: "success",
          title: "User Approved Successfully",
          description: `${selectedUser.role === 'SHIPOWNER' ? selectedUser.fullName : selectedUser.shipyardName} has been approved and activated.`,
        })

        setApproveDialogOpen(false)
        setSelectedUser(null)
      } else {
        throw new Error('Failed to update user status')
      }
    } catch (error) {
      console.error('Error approving user:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to approve user. Please try again.",
      })
    } finally {
      setIsApproving(false)
    }
  }

  const handleApproveCancel = () => {
    setApproveDialogOpen(false)
    setEditDialogOpen(true)
    setIsApproving(false)
  }

  const handleRejectClick = () => {
    setEditDialogOpen(false)
    setRejectDialogOpen(true)
  }

  const handleRejectConfirm = async () => {
    if (!selectedUser || isRejecting || !rejectionReason.trim()) return

    setIsRejecting(true)

    try {
      // Update user status to REJECTED and send email
      const response = await fetch('/api/users/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: selectedUser.id,
          status: 'REJECTED',
          rejectionReason,
        }),
      })

      if (response.ok) {
        // Update the user in the local state
        setUsers(users.map(user => 
          user.id === selectedUser.id 
            ? { ...user, status: 'REJECTED' }
            : user
        ))

        // Show success toast
        toast({
          variant: "destructive",
          title: "User Rejected Successfully",
          description: `${selectedUser.role === 'SHIPOWNER' ? selectedUser.fullName : selectedUser.shipyardName} has been rejected.`,
        })

        setRejectDialogOpen(false)
        setSelectedUser(null)
        setRejectionReason("")
      } else {
        throw new Error('Failed to update user status')
      }
    } catch (error) {
      console.error('Error rejecting user:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to reject user. Please try again.",
      })
    } finally {
      setIsRejecting(false)
    }
  }

  const handleRejectCancel = () => {
    setRejectDialogOpen(false)
    setEditDialogOpen(true)
    setIsRejecting(false)
    setRejectionReason("")
  }

  const handleSuspendClick = (user: User) => {
    setSelectedUser(user)
    setEditDialogOpen(false)
    setSuspendDialogOpen(true)
  }

  const handleSuspendConfirm = async () => {
    if (!selectedUser || isSuspending || !suspensionReason.trim()) return

    setIsSuspending(true)

    try {
      // Update user status to SUSPENDED and send email
      const response = await fetch('/api/users/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: selectedUser.id,
          status: 'SUSPENDED',
          rejectionReason: suspensionReason,
        }),
      })

      if (response.ok) {
        // Update the user in the local state
        setUsers(users.map(user => 
          user.id === selectedUser.id 
            ? { ...user, status: 'SUSPENDED' }
            : user
        ))

        // Show success toast
        toast({
          variant: "destructive",
          title: "User Suspended Successfully",
          description: `${selectedUser.role === 'SHIPOWNER' ? selectedUser.fullName : selectedUser.shipyardName} has been suspended.`,
        })

        setSuspendDialogOpen(false)
        setSelectedUser(null)
        setSuspensionReason("")
      } else {
        throw new Error('Failed to update user status')
      }
    } catch (error) {
      console.error('Error suspending user:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to suspend user. Please try again.",
      })
    } finally {
      setIsSuspending(false)
    }
  }

  const handleSuspendCancel = () => {
    setSuspendDialogOpen(false)
    setIsSuspending(false)
    setSuspensionReason("")
  }

  const handleUnsuspendClick = () => {
    setEditDialogOpen(false)
    setUnsuspendDialogOpen(true)
  }

  const handleUnsuspendConfirm = async () => {
    if (!selectedUser || isUnsuspending) return

    setIsUnsuspending(true)

    try {
      // Update user status to ACTIVE and send email
      const response = await fetch('/api/users/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: selectedUser.id,
          status: 'ACTIVE'
        }),
      })

      if (response.ok) {
        // Update the user in the local state
        setUsers(users.map(user => 
          user.id === selectedUser.id 
            ? { ...user, status: 'ACTIVE' }
            : user
        ))

        // Show success toast
        toast({
          variant: "success",
          title: "User Reactivated Successfully",
          description: `${selectedUser.role === 'SHIPOWNER' ? selectedUser.fullName : selectedUser.shipyardName} has been reactivated.`,
        })

        setUnsuspendDialogOpen(false)
        setSelectedUser(null)
      } else {
        throw new Error('Failed to update user status')
      }
    } catch (error) {
      console.error('Error reactivating user:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to reactivate user. Please try again.",
      })
    } finally {
      setIsUnsuspending(false)
    }
  }

  const handleUnsuspendCancel = () => {
    setUnsuspendDialogOpen(false)
    setEditDialogOpen(true)
    setIsUnsuspending(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800'
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'INACTIVE':
        return 'bg-gray-100 text-gray-800'
      case 'SUSPENDED':
        return 'bg-red-100 text-red-800'
      case 'REJECTED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getDisplayName = (user: User) => {
    return user.role === 'SHIPOWNER' ? user.fullName : user.shipyardName
  }

  return (
    <SidebarProvider>
      <MarinaSidebar />
  
            <SidebarInset>
              <AppHeader 
                breadcrumbs={[
                  { label: "Dashboard", href: "/pages/marina" },
                  { label: "Manage Users", isCurrentPage: true }
                ]} 
              />
        <div className="px-6 py-0 pb-6">
          <div className="mb-6 pt-5">
            <h1 className="text-lg md:text-xl font-bold text-[#134686]">User Management</h1>
            <p className="text-sm text-gray-500 mt-1">Create and manage user accounts with their profile information and roles.</p>
          </div>

          {/* Search and Filter Section */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Label htmlFor="search" className="text-sm font-medium whitespace-nowrap">Search:</Label>
              <Input
                id="search"
                placeholder="Search by email, name, or business name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full max-w-80"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="role-filter" className="text-sm font-medium whitespace-nowrap">Filter by role:</Label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-400 focus:border-gray-600 border-box">
                  <SelectItem value="all">All roles</SelectItem>
                  <SelectItem value="SHIPOWNER">Shipowner</SelectItem>
                  <SelectItem value="SHIPYARD">Shipyard</SelectItem>
                </SelectContent>
              </Select>
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
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table Container - Responsive */}
          <div className="border border-gray-300 rounded-lg overflow-hidden w-full mb-3">
            <Table className="w-full">
              <TableHeader className="bg-gray-50">
                <TableRow className="align-middle h-4">
                  <TableHead className="whitespace-nowrap py-0 h-11 w-16">Logo</TableHead>
                  <TableHead className="whitespace-nowrap py-0 h-11 min-w-[120px]">Name</TableHead>
                  <TableHead className="whitespace-nowrap py-0 h-11 min-w-[150px]">Email</TableHead>
                  <TableHead className="whitespace-nowrap py-0 h-11 min-w-[100px]">Contact</TableHead>
                  <TableHead className="whitespace-nowrap py-0 h-11 w-20">Role</TableHead>
                  <TableHead className="whitespace-nowrap py-0 h-11 w-24">Status</TableHead>
                  <TableHead className="whitespace-nowrap py-0 h-11 w-24">Reg Date</TableHead>
                  <TableHead className="whitespace-nowrap py-0 h-11 w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        <p className="text-gray-600">Loading users...</p>
                      </TableCell>
                    </TableRow>
                  ) : currentUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                       
                        <p className="text-gray-600">No users found</p>
                        <p className="text-sm text-gray-500 mt-1">No registered users match your search criteria</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    currentUsers.map((user) => (
                      <TableRow key={user.id} className="align-middle h-6">
                        <TableCell className="whitespace-nowrap py-2">
                          <UserLogo user={user} />
                        </TableCell>
                        <TableCell className="py-2">
                          <span className="font-medium text-gray truncate block max-w-[120px]" title={getDisplayName(user) || 'N/A'}>
                            {getDisplayName(user) || 'N/A'}
                          </span>
                        </TableCell>
                        <TableCell className="py-2">
  <span
    className="text-sm text-gray-600 truncate block max-w-[150px]"
    title={user.email}
  >
    {user.email.length > 10 ? user.email.substring(0, 10) + "..." : user.email}
  </span>
</TableCell>

                        <TableCell className="py-2">
                          <span className="text-sm text-gray-600 truncate block max-w-[100px]" title={user.contactNumber || 'N/A'}>
                            {user.contactNumber || 'N/A'}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-2">
                          <span className="text-sm text-gray capitalize">{user.role.toLowerCase()}</span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-2">
                          <Badge className={getStatusColor(user.status)}>
                            {user.status === 'PENDING' ? 'Pending' :
                             user.status === 'INACTIVE' ? 'Inactive' : 
                             user.status === 'ACTIVE' ? 'Active' :
                             user.status === 'SUSPENDED' ? 'Suspended' :
                             user.status === 'REJECTED' ? 'Rejected' : user.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-2">
                          <span className="text-sm text-gray">
                            {new Date(user.createdAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-2">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-green-600 text-white border-green-600 hover:bg-green-700 hover:text-white h-8 px-3"
                              title="View Info"
                              onClick={() => handleEditUser(user)}
                            >
                              <TableOfContents className="h-4 w-4 mr-1" />
                            </Button>
                            {user.status === 'ACTIVE' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-orange-600 text-white border-orange-600 hover:bg-orange-700 hover:text-white h-8 px-3"
                                title="Suspend User"
                                onClick={() => handleSuspendClick(user)}
                              >
                                Suspend
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
          </div>

          {/* Pagination Controls - Fixed Position */}
          {!loading && filteredUsers.length > 0 && (
            <div className="flex flex-wrap items-center justify-between text-sm px-0">
              <div className='text-sm text-gray-500'>
                {filteredUsers.length === 0 ? '0' : `${startIndex + 1} - ${Math.min(endIndex, filteredUsers.length)}`} of {filteredUsers.length} row(s)
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

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#134686]">
              {selectedUser?.status === 'ACTIVE' ? 'View User Details' : 
               selectedUser?.status === 'REJECTED' ? 'View Rejected User' : 
               'View and Approve User'}
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.status === 'ACTIVE' 
                ? 'View user information and details.' 
                : selectedUser?.status === 'REJECTED'
                ? 'View information for this rejected user.'
                : 'This is where you can view and approve user information.'
              }
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-3">
              {/* Profile Picture and Basic Info */}
              <div className="flex items-start gap-4">
                {/* Profile Picture */}
                <div className="h-32 w-32 bg-gray-100 flex items-center justify-center border border-gray-200 relative overflow-hidden flex-shrink-0 rounded-lg">
                  <DialogUserLogo user={selectedUser} />
                </div>
                
                {/* Basic Information */}
                <div className="flex-1 space-y-2">
                  <div>
                    <Label className="text-sm font-medium text-black mb-1 block">
                      {selectedUser.role === 'SHIPOWNER' ? 'Full Name' : 'Shipyard Name'}
                    </Label>
                    <Input
                      value={selectedUser.role === 'SHIPOWNER' ? (selectedUser.fullName || '') : (selectedUser.shipyardName || '')}
                      readOnly
                      className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-black mb-1 block">Role</Label>
                    <Input
                      value={selectedUser.role}
                      readOnly
                      className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-black mb-1 block">Email</Label>
                <Input
                  value={selectedUser.email}
                  readOnly
                  className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                />
              </div>

              <div>
                <Label className="text-sm font-medium text-black mb-1 block">Contact Number</Label>
                <Input
                  value={selectedUser.contactNumber || ''}
                  readOnly
                  className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                />
              </div>

              {selectedUser.role === 'SHIPYARD' && (
                <div>
                  <Label className="text-sm font-medium text-black mb-1 block">Contact Person</Label>
                  <Input
                    value={selectedUser.contactPerson || ''}
                    readOnly
                    className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                  />
                </div>
              )}

              {selectedUser.role === 'SHIPYARD' && (
                <>
                  <div>
                    <Label className="text-sm font-medium text-black mb-1 block">Office Address</Label>
                    <Input
                      value={selectedUser.officeAddress || ''}
                      readOnly
                      className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-black mb-1 block">Business Registration Number</Label>
                    <Input
                      value={selectedUser.businessRegNumber || ''}
                      readOnly
                      className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                    />
                  </div>
                  
                  {/* Services Section */}
                  <div>
                    <Label className="text-sm font-medium text-black mb-3 block">Services</Label>
                    {selectedUser.services && selectedUser.services.length > 0 ? (
                      <div className="overflow-x-auto rounded-lg border border-gray-300">
                        <table className="w-full">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="border-b  px-3 py-2 text-left text-xs font-medium text-gray-600">Drydock Service Name:</th>
                              <th className="border-b  px-3 py-2 text-left text-xs font-medium text-gray-600">What is the price?</th>
                              <th className="border-b  px-3 py-2 text-left text-xs font-medium text-gray-600">How many Square Meters?</th>
                              <th className="border-b  px-3 py-2 text-left text-xs font-medium text-gray-600">How many hours per day?</th>
                              <th className="border-b  px-3 py-2 text-left text-xs font-medium text-gray-600">How many workers needed?</th>
                              <th className="border-b  px-3 py-2 text-left text-xs font-medium text-gray-600">How many days will it takes to be done?</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedUser.services.map((service, index: number) => (
                              <tr key={index} className="bg-gray-20">
                                <td className="border-b border-gray-400 px-3 py-2 text-sm text-black">
                                  {service.serviceName || 'Not specified'}
                                </td>
                                <td className="border-b border-gray-400 px-3 py-2 text-sm text-black">
                                  {service.servicePrice ? `PHP ${Number(service.servicePrice).toLocaleString()}` : 'Not specified'}
                                </td>
                                <td className="border-b border-gray-400 px-3 py-2 text-sm text-black">
                                  {service.squareMeters || 'Not specified'}
                                </td>
                                <td className="border-b border-gray-400 px-3 py-2 text-sm text-black">
                                  {service.hours || 'Not specified'}
                                </td>
                                <td className="border-b border-gray-400 px-3 py-2 text-sm text-black">
                                  {service.workers || 'Not specified'}
                                </td>
                                <td className="border-b border-gray-400 px-3 py-2 text-sm text-black">
                                  {service.days || 'Not specified'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="bg-gray-20 border border-gray-400 rounded p-3 text-center text-gray-500">
                        No services registered
                      </div>
                    )}
                  </div>

                  {/* Dry Dock Slots Section */}
                  <div>
                    <Label className="text-sm font-medium text-black mb-1 block">Dry Dock Slots</Label>
                    <Input
                      value={selectedUser.dryDockSlots || 'Not specified'}
                      readOnly
                      className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                    />
                  </div>
                </>
              )}

              {/* Vessel Information Section for Shipowners */}
              {selectedUser.role === 'SHIPOWNER' && (
                <div>
                  <Label className="text-sm font-medium text-black mb-3 block">Vessel Information</Label>
                  {selectedUser.shipownerVesselInfo ? (
                    ((): React.ReactNode => {
                      // Handle different data structures
                      let vesselData: unknown = selectedUser.shipownerVesselInfo;
                      console.log('Vessel data received:', vesselData, 'Type:', typeof vesselData);
                      
                      // If it's a string, try to parse it as JSON
                      if (typeof vesselData === 'string') {
                        try {
                          vesselData = JSON.parse(vesselData);
                        } catch (e) {
                          console.error('Error parsing vessel data:', e);
                          vesselData = null;
                        }
                      }
                      
                      // If it's an object with vessels property, use that
                      if (vesselData && typeof vesselData === 'object' && vesselData !== null && 'vessels' in vesselData) {
                        vesselData = (vesselData as { vessels: unknown }).vessels;
                      }
                      
                      // Ensure it's an array
                      if (!Array.isArray(vesselData)) {
                        vesselData = vesselData ? [vesselData] : [];
                      }
                      
                      const vesselArray = vesselData as unknown[];
                      return vesselArray.length > 0 ? (
                        <div className="overflow-x-auto rounded-lg border border-gray-300">
                          <table className="w-full">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="border-b px-3 py-2 text-left text-xs font-medium text-gray-600">Vessel Name</th>
                                <th className="border-b px-3 py-2 text-left text-xs font-medium text-gray-600">IMO Number</th>
                                <th className="border-b px-3 py-2 text-left text-xs font-medium text-gray-600">Type</th>
                              </tr>
                            </thead>
                            <tbody>
                              {vesselArray.map((vessel, index: number) => {
                                const vesselData = vessel as Record<string, unknown>;
                                return (
                                <tr key={index} className="bg-gray-20">
                                  <td className="border-b border-gray-400 px-3 py-2 text-sm text-black">
                                    {(vesselData.vesselName as string) || (vesselData.name as string) || 'Not specified'}
                                  </td>
                                  <td className="border-b border-gray-400 px-3 py-2 text-sm text-black">
                                    {(vesselData.imoNumber as string) || (vesselData.imo as string) || 'Not specified'}
                                  </td>
                                  <td className="border-b border-gray-400 px-3 py-2 text-sm text-black">
                                    {(vesselData.vesselType as string) || (vesselData.type as string) || 'Not specified'}
                                  </td>
                                </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="bg-gray-20 border border-gray-400 rounded p-3 text-center text-gray-500">
                          No vessel information available
                        </div>
                      );
                    })()
                  ) : null}
                  {!selectedUser.shipownerVesselInfo && (
                    <div className="bg-gray-20 border border-gray-400 rounded p-3 text-center text-gray-500">
                      No vessel information available
                    </div>
                  )}
                </div>
              )}

              {/* Certificates Section */}
              <div>
                <Label className="text-sm font-medium text-black mb-3 block">Certificates</Label>
                <div className="space-y-3">
                  {selectedUser.certificateBuilder && (
                    <div className="flex items-center gap-3">
                      <Input
                        value="Builder Certificate"
                        readOnly
                        className="bg-gray-20 flex-1"
                      />
                      <Button
                        size="sm"
                        className="bg-[#134686] hover:bg-[#0f3a6b] text-white border-[#134686]"
                        onClick={() => handleViewCertificate(selectedUser.certificateBuilder!)}
                      >
                        View
                      </Button>
                    </div>
                  )}
                  {selectedUser.certificateRepair && (
                    <div className="flex items-center gap-3">
                      <Input
                        value="Repair Certificate"
                        readOnly
                        className="bg-gray-20 flex-1"
                      />
                      <Button
                        size="sm"
                        className="bg-[#134686] hover:bg-[#0f3a6b] text-white border-[#134686]"
                        onClick={() => handleViewCertificate(selectedUser.certificateRepair!)}
                      >
                        View
                      </Button>
                    </div>
                  )}
                  {selectedUser.certificateOther && (
                    <div className="flex items-center gap-3">
                      <Input
                        value="Other Certificate"
                        readOnly
                        className="bg-gray-20 flex-1"
                      />
                      <Button
                        size="sm"
                        className="bg-[#134686] hover:bg-[#0f3a6b] text-white border-[#134686]"
                        onClick={() => handleViewCertificate(selectedUser.certificateOther!)}
                      >
                        View
                      </Button>
                    </div>
                  )}
                  {!selectedUser.certificateBuilder && !selectedUser.certificateRepair && !selectedUser.certificateOther && (
                    <Input
                      value="No certificates available"
                      readOnly
                      className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium text-black mb-1 block">Status</Label>
                  <Input
                    value={selectedUser.status.charAt(0).toUpperCase() + selectedUser.status.slice(1).toLowerCase()}
                    readOnly
                    className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box text-black font-medium"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-black mb-1 block">Registration Date</Label>
                  <Input
                    value={new Date(selectedUser.createdAt).toLocaleDateString()}
                    readOnly
                    className="bg-gray-20 border-gray-400 focus:border-gray-600 border-box"
                  />
                </div>
              </div>
            </div>
          )}

          {selectedUser?.status !== 'ACTIVE' && selectedUser?.status !== 'REJECTED' && selectedUser?.status !== 'SUSPENDED' && (
            <DialogFooter className="flex justify-center">
              <div className="flex gap-3">
                <Button className="bg-red-600 hover:bg-red-700 text-white border-red-600" onClick={handleRejectClick}>
                  Reject
                </Button>
                <Button className="bg-green-600 hover:bg-green-700 text-white border-green-600" onClick={handleApproveClick}>
                  Approve
                </Button>
              </div>
            </DialogFooter>
          )}

          {selectedUser?.status === 'SUSPENDED' && (
            <DialogFooter className="flex justify-center">
              <div className="flex gap-3">
                <Button className="bg-green-600 hover:bg-green-700 text-white border-green-600" onClick={handleUnsuspendClick}>
                  Unsuspend Account
                </Button>
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Approval Confirmation Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setApproveDialogOpen(false)
          setEditDialogOpen(true)
          setIsApproving(false)
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#134686]">Confirm Approval</DialogTitle>
            <DialogDescription>
              Please confirm that you have reviewed all the user&apos;s documents and information.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-sm text-gray-600">
              Have you already reviewed the documents and verified the user&apos;s information?
            </p>
          </div>

          <DialogFooter className="flex justify-center">
            <div className="flex gap-3">
              <Button className="bg-gray-500 hover:bg-gray-600 text-white border-gray-500" onClick={handleApproveCancel}>
                Cancel
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700 text-white border-green-600 disabled:opacity-50 disabled:cursor-not-allowed" 
                onClick={handleApproveConfirm}
                disabled={isApproving}
              >
                {isApproving ? "Approve..." : "Approve"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setRejectDialogOpen(false)
          setEditDialogOpen(true)
          setIsRejecting(false)
          setRejectionReason("")
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#134686]">Reject User Application</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this user&apos;s application. This reason will be sent to the user via email.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-black mb-2 block">
                  User Information
                </Label>
                <div className="bg-gray-50 p-3 rounded border">
                  <p className="text-sm"><strong>Name:</strong> {selectedUser?.role === 'SHIPOWNER' ? selectedUser?.fullName : selectedUser?.shipyardName}</p>
                  <p className="text-sm"><strong>Email:</strong> {selectedUser?.email}</p>
                  <p className="text-sm"><strong>Role:</strong> {selectedUser?.role}</p>
                </div>
              </div>
              
              <div>
                <Label htmlFor="rejection-reason" className="text-sm font-medium text-black mb-2 block">
                  Rejection Reason *
                </Label>
                <textarea
                  id="rejection-reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide a clear reason for rejection. This will be sent to the user..."
                  className="w-full h-24 p-3 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-[#134686] focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  This reason will be included in the rejection email sent to the user.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-center">
            <div className="flex gap-3">
              <Button className="bg-gray-500 hover:bg-gray-600 text-white border-gray-500" onClick={handleRejectCancel}>
                Cancel
              </Button>
              <Button 
                className="bg-red-600 hover:bg-red-700 text-white border-red-600 disabled:opacity-50 disabled:cursor-not-allowed" 
                onClick={handleRejectConfirm}
                disabled={isRejecting || !rejectionReason.trim()}
              >
                {isRejecting ? "Rejecting..." : "Reject & Send Email"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Suspend Confirmation Dialog */}
      <Dialog open={suspendDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setSuspendDialogOpen(false)
          setIsSuspending(false)
          setSuspensionReason("")
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#134686]">Suspend User Account</DialogTitle>
            <DialogDescription>
              Please provide a reason for suspending this user&apos;s account. This reason will be sent to the user via email.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-black mb-2 block">
                  User Information
                </Label>
                <div className="bg-gray-50 p-3 rounded border">
                  <p className="text-sm"><strong>Name:</strong> {selectedUser?.role === 'SHIPOWNER' ? selectedUser?.fullName : selectedUser?.shipyardName}</p>
                  <p className="text-sm"><strong>Email:</strong> {selectedUser?.email}</p>
                  <p className="text-sm"><strong>Role:</strong> {selectedUser?.role}</p>
                </div>
              </div>
              
              <div>
                <Label htmlFor="suspension-reason" className="text-sm font-medium text-black mb-2 block">
                  Suspension Reason *
                </Label>
                <textarea
                  id="suspension-reason"
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  placeholder="Please provide a clear reason for suspension. This will be sent to the user..."
                  className="w-full h-24 p-3 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-[#134686] focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  This reason will be included in the suspension email sent to the user.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-center">
            <div className="flex gap-3">
              <Button className="bg-gray-500 hover:bg-gray-600 text-white border-gray-500" onClick={handleSuspendCancel}>
                Cancel
              </Button>
              <Button 
                className="bg-orange-600 hover:bg-orange-700 text-white border-orange-600 disabled:opacity-50 disabled:cursor-not-allowed" 
                onClick={handleSuspendConfirm}
                disabled={isSuspending || !suspensionReason.trim()}
              >
                {isSuspending ? "Suspending..." : "Suspend & Send Email"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unsuspend Confirmation Dialog */}
      <Dialog open={unsuspendDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setUnsuspendDialogOpen(false)
          setEditDialogOpen(true)
          setIsUnsuspending(false)
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#134686]">Reactivate User Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to reactivate this user&apos;s account? The user will regain full access to Marinex services.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium text-black mb-2 block">
                  User Information
                </Label>
                <div className="bg-gray-50 p-3 rounded border">
                  <p className="text-sm"><strong>Name:</strong> {selectedUser?.role === 'SHIPOWNER' ? selectedUser?.fullName : selectedUser?.shipyardName}</p>
                  <p className="text-sm"><strong>Email:</strong> {selectedUser?.email}</p>
                  <p className="text-sm"><strong>Role:</strong> {selectedUser?.role}</p>
                  <p className="text-sm"><strong>Current Status:</strong> Suspended</p>
                </div>
              </div>
              
              <div className="bg-green-50 p-3 rounded border border-green-200">
                <p className="text-sm text-green-800">
                  <strong>Note:</strong> This action will reactivate the user&apos;s account and send them a reactivation email notification.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-center">
            <div className="flex gap-3">
              <Button className="bg-gray-500 hover:bg-gray-600 text-white border-gray-500" onClick={handleUnsuspendCancel}>
                Cancel
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700 text-white border-green-600 disabled:opacity-50 disabled:cursor-not-allowed" 
                onClick={handleUnsuspendConfirm}
                disabled={isUnsuspending}
              >
                {isUnsuspending ? "Reactivating..." : "Reactivate & Send Email"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </SidebarProvider>
  )
}
