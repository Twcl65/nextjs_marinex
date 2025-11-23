'use client'

import { useState, useEffect } from 'react'
import { MarinaSidebar } from "@/components/marina-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppHeader } from "@/components/AppHeader"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import Image from 'next/image'

// CompanyLogo component to handle S3 signed URLs
function CompanyLogo({ logoUrl, companyName }: { logoUrl?: string | null; companyName: string }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    if (logoUrl && logoUrl !== 'null' && logoUrl.trim() !== '') {
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
            setImageUrl(logoUrl) // Fallback to original URL
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
      <Avatar className='w-6 h-6'>
        <AvatarFallback>{companyName?.[0] || '?'}</AvatarFallback>
      </Avatar>
    )
  }

  return (
    <Avatar className='w-6 h-6'>
      <AvatarImage src={imageUrl} alt={companyName} />
      <AvatarFallback>{companyName?.[0] || '?'}</AvatarFallback>
    </Avatar>
  )
}

interface VesselRecertification {
  id: string
  companyName: string
  vesselName: string
  vesselImoNumber: string
  vesselPlansUrl?: string
  drydockReportUrl?: string
  drydockCertificateUrl?: string
  safetyCertificateUrl?: string
  vesselCertificateFile?: string
  status: string
  requestedDate: string
  user: {
    fullName?: string
    logoUrl?: string
  }
  vessel: {
    vesselName: string
    imoNumber: string
    shipType: string
    flag: string
    yearOfBuild: number
    lengthOverall: number
    grossTonnage: number
    vesselImageUrl?: string
    vesselCertificationExpiry?: string
  }
}

const STATUS_FILTERS = [
    { label: 'All', value: 'all' },
    { label: 'Pending', value: 'PENDING' },
    { label: 'Completed', value: 'COMPLETED' },
];

export default function VesselRecertifications() {
    const [recertifications, setRecertifications] = useState<VesselRecertification[]>([])
    const [loading, setLoading] = useState(true)
    const { toast } = useToast()

    // Pagination and filter state
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [page, setPage] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [activeRequest, setActiveRequest] = useState<VesselRecertification | null>(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [remarks, setRemarks] = useState('');

    const fetchRecertifications = async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams()
            if (statusFilter !== 'all') params.append('status', statusFilter)
            if (search) params.append('search', search)

            const response = await fetch(`/api/marina/vessel-recertifications?${params}`)
            const data = await response.json()

            if (data.success) {
                setRecertifications(data.data)
            } else {
                toast({
                    title: "Error",
                    description: "Failed to fetch vessel recertifications",
                    variant: "destructive"
                })
            }
        } catch (error) {
            console.error('Error fetching recertifications:', error)
            toast({
                title: "Error",
                description: "Failed to fetch vessel recertifications",
                variant: "destructive"
            })
        } finally {
            setLoading(false)
        }
    }

    // Filtered and searched data
    const filteredRequests = recertifications.filter(req => {
        if (statusFilter !== 'all' && req.status !== statusFilter) {
            return false
        }
        if (search) {
            const s = search.toLowerCase()
            return req.vesselName.toLowerCase().includes(s) || req.vesselImoNumber.toLowerCase().includes(s)
        }
        return true
    })

    // Pagination logic
    const totalRows = filteredRequests.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
    const paginatedRequests = filteredRequests.slice((page - 1) * rowsPerPage, page * rowsPerPage);

    // Handlers
    const handleClearFilters = () => {
        setSearch('');
        setStatusFilter('all');
        setPage(1);
    };
    const handleRowsPerPage = (val: number) => {
        setRowsPerPage(val);
        setPage(1);
    };
    const handlePageChange = (newPage: number) => {
        setPage(Math.max(1, Math.min(newPage, totalPages)));
    };

    const handleRecertificate = async (id: string, action: string) => {
        try {
            setLoading(true)
            const response = await fetch('/api/marina/vessel-recertifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ recertificateId: id, action }),
            })

            const data = await response.json()

            if (data.success) {
                toast({
                    title: "Success",
                    description: data.message,
                })
                await fetchRecertifications() // Refresh the data
            } else {
                toast({
                    title: "Error",
                    description: data.error || "Failed to process recertification",
                    variant: "destructive"
                })
            }
        } catch (error) {
            console.error('Error processing recertification:', error)
            toast({
                title: "Error",
                description: "Failed to process recertification",
                variant: "destructive"
            })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchRecertifications()
    }, [statusFilter, search])

  return (
        <ProtectedRoute allowedRoles={['MARINA']}>
    <SidebarProvider>
      <MarinaSidebar />
      <SidebarInset>
                    <AppHeader 
                        breadcrumbs={[
                            { label: "Dashboard", href: "/pages/marina" },
                            { label: "Vessel Recertifications", isCurrentPage: true }
                        ]} 
                    />
                    <h4 className="text-lg md:text-xl font-bold text-[#134686] mb-0 pl-6 pt-0">Vessel Recertifications</h4>
                    <p className="text-sm text-gray-600 mb-0 pl-6">Click the select vessel and fill in the drydock request details.</p>
                    <div className="p-4 mt-0 pl-6">
                        {/* Filter Row */}
                        <div className="flex items-center gap-3 mb-4">
                            <span className="font-medium">Status:</span>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_FILTERS.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Input
                                className="w-[220px]"
                                placeholder="Search vessel or IMO..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                            <Button
                                variant="outline"
                                className="ml-2"
                                onClick={handleClearFilters}
                            >
                                Clear Filters
                            </Button>
                        </div>
                        <Table className="border border-gray-200 rounded-sm">
                            <TableHeader className="bg-gray-50">
                                <TableRow className="border-b border-border rounded-sm">
                                    <TableHead>Company</TableHead>
                                    <TableHead>IMO Number</TableHead>
                                    <TableHead>Vessel Name</TableHead>
                                    <TableHead>Files</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                                    </TableRow>
                                ) : paginatedRequests.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center">No vessel recertification requests found.</TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedRequests.map((req) => {
                                        const files = [
                                            { name: 'Vessel Plans', url: req.vesselPlansUrl },
                                            { name: 'Drydock Report', url: req.drydockReportUrl },
                                            { name: 'Drydock Certificate', url: req.drydockCertificateUrl },
                                            { name: 'Safety Certificate', url: req.safetyCertificateUrl }
                                        ]
                                        const completedFiles = files.filter(file => file.url).length
                                        
                                        return (
                                            <TableRow key={req.id} className="border-b last:border-0 border-border">
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <CompanyLogo logoUrl={req.user.logoUrl} companyName={req.companyName} />
                                                        <span>{req.companyName}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{req.vesselImoNumber}</TableCell>
                                                <TableCell>{req.vesselName}</TableCell>
                                                <TableCell>
                                                    {completedFiles === 4 ? (
                                                        <Badge className="bg-green-100 text-green-700 font-semibold" variant="secondary">Completed 4/4</Badge>
                                                    ) : (
                                                        <Badge className="bg-gray-100 text-gray-700" variant="secondary">Completed {completedFiles}/4</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge 
                                                        className={`${
                                                            req.status === 'COMPLETED' 
                                                                ? 'bg-green-100 text-green-800 border-green-200' 
                                                                : req.status === 'REJECTED'
                                                                ? 'bg-red-100 text-red-800 border-red-200'
                                                                : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                                                        } rounded-full px-1 py-1 text-sm font-medium`}
                                                    >
                                                        {req.status === 'COMPLETED' ? 'Completed' : 
                                                         req.status === 'REJECTED' ? 'Rejected' : 
                                                         req.status === 'PENDING' ? 'Pending' : req.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {req.status === 'COMPLETED' && req.vesselCertificateFile ? (
                                                        <Button 
                                                            variant="default" 
                                                            size="sm"
                                                            className="bg-black text-white hover:bg-gray-800"
                                                            onClick={async () => {
                                                                try {
                                                                    // Try to open the existing URL first
                                                                    if (!req.vesselCertificateFile) {
                                                                        toast({
                                                                            title: "Error",
                                                                            description: "No certificate file available",
                                                                            variant: "destructive"
                                                                        })
                                                                        return
                                                                    }
                                                                    const response = await fetch(req.vesselCertificateFile, { method: 'HEAD' })
                                                                    if (response.ok) {
                                                                        window.open(req.vesselCertificateFile, '_blank')
                                                                    } else {
                                                                        // If the URL is expired, generate a new one
                                                                        const refreshResponse = await fetch('/api/marina/generate-signed-url', {
                                                                            method: 'POST',
                                                                            headers: { 'Content-Type': 'application/json' },
                                                                            body: JSON.stringify({ recertificateId: req.id })
                                                                        })
                                                                        const refreshData = await refreshResponse.json()
                                                                        if (refreshData.success) {
                                                                            window.open(refreshData.data.signedUrl, '_blank')
                                                                            // Update the local state
                                                                            setRecertifications(prev => prev.map(r => 
                                                                                r.id === req.id 
                                                                                    ? { ...r, vesselCertificateFile: refreshData.data.signedUrl }
                                                                                    : r
                                                                            ))
                                                                        } else {
                                                                            toast({
                                                                                title: "Error",
                                                                                description: "Failed to access certificate",
                                                                                variant: "destructive"
                                                                            })
                                                                        }
                                                                    }
                                                                } catch (error) {
                                                                    // If there's an error, try to generate a new signed URL
                                                                    try {
                                                                        const refreshResponse = await fetch('/api/marina/generate-signed-url', {
                                                                            method: 'POST',
                                                                            headers: { 'Content-Type': 'application/json' },
                                                                            body: JSON.stringify({ recertificateId: req.id })
                                                                        })
                                                                        const refreshData = await refreshResponse.json()
                                                                        if (refreshData.success) {
                                                                            window.open(refreshData.data.signedUrl, '_blank')
                                                                            setRecertifications(prev => prev.map(r => 
                                                                                r.id === req.id 
                                                                                    ? { ...r, vesselCertificateFile: refreshData.data.signedUrl }
                                                                                    : r
                                                                            ))
                                                                        } else {
                                                                            throw new Error('Failed to generate new URL')
                                                                        }
                                                                    } catch (refreshError) {
                                                                        toast({
                                                                            title: "Error",
                                                                            description: "Failed to access certificate",
                                                                            variant: "destructive"
                                                                        })
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            View PDF
                                                        </Button>
                                                    ) : req.status === 'REJECTED' ? (
                                                        <span className="text-red-500 font-semibold">Rejected</span>
                                                    ) : (
                                                        <Dialog open={dialogOpen && activeRequest?.id === req.id} onOpenChange={open => { setDialogOpen(open); if (!open) setActiveRequest(null); }}>
                                                            <Button 
                                                                variant="default" 
                                                                size="sm" 
                                                                className="bg-black text-white hover:bg-gray-800"
                                                                onClick={() => { setActiveRequest(req); setDialogOpen(true); }}
                                                            >
                                                                Recertificate
                                                            </Button>
                                                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                                                                <DialogHeader>
                                                                    <DialogTitle>Recertificate Vessel</DialogTitle>
                                                                    <p className="text-sm text-gray-500 mt-1">View the vessel details and certification files before proceeding with recertification or rejection.</p>
                                                                </DialogHeader>
                                                                <div className="space-y-4">
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div>
                                                                            <label className="block text-xs font-medium mb-1">Company Name</label>
                                                                            <Input value={req.companyName} readOnly className="bg-white w-full" />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-xs font-medium mb-1">IMO Number</label>
                                                                            <Input value={req.vesselImoNumber} readOnly className="bg-white w-full" />
                                                                        </div>
                                                                        <div className="col-span-2">
                                                                            <label className="block text-xs font-medium mb-1">Vessel Name</label>
                                                                            <Input value={req.vesselName} readOnly className="bg-white w-full" />
                                                                        </div>
                                                                    </div>
                                                                    {/* Vessel Details Section */}
                                                                    <div className="grid grid-cols-3 gap-4">
                                                                        <div>
                                                                            <label className="block text-xs font-medium mb-1">Ship Type</label>
                                                                            <Input value={req.vessel.shipType || ''} readOnly className="bg-white w-full" />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-xs font-medium mb-1">Flag</label>
                                                                            <Input value={req.vessel.flag || ''} readOnly className="bg-white w-full" />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-xs font-medium mb-1">Year of Build</label>
                                                                            <Input value={req.vessel.yearOfBuild?.toString() || ''} readOnly className="bg-white w-full" />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-xs font-medium mb-1">Vessel Certificate Expiration</label>
                                                                            <Input value={req.vessel.vesselCertificationExpiry ? new Date(req.vessel.vesselCertificationExpiry).toLocaleDateString() : ''} readOnly className="bg-white w-full" />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-xs font-medium mb-1">Length Overall (m)</label>
                                                                            <Input value={req.vessel.lengthOverall?.toString() || ''} readOnly className="bg-white w-full" />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-xs font-medium mb-1">Beam (m)</label>
                                                                            <Input value="32" readOnly className="bg-white w-full" />
                                                                        </div>
                                                                        <div>
                                                                            <label className="block text-xs font-medium mb-1">Gross Tonnage</label>
                                                                            <Input value={req.vessel.grossTonnage?.toString() || ''} readOnly className="bg-white w-full" />
                                                                        </div>
                                                                    </div>
                                                                    {/* Files Section */}
                                                                    <div>
                                                                        <label className="block text-xs font-medium mb-2">Files</label>
                                                                        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                                                                            <div className="flex flex-col gap-0.5">
                                                                                <span className="text-xs font-semibold mb-0.5">Vessel Plans</span>
                                                                                {req.vesselPlansUrl ? (
                                                                                    <a href={req.vesselPlansUrl} target="_blank" rel="noopener noreferrer"
                                                                                        className="bg-white border border-gray-200 rounded px-3 py-2 text-xs w-full block cursor-pointer hover:bg-gray-50 transition">
                                                                                        View File
                                                                                    </a>
                                                                                ) : (
                                                                                    <span className="bg-white border border-gray-200 rounded px-3 py-2 text-xs w-full block text-gray-400">No file</span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex flex-col gap-0.5">
                                                                                <span className="text-xs font-semibold mb-0.5">Drydock Report</span>
                                                                                {req.drydockReportUrl ? (
                                                                                    <a href={req.drydockReportUrl} target="_blank" rel="noopener noreferrer"
                                                                                        className="bg-white border border-gray-200 rounded px-3 py-2 text-xs w-full block cursor-pointer hover:bg-gray-50 transition">
                                                                                        View File
                                                                                    </a>
                                                                                ) : (
                                                                                    <span className="bg-white border border-gray-200 rounded px-3 py-2 text-xs w-full block text-gray-400">No file</span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex flex-col gap-0.5">
                                                                                <span className="text-xs font-semibold mb-0.5">Drydock Certificate</span>
                                                                                {req.drydockCertificateUrl ? (
                                                                                    <a href={req.drydockCertificateUrl} target="_blank" rel="noopener noreferrer"
                                                                                        className="bg-white border border-gray-200 rounded px-3 py-2 text-xs w-full block cursor-pointer hover:bg-gray-50 transition">
                                                                                        View File
                                                                                    </a>
                                                                                ) : (
                                                                                    <span className="bg-white border border-gray-200 rounded px-3 py-2 text-xs w-full block text-gray-400">No file</span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex flex-col gap-0.5">
                                                                                <span className="text-xs font-semibold mb-0.5">Safety Certificate</span>
                                                                                {req.safetyCertificateUrl ? (
                                                                                    <a href={req.safetyCertificateUrl} target="_blank" rel="noopener noreferrer"
                                                                                        className="bg-white border border-gray-200 rounded px-3 py-2 text-xs w-full block cursor-pointer hover:bg-gray-50 transition">
                                                                                        View File
                                                                                    </a>
                                                                                ) : (
                                                                                    <span className="bg-white border border-gray-200 rounded px-3 py-2 text-xs w-full block text-gray-400">No file</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <DialogFooter>
                                                                    <Button variant="outline" onClick={() => { setDialogOpen(false); setRejectOpen(true); }}>Reject</Button>
                                                                    <Button variant="default" onClick={e => { e.preventDefault(); setDialogOpen(false); setConfirmOpen(true); }}>Recertificate</Button>
                                                                </DialogFooter>
                                                            </DialogContent>
                                                        </Dialog>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                        {/* Pagination Controls and row count below table */}
                        <div className="flex flex-wrap items-center justify-between mt-2 text-sm ">
                            <div className='text-sm text-gray-500'>
                                {totalRows === 0 ? '0' : `${(page - 1) * rowsPerPage + 1} - ${Math.min(page * rowsPerPage, totalRows)}`} of {totalRows} row(s)
                            </div>
                            <div className="flex items-center gap-2">
                                <span>Rows per page</span>
                                <select
                                    className="border rounded px-2 py-1"
                                    value={rowsPerPage}
                                    onChange={e => handleRowsPerPage(Number(e.target.value))}
                                >
                                    {[5, 10, 25, 50].map(n => (
                                        <option key={n} value={n}>{n}</option>
                                    ))}
                                </select>
                                <Button variant="ghost" size="icon" onClick={() => handlePageChange(page - 1)} disabled={page === 1}><ChevronLeft /></Button>
                                <span className="px-2">Page {page} of {totalPages}</span>
                                <Button variant="ghost" size="icon" onClick={() => handlePageChange(page + 1)} disabled={page === totalPages}><ChevronRight /></Button>
                            </div>
          </div>
          </div>
                    
                    {/* Reject Dialog */}
                    <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Reject Recertification</DialogTitle>
                                <p className="text-sm text-gray-500 mb-0 pb-0">Please provide a reason for rejecting this recertification.</p>
                            </DialogHeader>
                            <div className="py-2 pt-0 mt-0">
                                <label className="block text-sm font-medium mb-1">Remarks</label>
                                <textarea
                                    value={remarks}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRemarks(e.target.value)}
                                    placeholder="Enter remarks for rejection..."
                                    className="w-full min-h-[80px] border rounded px-3 py-2 bg-white"
                                />
        </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
                                <Button
                                    variant="destructive"
                                    disabled={loading}
                                    onClick={async () => {
                                        setLoading(true);
                                        try {
                                            await handleRecertificate(activeRequest?.id || '', 'reject');
                                            setRejectOpen(false);
                                            setRemarks('');
                                        } catch (e) {
                                            setLoading(false);
                                        }
                                    }}
                                >
                                    Reject
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    
                    {/* Confirm Dialog */}
                    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Confirm Recertification</DialogTitle>
                            </DialogHeader>
                            <div className="py-2 text-sm">Are you sure you want to approve and recertificate this vessel?</div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
                                <Button variant="default" disabled={loading} onClick={async () => {
                                    setLoading(true);
                                    try {
                                        await handleRecertificate(activeRequest?.id || '', 'recertificate');
                                        setConfirmOpen(false);
                                        setDialogOpen(false);
                                    } catch (e) {
                                        setLoading(false);
                                    }
                                }}>Confirm</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
      </SidebarInset>
    </SidebarProvider>
        </ProtectedRoute>
    );
}