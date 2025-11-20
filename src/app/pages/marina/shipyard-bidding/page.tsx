"use client";

import React, { useEffect, useState } from 'react';
import { MarinaSidebar } from "@/components/marina-sidebar"
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, ChevronLeft, ChevronRight, ChevronRight as ArrowRight, Check } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

// ShipyardLogo component to handle S3 signed URLs
function ShipyardLogo({ logoUrl, shipyardName }: { logoUrl: string; shipyardName: string }) {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [imageError, setImageError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // Reset states when logoUrl changes
        setImageUrl(null);
        setImageError(false);
        setIsLoading(false);

        if (logoUrl) {
            setIsLoading(true);
            
            // Check if it's an S3 URL or contains amazonaws
            if (logoUrl.includes('s3.amazonaws.com') || logoUrl.includes('amazonaws.com')) {
                // Fetch signed URL for S3 images
                fetch(`/api/signed-url?url=${encodeURIComponent(logoUrl)}`)
                    .then(res => {
                        if (!res.ok) {
                            throw new Error('Failed to fetch signed URL');
                        }
                        return res.json();
                    })
                    .then(data => {
                        if (data.signedUrl) {
                            setImageUrl(data.signedUrl);
                            setIsLoading(false);
                        } else {
                            // Fallback to original URL if no signedUrl
                            console.warn('No signedUrl in response, using original URL');
                            setImageUrl(logoUrl);
                            setIsLoading(false);
                        }
                    })
                    .catch(err => {
                        console.error('Error fetching signed URL:', err);
                        // Fallback to original URL
                        setImageUrl(logoUrl);
                        setIsLoading(false);
                    });
            } else {
                // For non-S3 URLs, use directly
                setImageUrl(logoUrl);
                setIsLoading(false);
            }
        }
    }, [logoUrl]);

    // Show loading state
    if (isLoading) {
        return (
            <div className="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center animate-pulse">
                <span className="text-gray-400 text-xs font-medium">
                    {shipyardName.charAt(0).toUpperCase()}
                </span>
            </div>
        );
    }

    // Show error/fallback state
    if (imageError || !imageUrl) {
        return (
            <div className="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center">
                <span className="text-gray-400 text-xs font-medium">
                    {shipyardName.charAt(0).toUpperCase()}
                </span>
            </div>
        );
    }

    return (
        <Image 
            src={imageUrl} 
            alt={`${shipyardName} logo`}
            width={48}
            height={48}
            className="w-12 h-12 rounded-full object-cover border border-gray-200"
            onError={() => {
                console.error('Image failed to load:', imageUrl);
                setImageError(true);
            }}
            onLoad={() => setIsLoading(false)}
        />
    );
}

interface Vessel {
    id: string;
    name: string;
    imo_number: string;
    ship_type: string;
    flag: string;
    length_overall?: number | null;
    gross_tonnage?: number | null;
    picture?: string | null;
}

interface DrydockRequest {
    id: string;
    vessel_id: string;
    services_needed: string[] | string;
    priority_level: string;
    scope_of_work: string | null;
    status: string;
    request_date: string;
    created_at: string;
    vessel: Vessel;
    company_logo?: string | null;
    company_name?: string | null;
    company_location?: string | null;
}

interface Bidder {
    id: string;
    shipyard_name: string;
    shipyard_logo?: string | null;
    certificate_builder?: string | null;
    certificate_repair?: string | null;
    certificate_other?: string | null;
    bid_certificate_url?: string | null;
    total_bid: number;
    total_days: number;
    parallel_days?: number;
    sequential_days?: number;
    services_offered: string[];
    bid_date: string;
    status: string;
}

interface ShipyardInfo {
    id: string;
    shipyard_name: string;
    shipyard_logo?: string | null;
    shipyard_address?: string | null;
    shipyard_contact_number?: string | null;
    shipyard_contact_person?: string | null;
    shipyard_business_reg?: string | null;
    certificate_builder?: string | null;
    certificate_repair?: string | null;
    certificate_other?: string | null;
}

// Helper to get services with area data
function getServicesWithArea(selectedRequest: DrydockRequest): Array<{name: string, area: number}> {
    if (!selectedRequest) return [];
    let services: Array<{name: string, area: number}> = [];

    if (Array.isArray(selectedRequest.services_needed)) {
        services = selectedRequest.services_needed.map((s: { name: string; area: number } | string) => {
            if (typeof s === 'object' && s.name && s.area) {
                return { name: s.name, area: s.area };
            } else if (typeof s === 'string') {
                return { name: s, area: 0 };
            }
            return { name: String(s), area: 0 };
        });
    } else if (typeof selectedRequest.services_needed === 'string') {
        const str = selectedRequest.services_needed.trim();
        if (str.startsWith('[') && str.endsWith(']')) {
            try {
                const parsed = JSON.parse(str);
                if (Array.isArray(parsed)) {
                    services = parsed.map((s: { name: string; area: number } | string) => {
                        if (typeof s === 'object' && s.name && s.area) {
                            return { name: s.name, area: s.area };
                        } else if (typeof s === 'string') {
                            return { name: s, area: 0 };
                        }
                        return { name: String(s), area: 0 };
                    });
                } else if (typeof parsed === 'string') {
                    services = [{ name: parsed, area: 0 }];
                }
            } catch (error) {
                console.error('Error parsing services JSON:', error);
                services = [{ name: str, area: 0 }];
            }
        } else if (str.includes(',')) {
            services = str.split(',').map(s => ({ name: s.trim(), area: 0 })).filter(s => s.name);
        } else {
            services = [{ name: str, area: 0 }];
        }
    }

    return services.filter(s => s.name.trim());
}

// Helper function to get normalized services
function getNormalizedNeededServices(selectedRequest: DrydockRequest): string[] {
    return getServicesWithArea(selectedRequest).map((s: {name: string, area: number}) => s.name);
}

export default function ShipyardBiddingPage() {
    const [drydockRequests, setDrydockRequests] = useState<DrydockRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [priorityFilter, setPriorityFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(5);
    const [openBiddersDialog, setOpenBiddersDialog] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<DrydockRequest | null>(null);
    const [bidders, setBidders] = useState<Bidder[]>([]);
    const [loadingBidders, setLoadingBidders] = useState(false);
    const [openShipyardDialog, setOpenShipyardDialog] = useState(false);
    const [selectedShipyard, setSelectedShipyard] = useState<Bidder | null>(null);
    const [shipyardInfo, setShipyardInfo] = useState<ShipyardInfo | null>(null);
    const [loadingShipyardInfo, setLoadingShipyardInfo] = useState(false);
    const [openRecommendDialog, setOpenRecommendDialog] = useState(false);
    const [selectedBidders, setSelectedBidders] = useState<string[]>([]);
    const [loadingRecommend, setLoadingRecommend] = useState(false);
    const { toast } = useToast();

    const fetchDrydockRequests = async () => {
        try {
            console.log('Fetching drydock requests from marina API...');
            const response = await fetch('/api/marina/drydock-requests');
            console.log('API response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('API response data:', data);
                console.log('Number of drydock requests:', data.drydockRequests?.length || 0);
                
                setDrydockRequests(data.drydockRequests || []);
            } else {
                console.error('API response not ok:', response.status, response.statusText);
            }
        } catch (error) {
            console.error('Error fetching drydock requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchBidders = async (requestId: string) => {
        setLoadingBidders(true);
        try {
            const response = await fetch(`/api/marina/bidders?drydockRequestId=${requestId}`);
            if (response.ok) {
                const data = await response.json();
                setBidders(data.bidders || []);
            } else {
                const errorData = await response.json();
                console.error('Failed to fetch bidders:', response.status, errorData);
                setBidders([]);
            }
        } catch (error) {
            console.error('Error fetching bidders:', error);
            setBidders([]);
        } finally {
            setLoadingBidders(false);
        }
    };

    useEffect(() => {
        fetchDrydockRequests();
    }, []);

    // Filter requests
    const filteredRequests = drydockRequests.filter(request => {
        if (priorityFilter !== 'All' && request.priority_level !== priorityFilter) return false;
        if (statusFilter !== 'All' && request.status !== statusFilter) return false;
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

    const handleViewBidders = (request: DrydockRequest) => {
        setSelectedRequest(request);
        setOpenBiddersDialog(true);
        fetchBidders(request.id);
    };

    const fetchShipyardInfo = async (bidderId: string) => {
        try {
            setLoadingShipyardInfo(true);
            console.log('Fetching shipyard info for bidder ID:', bidderId);
            const response = await fetch(`/api/marina/shipyard-info?bidderId=${bidderId}`);
            if (!response.ok) {
                throw new Error(`API response not ok: ${response.status} "${response.statusText}"`);
            }
            const data = await response.json();
            console.log('Shipyard info response:', data);
            setShipyardInfo(data.shipyardInfo);
        } catch (error) {
            console.error('Failed to fetch shipyard info:', error);
        } finally {
            setLoadingShipyardInfo(false);
        }
    };

    const handleViewShipyardInfo = (bidder: Bidder) => {
        setSelectedShipyard(bidder);
        setOpenBiddersDialog(false); // Close bidders dialog first
        setOpenShipyardDialog(true);
        fetchShipyardInfo(bidder.id);
    };

    const handleCloseShipyardDialog = () => {
        setOpenShipyardDialog(false);
        setOpenBiddersDialog(true); // Reopen bidders dialog
    };

    const handleShipyardDialogOpenChange = (open: boolean) => {
        setOpenShipyardDialog(open);
        if (!open) {
            // If dialog is being closed (either by button or outside click), reopen bidders dialog
            setOpenBiddersDialog(true);
        }
    };

    const handleCheckboxChange = (bidderId: string, checked: boolean) => {
        if (checked) {
            setSelectedBidders(prev => [...prev, bidderId]);
        } else {
            setSelectedBidders(prev => prev.filter(id => id !== bidderId));
        }
    };

    const handleRecommendClick = () => {
        if (selectedBidders.length === 0) {
            toast({
                title: "No Selection",
                description: "Please select at least one bidder to recommend.",
                variant: "destructive",
            });
            return;
        }
        setOpenRecommendDialog(true);
    };

    const handleConfirmRecommend = async () => {
        try {
            setLoadingRecommend(true);
            
            // Update each selected bidder's status to RECOMMENDED
            const updatePromises = selectedBidders.map(bidderId => 
                fetch('/api/marina/update-bid-status', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        bidderId: bidderId,
                        status: 'RECOMMENDED'
                    })
                })
            );

            await Promise.all(updatePromises);
            
            // Update local state
            setBidders(prev => prev.map(bidder => 
                selectedBidders.includes(bidder.id) 
                    ? { ...bidder, status: 'RECOMMENDED' }
                    : bidder
            ));
            
            // Reset selection and close dialogs
            setSelectedBidders([]);
            setOpenRecommendDialog(false);
            setOpenBiddersDialog(false);
            
            toast({
                title: "Success!",
                description: `${selectedBidders.length} bidder${selectedBidders.length > 1 ? 's have' : ' has'} been successfully recommended.`,
                action: (
                    <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-green-600" />
                        </div>
                    </div>
                ),
                className: "border-green-200 bg-green-50",
            });
        } catch (error) {
            console.error('Error updating bid status:', error);
            toast({
                title: "Error",
                description: "Failed to update bid status. Please try again.",
                variant: "destructive",
            });
        } finally {
            setLoadingRecommend(false);
        }
    };

  return (
    <SidebarProvider>
      <MarinaSidebar />
      <SidebarInset>
        <header className="flex h-12 md:h-14 shrink-0 items-center gap-1 px-3 md:px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
          <div className="flex-1">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/pages/marina">Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>Shipyard Bidding</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto">
            <ProfileDropdown />
          </div>
        </header>
                <div className="p-5 pt-0 mt-0">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-lg md:text-xl font-bold text-[#134686]">Browse and Monitor Drydock Bidding</h1>
                            <p className="text-sm text-gray-500 mt-1">Browse drydock requests and view shipyard bidders for each request.</p>
                        </div>
                        <Button 
                            onClick={() => {
                                setLoading(true);
                                fetchDrydockRequests();
                            }}
                            variant="outline"
                        >
                            Refresh
                        </Button>
                    </div>
                </div>
                <div className="px-6 flex flex-row items-center gap-4 mb-0 mt-0">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">Filter by priority:</label>
                        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                            <SelectTrigger className="w-[120px]">
                                <SelectValue placeholder="Priority" />
                            </SelectTrigger>
                            <SelectContent className='bg-white border-gray-300'>
                                <SelectItem value="All">All</SelectItem>
                                <SelectItem value="NORMAL">Normal</SelectItem>
                                <SelectItem value="EMERGENCY">Emergency</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                  
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">Filter by status:</label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent className='bg-white border-gray-300'>
                                <SelectItem value="All">All</SelectItem>
                                <SelectItem value="PENDING">Pending</SelectItem>
                                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                <SelectItem value="COMPLETED">Completed</SelectItem>
                                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="p-6">
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">Loading drydock requests...</div>
                    ) : drydockRequests.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <div className="text-lg font-medium mb-2">No drydock requests found</div>
                            <div className="text-sm">There are currently no drydock requests available.</div>
                        </div>
                    ) : filteredRequests.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <div className="text-lg font-medium mb-2">No requests match your filters</div>
                            <div className="text-sm">Try adjusting your priority or status filters.</div>
                            <div className="text-sm mt-2">Total requests available: {drydockRequests.length}</div>
                        </div>
                    ) : (
                        <div className="border border-gray-300 rounded-lg overflow-hidden">
                            <div className="overflow-x-auto">
                                <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="min-w-[150px] py-3">Company</TableHead>
                                        <TableHead className="min-w-[200px] py-3">Vessel</TableHead>
                                        <TableHead className="w-20 py-3">Priority</TableHead>
                                        <TableHead className="min-w-[150px] py-3">Services Needed</TableHead>
                                        <TableHead className="min-w-[120px] py-3">Request Date</TableHead>
                                        <TableHead className="min-w-[100px] py-3">Status</TableHead>
                                        <TableHead className="w-20 py-3">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {currentRequests.map((request) => (
                                        <TableRow key={request.id}>
                                            <TableCell className="py-2">
                                                <span className="text-sm text-gray-600 truncate block max-w-[150px]" title={request.company_name || 'N/A'}>
                                                    {request.company_name || 'N/A'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="font-medium py-2">
                                                {request.vessel?.name || 'Unnamed Vessel'}
                                                {request.vessel?.imo_number && (
                                                    <span className="font-normal text-gray-500 text-sm">
                                                        (IMO: {request.vessel.imo_number})
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <Badge 
                                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                                        request.priority_level === 'NORMAL' ? 'bg-green-100 text-green-700' : 
                                                        request.priority_level === 'EMERGENCY' ? 'bg-red-100 text-red-700' : 
                                                        'bg-gray-100 text-gray-700'
                                                    }`}
                                                >
                                                    {request.priority_level === 'NORMAL' ? 'Normal' : 
                                                     request.priority_level === 'EMERGENCY' ? 'Emergency' : 
                                                     request.priority_level}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <span className="text-sm text-gray-600 truncate block max-w-[200px]" title={getNormalizedNeededServices(request).join(', ')}>
                                                    {getNormalizedNeededServices(request).length > 0 ? (
                                                        getNormalizedNeededServices(request).map(service => service.replace(/\s*-\s*\d+$/, '')).join(', ')
                                                    ) : (
                                                        'No services specified'
                                                    )}
                                                </span>
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <span className="text-sm text-gray-600">
                                                    {request.request_date ? new Date(request.request_date).toLocaleDateString() : 'N/A'}
                                                </span>
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <Badge 
                                                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                                        request.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                                        request.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                                                        request.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                                                        'bg-yellow-100 text-yellow-700'
                                                    }`}
                                                >
                                                    {request.status === 'PENDING' ? 'Pending' :
                                                     request.status === 'IN_PROGRESS' ? 'In Progress' :
                                                     request.status === 'COMPLETED' ? 'Completed' :
                                                     request.status === 'CANCELLED' ? 'Cancelled' :
                                                     request.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="bg-[#134686] text-white border-[#134686] hover:bg-[#0f3a6e] cursor-pointer hover:text-white h-8 w-8 p-0"
                                                    title="View Bidders"
                                                    onClick={() => handleViewBidders(request)}
                                                >
                                                    <Users className="h-4 w-4" />
                                                </Button>
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
      </SidebarInset>

            {/* View Bidders Dialog */}
            <Dialog open={openBiddersDialog} onOpenChange={setOpenBiddersDialog}>
                <DialogContent className="!w-[900px] !max-w-[95vw] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-[#134686] text-xl font-bold flex items-center gap-2">
                           
                            Bidders for {selectedRequest?.vessel?.name || 'Drydock Request'}
                        </DialogTitle>
                        <DialogDescription>
                            View all shipyard bidders for this drydock request.
                        </DialogDescription>
                    </DialogHeader>
                    
                    {selectedRequest && (
                        <div className="space-y-4">
                             {/* Request Details */}
                             <div className=" p-0 rounded-lg">
                               
                                 <div className="border border-gray-300 rounded-lg overflow-hidden">
                                     <Table>
                                         <TableHeader>
                                             <TableRow>
                                                 <TableHead className="py-2">Vessel Name</TableHead>
                                                 <TableHead className="py-2">Company</TableHead>
                                                 <TableHead className="py-2">Services Needed</TableHead>
                                                 <TableHead className="py-2">Priority</TableHead>
                                                 <TableHead className="py-2">Status</TableHead>
                                                 <TableHead className="py-2">Attached File</TableHead>
                                             </TableRow>
                                         </TableHeader>
                                         <TableBody>
                                             <TableRow>
                                                 <TableCell className="py-2 font-medium">
                                                     {selectedRequest.vessel?.name}
                                                     {selectedRequest.vessel?.imo_number && (
                                                         <span className="text-xs text-gray-500 text-sm block">
                                                             (IMO: {selectedRequest.vessel.imo_number})
                                                         </span>
                                                     )}
                                                 </TableCell>
                                                 <TableCell className="py-2">
                                                     {selectedRequest.company_name || 'N/A'}
                                                 </TableCell>
                                                 <TableCell className="py-2">
                                                     {getNormalizedNeededServices(selectedRequest).length > 0 ? (
                                                         <span className="text-sm">
                                                             {getNormalizedNeededServices(selectedRequest)
                                                                 .map(service => service.replace(/\s*-\s*\d+$/, ''))
                                                                 .join(', ')}
                                                         </span>
                                                     ) : (
                                                         <span className="text-gray-500 text-sm">No services specified</span>
                                                     )}
                                                 </TableCell>
                                                 <TableCell className="py-2">
                                                     <Badge 
                                                         className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                                             selectedRequest.priority_level === 'NORMAL' ? 'bg-green-100 text-green-700' : 
                                                             selectedRequest.priority_level === 'EMERGENCY' ? 'bg-red-100 text-red-700' : 
                                                             'bg-gray-100 text-gray-700'
                                                         }`}
                                                     >
                                                         {selectedRequest.priority_level === 'NORMAL' ? 'Normal' : 
                                                          selectedRequest.priority_level === 'EMERGENCY' ? 'Emergency' : 
                                                          selectedRequest.priority_level}
                                                     </Badge>
                                                 </TableCell>
                                                 <TableCell className="py-2">
                                                     <Badge 
                                                         className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                                             selectedRequest.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                                             selectedRequest.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                                                             selectedRequest.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                                                             'bg-yellow-100 text-yellow-700'
                                                         }`}
                                                     >
                                                         {selectedRequest.status === 'PENDING' ? 'Pending' :
                                                          selectedRequest.status === 'IN_PROGRESS' ? 'In Progress' :
                                                          selectedRequest.status === 'COMPLETED' ? 'Completed' :
                                                          selectedRequest.status === 'CANCELLED' ? 'Cancelled' :
                                                          selectedRequest.status}
                                                     </Badge>
                                                 </TableCell>
                                                 <TableCell className="py-2">
                                                     {selectedRequest.scope_of_work ? (
                                                         <button
                                                             onClick={async () => {
                                                                 try {
                                                                     const response = await fetch(`/api/signed-url?url=${encodeURIComponent(selectedRequest.scope_of_work || '')}`);
                                                                     const data = await response.json();
                                                                     if (data.signedUrl) {
                                                                         window.open(data.signedUrl, '_blank');
                                                                     } else {
                                                                         console.error('Failed to get signed URL');
                                                                     }
                                                                 } catch (error) {
                                                                     console.error('Error accessing document:', error);
                                                                 }
                                                             }}
                                                             className="text-blue-600 hover:text-blue-800 underline text-sm cursor-pointer"
                                                         >
                                                             View Document
                                                         </button>
                                                     ) : (
                                                         <span className="text-gray-500 text-sm">No file attached</span>
                                                     )}
                                                 </TableCell>
                                             </TableRow>
                                         </TableBody>
                                     </Table>
                                 </div>
                             </div>

                            {/* Bidders Table */}
                            <div className="space-y-3">
                                <h3 className="font-semibold text-gray-900">Shipyard Bidders</h3>
                                {loadingBidders ? (
                                    <div className="text-center py-8 text-gray-500">Loading bidders...</div>
                                ) : bidders.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                       
                                        <div className="text-lg font-medium mb-2">No bidders yet</div>
                                        <div className="text-sm">No shipyards have submitted bids for this request.</div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {bidders.map((bidder) => (
                                            <Card key={bidder.id} className="border border-gray-200 hover:shadow-xs transition-shadow">
                                                <CardHeader className="pb-0">
                                                    <div className="space-y-3">
                                                        <div className="flex items-center justify-between">
                                                            {bidder.status === 'RECOMMENDED' ? (
                                                                <Badge className="bg-green-100 text-green-700 px-2 py-0.5 text-xs font-medium">
                                                                    Recommended
                                                                </Badge>
                                                            ) : (
                                                                <div className="flex items-center space-x-2">
                                                                    <Checkbox 
                                                                        id={`recommend-${bidder.id}`}
                                                                        checked={selectedBidders.includes(bidder.id)}
                                                                        onCheckedChange={(checked) => handleCheckboxChange(bidder.id, checked as boolean)}
                                                                    />
                                                                    <label 
                                                                        htmlFor={`recommend-${bidder.id}`}
                                                                        className="text-sm font-medium text-gray-700 cursor-pointer"
                                                                    >
                                                                        Recommend
                                                                    </label>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center justify-between w-full">
                                                            <div className="flex items-center space-x-3">
                                                                {bidder.shipyard_logo ? (
                                                                    <ShipyardLogo 
                                                                        logoUrl={bidder.shipyard_logo} 
                                                                        shipyardName={bidder.shipyard_name}
                                                                    />
                                                                ) : (
                                                                    <div className="w-12 h-12 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                                                                        <span className="text-gray-400 text-xs font-medium">
                                                                            {bidder.shipyard_name.charAt(0).toUpperCase()}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <div className="text-xs font-medium text-gray-600 mb-1">Shipyard Name</div>
                                                                    <div className="text-lg font-normal text-gray-900">
                                                                        {bidder.shipyard_name}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div 
                                                                className="flex items-center justify-center w-8 h-8 border border-gray-300 rounded-full hover:border-gray-400 hover:bg-gray-50 cursor-pointer transition-colors"
                                                                onClick={() => handleViewShipyardInfo(bidder)}
                                                            >
                                                                <ArrowRight className="w-4 h-4 text-gray-600" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="space-y-1">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm font-medium text-gray-600">Total Bid:</span>
                                                        <span className="text-lg font-bold text-green-600">
                                                            ₱{bidder.total_bid.toLocaleString()}
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-sm font-medium text-gray-600">Duration:</span>
                                                        <span className="text-sm font-medium">
                                                            {bidder.total_days} days
                                                        </span>
                                                    </div>
                                                    
                                                    <div>
                                                        <span className="text-sm font-medium text-gray-600">Services Offered:</span>
                                                        <span className="text-sm ml-2">
                                                            {bidder.services_offered.join(', ')}
                                                        </span>
                                                    </div>
                                                    
                                                    
                                                    
                                                    <div className="pt-0 border-t border-gray-100">
                                                        <span className="text-xs text-gray-500">
                                                            Bid Date: {new Date(bidder.bid_date).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    
                                                    {bidder.bid_certificate_url && (
                                                        <div className="pt-2">
                                                            <Button 
                                                                size="sm"
                                                                onClick={async () => {
                                                                    try {
                                                                        const response = await fetch(`/api/signed-url?url=${encodeURIComponent(bidder.bid_certificate_url || '')}`);
                                                                        const data = await response.json();
                                                                        if (data.signedUrl) {
                                                                            window.open(data.signedUrl, '_blank');
                                                                        } else {
                                                                            console.error('Failed to get signed URL');
                                                                        }
                                                                    } catch (error) {
                                                                        console.error('Error accessing bid certificate:', error);
                                                                    }
                                                                }}
                                                                className="w-full text-xs cursor-pointer bg-[#134686] text-white hover:bg-[#0f3a6e]  hover:text-white text-white"
                                                            >
                                                                Drydock Services Bid Quotation
                                                            </Button>
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpenBiddersDialog(false)}>
                            Cancel
                        </Button>
                        <Button 
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={handleRecommendClick}
                        >
                            Recommend
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Shipyard Information Dialog */}
            <Dialog open={openShipyardDialog} onOpenChange={handleShipyardDialogOpenChange}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-gray-900">
                            Shipyard Information
                        </DialogTitle>
                        <DialogDescription>
                            Details for {selectedShipyard?.shipyard_name}
                        </DialogDescription>
                    </DialogHeader>
                    
                    {loadingShipyardInfo ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="text-gray-500">Loading shipyard information...</div>
                        </div>
                    ) : shipyardInfo ? (
                        <div className="space-y-4">
                            {/* Shipyard Header */}
                            <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                                <div className="flex-shrink-0">
                                    {shipyardInfo.shipyard_logo ? (
                                        <ShipyardLogo 
                                            logoUrl={shipyardInfo.shipyard_logo} 
                                            shipyardName={shipyardInfo.shipyard_name}
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center">
                                            <span className="text-gray-400 text-sm font-medium">
                                                {shipyardInfo.shipyard_name.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-gray-900">
                                        {shipyardInfo.shipyard_name}
                                    </h3>
                                </div>
                            </div>

                            {/* Company Information */}
                            <div className="space-y-3">
                                <h4 className="text-md font-semibold text-gray-900 border-b pb-1">
                                    Company Details
                                </h4>
                                <div className="grid grid-cols-1 gap-3">
                                    <div>
                                        <label className="text-sm font-medium text-gray-700">Shipyard Name</label>
                                        <Input 
                                            value={shipyardInfo.shipyard_name || ''} 
                                            readOnly 
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700">Address</label>
                                        <Input 
                                            value={shipyardInfo.shipyard_address || ''} 
                                            readOnly 
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700">Business Registration</label>
                                        <Input 
                                            value={shipyardInfo.shipyard_business_reg || ''} 
                                            readOnly 
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700">Contact Person</label>
                                        <Input 
                                            value={shipyardInfo.shipyard_contact_person || ''} 
                                            readOnly 
                                            className="mt-1"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700">Contact Number</label>
                                        <Input 
                                            value={shipyardInfo.shipyard_contact_number || ''} 
                                            readOnly 
                                            className="mt-1"
                                        />
                                    </div>
                                </div>
                            </div>


                            {/* Certificates */}
                            <div className="space-y-3">
                                <h4 className="text-md font-semibold text-gray-900 border-b pb-1">
                                    Certificates & Licenses
                                </h4>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-sm font-medium text-gray-700">Builder Certificate</label>
                                        <div className="flex gap-2 mt-1">
                                            <Input 
                                                value={shipyardInfo.certificate_builder || 'Not provided'} 
                                                readOnly 
                                                className="flex-1"
                                            />
                                            {shipyardInfo.certificate_builder && (
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={async () => {
                                                        try {
                                                            const response = await fetch(`/api/signed-url?url=${encodeURIComponent(shipyardInfo.certificate_builder || '')}`);
                                                            const data = await response.json();
                                                            if (data.signedUrl) {
                                                                window.open(data.signedUrl, '_blank');
                                                            } else {
                                                                console.error('Failed to get signed URL');
                                                            }
                                                        } catch (error) {
                                                            console.error('Error accessing certificate:', error);
                                                        }
                                                    }}
                                                     className="px-3 cursor-pointer bg-[#134686] text-white border-[#134686] hover:bg-[#0f3a6e] hover:text-white"
                                                >
                                                    View
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700">Repair Certificate</label>
                                        <div className="flex gap-2 mt-1">
                                            <Input 
                                                value={shipyardInfo.certificate_repair || 'Not provided'} 
                                                readOnly 
                                                className="flex-1"
                                            />
                                            {shipyardInfo.certificate_repair && (
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={async () => {
                                                        try {
                                                            const response = await fetch(`/api/signed-url?url=${encodeURIComponent(shipyardInfo.certificate_repair || '')}`);
                                                            const data = await response.json();
                                                            if (data.signedUrl) {
                                                                window.open(data.signedUrl, '_blank');
                                                            } else {
                                                                console.error('Failed to get signed URL');
                                                            }
                                                        } catch (error) {
                                                            console.error('Error accessing certificate:', error);
                                                        }
                                                    }}
                                                    className="px-3 cursor-pointer bg-[#134686] text-white border-[#134686] hover:bg-[#0f3a6e] hover:text-white"
                                                >
                                                    View
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-gray-700">Other Certificates</label>
                                        <div className="flex gap-2 mt-1">
                                            <Input 
                                                value={shipyardInfo.certificate_other || 'Not provided'} 
                                                readOnly 
                                                className="flex-1"
                                            />
                                            {shipyardInfo.certificate_other && (
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={async () => {
                                                        try {
                                                            const response = await fetch(`/api/signed-url?url=${encodeURIComponent(shipyardInfo.certificate_other || '')}`);
                                                            const data = await response.json();
                                                            if (data.signedUrl) {
                                                                window.open(data.signedUrl, '_blank');
                                                            } else {
                                                                console.error('Failed to get signed URL');
                                                            }
                                                        } catch (error) {
                                                            console.error('Error accessing certificate:', error);
                                                        }
                                                    }}
                                                    className="px-3 cursor-pointer bg-[#134686] text-white border-[#134686] hover:bg-[#0f3a6e] hover:text-white"
                                                >
                                                    View
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center py-8">
                            <div className="text-gray-500">No shipyard information available</div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button 
                            variant="outline" 
                            onClick={handleCloseShipyardDialog}
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Recommendation Confirmation Dialog */}
            <Dialog open={openRecommendDialog} onOpenChange={setOpenRecommendDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold text-gray-900">
                            Confirm Recommendation
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to recommend {selectedBidders.length} selected bidder{selectedBidders.length > 1 ? 's' : ''}?
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4">
                        <p className="text-sm text-gray-600">
                            This action will mark the selected bidder{selectedBidders.length > 1 ? 's' : ''} as recommended and cannot be undone.
                        </p>
                    </div>

                    <DialogFooter>
                        <Button 
                            variant="outline" 
                            onClick={() => setOpenRecommendDialog(false)}
                            disabled={loadingRecommend}
                        >
                            Cancel
                        </Button>
                        <Button 
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={handleConfirmRecommend}
                            disabled={loadingRecommend}
                        >
                            {loadingRecommend ? 'Recommending...' : 'Confirm Recommend'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
    </SidebarProvider>
  )
}
