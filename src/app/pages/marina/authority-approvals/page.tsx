"use client"

import { MarinaSidebar } from "@/components/marina-sidebar"
import { AppHeader } from "@/components/AppHeader"
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
import { NotificationDropdown } from "@/components/NotificationDropdown"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useState, useEffect, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import { CheckCircle, XCircle, FileText, Clock, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react"

interface AuthorityRequest {
  id: string;
  status: string;
  requestDate: string;
  finalScopeOfWorkUrl?: string;
  authorityCertificate?: string;
  createdAt: string;
  updatedAt: string;
  drydockRequestId: string;
  requestStatus: string;
  vesselName: string;
  imoNumber: string;
  companyName: string;
  flag: string;
  shipType: string;
  priorityLevel: string;
  requestCreatedAt: string;
  drydockBookingId: string;
  bookingStatus: string;
  bookingDate: string;
  userId: string;
  fullName: string;
  email: string;
  contactNumber: string;
}

export default function AuthorityApprovalsPage() {
  const { toast } = useToast()
  const [authorityRequests, setAuthorityRequests] = useState<AuthorityRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedRequest, setSelectedRequest] = useState<AuthorityRequest | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(5)

  // Fetch authority requests
  const fetchAuthorityRequests = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/marina/authority-requests?status=${statusFilter}`)
      if (response.ok) {
        const data = await response.json()
        setAuthorityRequests(data.authorityRequests || [])
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch authority requests",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error fetching authority requests:', error)
      toast({
        title: "Error",
        description: "Error loading authority requests",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [statusFilter, toast])

  useEffect(() => {
    fetchAuthorityRequests()
  }, [fetchAuthorityRequests])

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter])

  // Filter requests
  const filteredRequests = authorityRequests.filter(request => {
    if (statusFilter !== 'all' && request.status !== statusFilter) return false;
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredRequests.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentRequests = filteredRequests.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Handle approve request with certificate generation
  const handleApproveRequest = async () => {
    if (!selectedRequest) return

    setIsGenerating(true)
    try {
      const response = await fetch('/api/marina/authority-requests', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          status: 'APPROVED',
          generateCertificate: true
        })
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Authority request approved and certificate generated successfully",
          variant: "default"
        })
        setShowConfirmationDialog(false)
        setSelectedRequest(null)
        await fetchAuthorityRequests()
      } else {
        const errorData = await response.json()
        toast({
          title: "Error",
          description: errorData.error || "Failed to approve authority request",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('Error approving request:', error)
      toast({
        title: "Error",
        description: "Error approving authority request",
        variant: "destructive"
      })
    } finally {
      setIsGenerating(false)
    }
  }

  // Get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'default'
      case 'REJECTED':
        return 'destructive'
      case 'ISSUED':
        return 'secondary'
      case 'PENDING':
        return 'outline'
      case 'REQUESTED':
        return 'outline'
      default:
        return 'outline'
    }
  }

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircle className="h-4 w-4" />
      case 'REJECTED':
        return <XCircle className="h-4 w-4" />
      case 'ISSUED':
        return <FileText className="h-4 w-4" />
      case 'PENDING':
        return <Clock className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  return (
    <SidebarProvider>
      <MarinaSidebar />
      <SidebarInset>

<AppHeader 
          breadcrumbs={[
            { label: "Dashboard", href: "/pages/marina" },
            { label: "Authority Approvals", isCurrentPage: true }
          ]} 
        />
        
        <div className="p-5 pt-0 mt-0">
          <div className="flex justify-between items-center">
            <div className="pt-5">
              <h1 className="text-xl md:text-xl font-bold text-[#134686]">Authority Approvals</h1>
              <p className="text-sm text-muted-foreground mt-1">Review and approve drydock authority requests from shipowners.</p>
            </div>
            <Button 
              onClick={() => {
                setLoading(true);
                fetchAuthorityRequests();
              }}
              variant="outline"
            >
              Refresh
            </Button>
          </div>
        </div>
        <div className="px-6 flex flex-row items-center gap-4 mb-0 mt-0">
              <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Filter by status:</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
                  </SelectTrigger>
              <SelectContent className='bg-white border-gray-300'>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="REQUESTED">Requested</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                    <SelectItem value="ISSUED">Issued</SelectItem>
                  </SelectContent>
                </Select>
            </div>
          </div>

        <div className="p-6">
            {loading ? (
            <div className="text-center py-8 text-gray-500">Loading authority requests...</div>
          ) : authorityRequests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-lg font-medium mb-2">No authority requests found</div>
              <div className="text-sm">There are currently no authority requests available.</div>
              </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-lg font-medium mb-2">No requests match your filters</div>
              <div className="text-sm">Try adjusting your status filter.</div>
              <div className="text-sm mt-2">Total requests available: {authorityRequests.length}</div>
              </div>
            ) : (
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="min-w-[120px] py-3 text-left font-semibold text-gray-900">Company</TableHead>
                      <TableHead className="min-w-[120px] py-3 text-left font-semibold text-gray-900">Vessel Name</TableHead>
                      <TableHead className="min-w-[120px] py-3 text-left font-semibold text-gray-900">IMO Number</TableHead>
                      <TableHead className="w-24 py-3 text-center font-semibold text-gray-900">Priority</TableHead>
                      <TableHead className="w-24 py-3 text-center font-semibold text-gray-900">Status</TableHead>
                      <TableHead className="min-w-[120px] py-3 text-left font-semibold text-gray-900">Request Date</TableHead>
                      <TableHead className="w-36 py-3 text-center font-semibold text-gray-900">Authority Files</TableHead>
                      <TableHead className="w-24 py-3 text-center font-semibold text-gray-900">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {currentRequests.map((request) => (
                      <TableRow key={request.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <TableCell className="py-3 text-left">
                          <div className="font-normal text-gray-900">{request.companyName}</div>
                      </TableCell>
                        <TableCell className="py-3 text-left">
                          <div className="font-normal text-gray-900">{request.vesselName}</div>
                      </TableCell>
                        <TableCell className="py-3 text-left">
                          <div className="text-sm text-gray-900">{request.imoNumber}</div>
                      </TableCell>
                        <TableCell className="py-3 text-center">
                          <Badge 
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                              request.priorityLevel === 'NORMAL' ? 'bg-green-100 text-green-700 border-green-200' : 
                              request.priorityLevel === 'EMERGENCY' ? 'bg-red-100 text-red-700 border-red-200' : 
                              'bg-gray-100 text-gray-700 border-gray-200'
                            }`}
                          >
                            {request.priorityLevel === 'NORMAL' ? 'Normal' : 
                             request.priorityLevel === 'EMERGENCY' ? 'Emergency' : 
                             request.priorityLevel}
                        </Badge>
                      </TableCell>
                        <TableCell className="py-3 text-center">
                          <Badge 
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                              request.status === 'APPROVED' ? 'bg-green-100 text-green-700 border-green-200' :
                              request.status === 'REJECTED' ? 'bg-red-100 text-red-700 border-red-200' :
                              request.status === 'ISSUED' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                              'bg-yellow-100 text-yellow-700 border-yellow-200'
                            }`}
                          >
                            {request.status === 'PENDING' ? 'Pending' :
                             request.status === 'REQUESTED' ? 'Requested' :
                             request.status === 'APPROVED' ? 'Approved' :
                             request.status === 'REJECTED' ? 'Rejected' :
                             request.status === 'ISSUED' ? 'Issued' :
                             request.status}
                        </Badge>
                      </TableCell>
                        <TableCell className="py-3 text-left">
                          <span className="text-sm text-gray-900">
                            {new Date(request.requestDate).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell className="py-3 text-center">
                          {request.status === 'APPROVED' && request.authorityCertificate ? (
                          <Button
                            variant="outline"
                            size="sm"
                              className="text-xs cursor-pointer bg-red-100 text-red-700 border-red-200 hover:bg-red-200 hover:text-red-800"
                              onClick={async () => {
                                if (!request.authorityCertificate) {
                                  console.error('No certificate URL available')
                                  return
                                }
                                try {
                                  const response = await fetch(`/api/view-certificate?url=${encodeURIComponent(request.authorityCertificate!)}`)
                                  if (response.ok) {
                                    const data = await response.json()
                                    window.open(data.signedUrl, '_blank')
                                  } else {
                                    console.error('Failed to generate signed URL')
                                  }
                                } catch (error) {
                                  console.error('Error opening certificate:', error)
                                }
                              }}
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              View PDF
                          </Button>
                        ) : (
                            <span className="text-xs text-gray-400">No PDF Yet</span>
                        )}
                      </TableCell>
                        <TableCell className="py-3 text-center">
                          {request.status === 'APPROVED' ? (
                            <span className="text-xs font-medium text-gray-500">Closed</span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0 bg-[#134686] border-[#134686] hover:bg-[#0f3a6e] hover:border-[#0f3a6e]"
                              onClick={() => {
                                setSelectedRequest(request)
                                setShowDetailsDialog(true)
                              }}
                            >
                              <CheckCircle className="h-4 w-4 text-white" />
                            </Button>
                          )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
          )}

          {/* Pagination Controls */}
          {!loading && filteredRequests.length > 0 && (
            <div className="flex flex-wrap items-center justify-between text-sm px-0 mt-4">
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

        {/* Details Dialog */}
        <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-[#134686]">Authority Request Details</DialogTitle>
              <DialogDescription>
                View detailed information about this authority request.
              </DialogDescription>
            </DialogHeader>
            
            {selectedRequest && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="requestDate" className="text-sm font-medium">Request Date</Label>
                    <Input
                      id="requestDate"
                      value={new Date(selectedRequest.requestDate).toLocaleDateString()}
                      readOnly
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="status" className="text-sm font-medium">Status</Label>
                    <div className="mt-1">
                    <Badge variant={getStatusBadgeVariant(selectedRequest.status)} className="flex items-center gap-1 w-fit">
                      {getStatusIcon(selectedRequest.status)}
                      {selectedRequest.status}
                    </Badge>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="company" className="text-sm font-medium">Company</Label>
                    <Input
                      id="company"
                      value={selectedRequest.companyName}
                      readOnly
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactPerson" className="text-sm font-medium">Contact Person</Label>
                    <Input
                      id="contactPerson"
                      value={selectedRequest.fullName}
                      readOnly
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="vesselName" className="text-sm font-medium">Vessel Name</Label>
                    <Input
                      id="vesselName"
                      value={selectedRequest.vesselName}
                      readOnly
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="imoNumber" className="text-sm font-medium">IMO Number</Label>
                    <Input
                      id="imoNumber"
                      value={selectedRequest.imoNumber}
                      readOnly
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="shipType" className="text-sm font-medium">Ship Type</Label>
                    <Input
                      id="shipType"
                      value={selectedRequest.shipType}
                      readOnly
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="flag" className="text-sm font-medium">Flag</Label>
                    <Input
                      id="flag"
                      value={selectedRequest.flag}
                      readOnly
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                    <Input
                      id="email"
                      value={selectedRequest.email}
                      readOnly
                      className="mt-1"
                    />
                  </div>
                <div>
                    <Label htmlFor="phone" className="text-sm font-medium">Phone</Label>
                    <Input
                      id="phone"
                      value={selectedRequest.contactNumber}
                      readOnly
                      className="mt-1"
                    />
                  </div>
                </div>
                
                {selectedRequest.finalScopeOfWorkUrl && (
                  <div>
                    <Label className="text-sm font-medium">Scope of Work Document</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(selectedRequest.finalScopeOfWorkUrl, '_blank')}
                      className="mt-1"
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      View Document
                    </Button>
                  </div>
                )}
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
                Close
              </Button>
              {selectedRequest && (selectedRequest.status === 'REQUESTED' || selectedRequest.status === 'PENDING') && (
                <Button 
                  onClick={() => {
                    setShowDetailsDialog(false)
                    setShowConfirmationDialog(true)
                  }}
                  className="bg-green-500 hover:bg-green-700 text-white cursor-pointer"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmation Dialog */}
        <Dialog open={showConfirmationDialog} onOpenChange={setShowConfirmationDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm Approval</DialogTitle>
              <DialogDescription>
                Are you sure you want to approve this authority request and generate the certificate?
              </DialogDescription>
            </DialogHeader>
            
            {selectedRequest && (
              <div className="space-y-4">
               
               
              </div>
            )}
            
            <DialogFooter className="gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowConfirmationDialog(false)}
                disabled={isGenerating}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleApproveRequest}
                disabled={isGenerating}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Generating...
                  </>
                ) : (
                  <>
                <CheckCircle className="h-4 w-4 mr-1" />
                    Approve Request
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
}
