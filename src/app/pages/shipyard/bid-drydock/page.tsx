"use client";

import React, { useEffect, useState } from 'react';
import { ShipyardSidebar } from "@/components/shipyard-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppHeader } from "@/components/AppHeader"
import { Card, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog as ConfirmDialog, DialogContent as ConfirmDialogContent, DialogHeader as ConfirmDialogHeader, DialogTitle as ConfirmDialogTitle, DialogFooter as ConfirmDialogFooter, DialogDescription as ConfirmDialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { CalendarCheck } from 'lucide-react';
import Image from "next/image";
import jsPDF from 'jspdf';

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

interface BidForm {
    servicesOffered: string[];
    startDate?: string;
    endDate?: string;
    unitCost: string;
}


// Helper to get services with area data
function getServicesWithArea(selectedRequest: DrydockRequest): Array<{name: string, area: number}> {
    if (!selectedRequest) return [];
    let services: Array<{name: string, area: number}> = [];

    console.log('Processing services for request:', selectedRequest.id, 'services_needed:', selectedRequest.services_needed);
    console.log('Services type:', typeof selectedRequest.services_needed);

    if (Array.isArray(selectedRequest.services_needed)) {
        console.log('Services is array, length:', selectedRequest.services_needed.length);
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
        console.log('Services is string:', str);
        if (str.startsWith('[') && str.endsWith(']')) {
            try {
                const parsed = JSON.parse(str);
                console.log('Parsed JSON:', parsed);
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
            // Handle comma-separated values
            services = str.split(',').map(s => ({ name: s.trim(), area: 0 })).filter(s => s.name);
        } else {
            services = [{ name: str, area: 0 }];
        }
    } else if (selectedRequest.services_needed && typeof selectedRequest.services_needed === 'object') {
        // Handle object format
        const servicesObj = selectedRequest.services_needed as unknown;
        console.log('Services is object:', servicesObj);
        if (Array.isArray(servicesObj)) {
            services = servicesObj.map((s: { name: string; area: number } | string) => {
                if (typeof s === 'object' && s.name && s.area) {
                    return { name: s.name, area: s.area };
                } else if (typeof s === 'string') {
                    return { name: s, area: 0 };
                }
                return { name: String(s), area: 0 };
            });
        }
    }

    const result = services.filter(s => s.name.trim());
    console.log('Final processed services result:', result);
    return result;
}

// VesselCard component for displaying drydock request cards
function VesselCard({ request, onBidClick, hasUserBid }: { 
    request: DrydockRequest, 
    onBidClick: (request: DrydockRequest) => void,
    hasUserBid: boolean
}) {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [isLoadingImage, setIsLoadingImage] = useState(false);
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
        // Reset states when vessel changes
        setImageUrl(null);
        setIsLoadingImage(false);
        setImageError(false);

        const picture = request.vessel?.picture;
        if (picture) {
            setIsLoadingImage(true);
            console.log('VesselCard - Loading image for', request.vessel?.name, ':', picture);
            
            // Check if it's an S3 URL - proactively get signed URL
            if (picture.includes('s3.amazonaws.com') || picture.includes('amazonaws.com')) {
                // Fetch signed URL for S3 images
                fetch(`/api/signed-url?url=${encodeURIComponent(picture)}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.signedUrl) {
                            console.log('VesselCard - Got signed URL for', request.vessel?.name);
                            setImageUrl(data.signedUrl);
                        } else {
                            console.error('VesselCard - No signedUrl in response, trying direct URL');
                            setImageUrl(picture);
                        }
                    })
                    .catch(err => {
                        console.error('VesselCard - Error fetching signed URL, trying direct URL:', err);
                        setImageUrl(picture);
                    });
            } else {
                // For non-S3 URLs, use directly
                setImageUrl(picture);
            }
        } else {
            console.log('VesselCard - No vessel picture for', request.vessel?.name);
            setIsLoadingImage(false);
        }
    }, [request.vessel?.picture, request.vessel?.name]);

    // Helper to robustly get an array of needed services (for backward compatibility)
    function getNormalizedNeededServices(selectedRequest: DrydockRequest): string[] {
        return getServicesWithArea(selectedRequest).map((s: {name: string, area: number}) => s.name);
    }

    return (
        <Card
            className="flex flex-col pb-0 shadow-md border border-gray-200 rounded-xl overflow-hidden p-0"
            style={{ width: '260px', height: '330px' }}
        >
            <div className="relative w-full h-[135px] flex-shrink-0 p-0 m-0 mb-0 pb-0">
                {imageUrl && !imageError ? (
                    <Image
                        src={imageUrl}
                        alt={request.vessel?.name || 'Vessel'}
                        width={260}
                        height={135}
                        className="w-full h-full object-cover rounded-t-xl"
                        onLoad={() => {
                            console.log('VesselCard - Image loaded successfully for', request.vessel?.name);
                            setIsLoadingImage(false);
                            setImageError(false);
                        }}
                        onError={(e) => {
                            console.error('VesselCard - Image failed to load for', request.vessel?.name, ':', imageUrl);
                            setImageError(true);
                            setIsLoadingImage(false);
                            
                            // If direct URL failed and we haven't tried signed URL yet, try it
                            const picture = request.vessel?.picture;
                            if (picture && imageUrl === picture && picture.includes('s3.amazonaws.com')) {
                                console.log('VesselCard - Attempting to fetch signed URL as fallback for:', picture);
                                fetch(`/api/signed-url?url=${encodeURIComponent(picture)}`)
                                    .then(res => res.json())
                                    .then(data => {
                                        if (data.signedUrl) {
                                            setImageUrl(data.signedUrl);
                                            setIsLoadingImage(true);
                                            setImageError(false);
                                        }
                                    })
                                    .catch(err => {
                                        console.error('VesselCard - Error fetching signed URL:', err);
                                    });
                            }
                        }}
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full bg-gray-100 rounded-t-xl flex items-center justify-center">
                        <div className="text-gray-400 text-sm font-medium text-center">
                            <div className="text-xs font-bold">{request.vessel?.name || 'Vessel'}</div>
                            {isLoadingImage ? (
                                <div className="text-xs text-gray-400 mt-1">Loading...</div>
                            ) : !request.vessel?.picture ? (
                                <div className="text-xs text-gray-400 mt-1">No image</div>
                            ) : (
                                <div className="text-xs text-gray-400 mt-1">Failed to load</div>
                            )}
                        </div>
                    </div>
                )}
                <div className="absolute top-2 left-2 z-10">
                    <Badge 
                        variant={request.priority_level === 'EMERGENCY' ? 'destructive' : 'default'} 
                        className={`shadow-md px-2 py-0.5 text-xs flex items-center gap-1 ${
                            request.priority_level === 'NORMAL' ? 'bg-green-500 hover:bg-green-500 text-white' : 
                            request.priority_level === 'EMERGENCY' ? 'bg-red-500 hover:bg-red-500 text-white' : 
                            ''
                        }`}
                    >
                        {request.priority_level === 'NORMAL' ? 'Normal' : 
                         request.priority_level === 'EMERGENCY' ? 'Emergency' : 
                         request.priority_level}
                    </Badge>
                </div>
                {request.request_date && (
                    <div className="absolute bottom-2 right-2 z-10">
                        <Badge variant="secondary" className="shadow bg-gray-500 text-white px-2 py-0.5 text-[10px] flex items-center gap-1">
                            <CalendarCheck className="w-3 h-3 mr-1" />
                            {new Date(request.request_date).toLocaleDateString()}
                        </Badge>
                    </div>
                )}
            </div>
            <div className="pl-4 pr-4 mt-0 pt-0 pb-0">
                <div className="text-xs gap-1">
                    <div className="font-bold pt-0 text-center text-lg truncate" style={{ marginTop: 0, marginBottom: 0 }}>
                        {request.vessel?.name || 'Unnamed Vessel'}
                        {request.vessel?.imo_number && (
                            <span className="font-normal text-gray-500 text-sm"> ({request.vessel.imo_number})</span>
                        )}
                    </div>
                    <div className="flex justify-between items-center w-full">
                        <div className="flex items-center">
                            <span className="font-semibold text-gray-800 text-xs">Company:</span>
                            <span className="ml-1 text-gray-600 text-xs">{request.company_name || 'N/A'}</span>
                        </div>
                       
                    </div>
                    <div className="flex w-full">
                        <div className="flex items-center">
                            <span className="font-semibold text-gray-800 text-xs w-12">Length:</span>
                            <span className="ml-1 text-gray-600 text-xs">{request.vessel?.length_overall ? `${request.vessel.length_overall} m` : 'N/A'}</span>
                        </div>
                        <div className="flex items-center ml-3">
                            <span className="font-semibold text-gray-800 text-xs w-12">Tonnage:</span>
                            <span className="ml-1 text-gray-600 text-xs">{request.vessel?.gross_tonnage ? `${request.vessel.gross_tonnage} GT` : 'N/A'}</span>
                        </div>
                    </div>
                    <div className="w-full text-left mt-1">
                        <span className="font-semibold text-gray-700">Services Needed:</span>
                        <div className="mt-1">
                            {getNormalizedNeededServices(request).length > 0 ? (
                                <span className="text-xs text-gray-700">
                                    {getNormalizedNeededServices(request).map(service => service.replace(/\s*-\s*\d+$/, '')).join(', ')}
                                </span>
                            ) : (
                                <span className="text-gray-400 text-xs">No services specified</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <CardFooter className="w-full px-4 pb-4 pt-0 flex-shrink-0">
                {hasUserBid ? (
                    <Button className="w-full h-8 text-sm truncate mt-auto cursor-not-allowed bg-green-500 hover:bg-green-500 text-white" disabled>
                        Bid Successfully!
                    </Button>
                ) : (
                    <Button
                        className="w-full h-8 text-sm truncate mt-auto cursor-pointer bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => onBidClick(request)}
                    >
                        Bid Drydock
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
}

export default function BidDrydockPage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [drydockRequests, setDrydockRequests] = useState<DrydockRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [dataLoaded, setDataLoaded] = useState(false);
    const [priorityFilter, setPriorityFilter] = useState('All');
    const [bidStatusFilter, setBidStatusFilter] = useState('All');
    const [statusFilter] = useState('All');
    const [openDialog, setOpenDialog] = useState(false);
    const [openBidDialog, setOpenBidDialog] = useState(false);
    const [bidForm, setBidForm] = useState<BidForm>({
        servicesOffered: [],
        startDate: '',
        endDate: '',
        unitCost: ''
    });
    const [selectedRequest, setSelectedRequest] = useState<DrydockRequest | null>(null);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    // const [showBidConfirm] = useState(false);
    const [showCalculationDialog, setShowCalculationDialog] = useState(false);
    const [showFormulaDialog, setShowFormulaDialog] = useState(false);
    const [calculationResults, setCalculationResults] = useState<{
        services: Array<{
            name: string;
            reqSqM: number;
            refPrice: number;
            refSqM: number;
            refHours: number;
            refWorkers: number;
            refDays: number;
            unitPrice: number;
            workerHoursPerSqM: number;
            serviceCost: number;
            totalWorkerHours: number;
            serviceDays: number;
        }>;
        subtotal: number;
        contingency: number;
        finalBid: number;
        projectDuration: number;
        maxServiceDays: number;
        totalServiceDays: number;
    } | null>(null);
    const [userBids, setUserBids] = useState<{ drydock_request_id: string }[]>([]);
    const [bidStatuses, setBidStatuses] = useState<{ [key: string]: boolean }>({});
    const [shipyardServices, setShipyardServices] = useState<string[]>([]);
    const [shipyardServicesData, setShipyardServicesData] = useState<Array<{
        id: string;
        name?: string;
        service_name?: string;
        squareMeters?: number;
        square_meters?: number;
        area?: number;
        hours?: number;
        work_hours?: number;
        workers?: number;
        worker_count?: number;
        days?: number;
        duration?: number;
        price?: number;
        unit_price?: number;
    }>>([]);


    const fetchDrydockRequests = async () => {
        try {
            console.log('Fetching drydock requests from API...');
            const response = await fetch('/api/shipyard/drydock-requests');
            console.log('API response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('API response data:', data);
                console.log('Number of drydock requests:', data.drydockRequests?.length || 0);
                
                // Log all unique statuses and priority levels for debugging
                const statuses = [...new Set(data.drydockRequests?.map((r: { status: string }) => r.status) || [])];
                const priorities = [...new Set(data.drydockRequests?.map((r: { priority_level: string }) => r.priority_level) || [])];
                console.log('Available statuses:', statuses);
                console.log('Available priorities:', priorities);
                
                // Debug services data
                data.drydockRequests?.forEach((request: DrydockRequest, index: number) => {
                    console.log(`Request ${index + 1} services_needed:`, request.services_needed);
                    console.log(`Request ${index + 1} services_needed type:`, typeof request.services_needed);
                });
                
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

    useEffect(() => {
        fetchDrydockRequests();
    }, []);

    // Fetch user bids only once on mount
    useEffect(() => {
        const fetchUserBids = async () => {
            try {
                const response = await fetch('/api/shipyard/drydock-bidding');
                if (response.ok) {
                    const data = await response.json();
                    setUserBids(data.bids || []);
                }
            } catch (error) {
                console.error('Error fetching user bids:', error);
            }
        };
        fetchUserBids();
    }, []);

    // Wait for all data to load before showing page
    useEffect(() => {
        if (!loading && drydockRequests.length >= 0 && shipyardServices.length >= 0) {
            setDataLoaded(true);
        }
    }, [loading, drydockRequests.length, shipyardServices.length]);

    // Fetch bid statuses for all drydock requests
    useEffect(() => {
        const fetchBidStatuses = async () => {
            if (!user?.id) return;
            
            try {
                const response = await fetch(`/api/shipyard/bid-statuses?userId=${user.id}`);
                if (response.ok) {
                    const data = await response.json();
                    setBidStatuses(data.bidStatuses || {});
                }
            } catch (error) {
                console.error('Error fetching bid statuses:', error);
            }
        };
        fetchBidStatuses();
    }, [user]);

    useEffect(() => {
        const fetchShipyardServices = async () => {
            if (!user?.id) return;
            
            try {
                const response = await fetch(`/api/shipyard/my-services?userId=${user.id}`);
                if (response.ok) {
                    const data = await response.json();
                    console.log('=== SHIPYARD SERVICES DEBUG ===');
                    console.log('Raw API response:', data);
                    console.log('Services array:', data.services);
                    console.log('Number of services:', data.services?.length || 0);
                    
                    // Log each service data structure
                    if (data.services && data.services.length > 0) {
                        console.log('First service example:', data.services[0]);
                        console.log('Service data structure check:');
                        data.services.forEach((service: {
                            name?: string;
                            service_name?: string;
                            price?: number;
                            squareMeters?: number;
                            square_meters?: number;
                            days?: number;
                            hours?: number;
                            workers?: number;
                        }, index: number) => {
                            console.log(`Service ${index + 1}:`, {
                                name: service.name || service.service_name,
                                price: service.price,
                                squareMeters: service.squareMeters || service.square_meters,
                                days: service.days,
                                hours: service.hours,
                                workers: service.workers
                            });
                        });
                    }
                    
                    // Store full service data
                    setShipyardServicesData(data.services || []);
                    // Extract service_name from each service object for display
                    setShipyardServices((data.services || []).map((s: { service_name: string, name: string }) => s.service_name || s.name));
                    
                    console.log('Stored shipyard services data:', data.services || []);
                    console.log('Stored shipyard services names:', (data.services || []).map((s: { service_name: string, name: string }) => s.service_name || s.name));
                } else {
                    console.error('Failed to fetch shipyard services:', response.status);
                }
            } catch (error) {
                console.error('Error fetching shipyard services:', error);
            }
        };
        fetchShipyardServices();
    }, [user]);

    // Helper to check if user has bid on a request
    const hasUserBid = (requestId: string) =>
        bidStatuses[requestId] || userBids.some(bid => bid.drydock_request_id === requestId);

    // Filter and sort requests
    const filteredRequests = drydockRequests
        .filter(request => {
            // Priority filter
            if (priorityFilter !== 'All' && request.priority_level !== priorityFilter) return false;
            // Status filter
            if (statusFilter !== 'All' && request.status !== statusFilter) return false;
            // Bid status filter
            if (bidStatusFilter === 'Unbid') {
                return !hasUserBid(request.id);
            }
            if (bidStatusFilter === 'Bid') {
                return hasUserBid(request.id);
            }
            return true;
        })
        // Sort: not bidded first, bidded last
        .sort((a, b) => {
            const aBidded = hasUserBid(a.id);
            const bBidded = hasUserBid(b.id);
            if (aBidded === bBidded) return 0;
            return aBidded ? 1 : -1;
        });

    // Helper to robustly get an array of needed services from selectedRequest
    // function getNormalizedNeededServices(selectedRequest: DrydockRequest | null): string[] {
    //     if (!selectedRequest) return [];
    //     let needed: string[] = [];
    //     if (Array.isArray(selectedRequest.services_needed)) {
    //         needed = selectedRequest.services_needed;
    //     } else if (typeof selectedRequest.services_needed === 'string') {
    //         const str = selectedRequest.services_needed.trim();
    //         // If the string looks like a stringified array, parse and flatten
    //         if (str.startsWith('[') && str.endsWith(']')) {
    //             try {
    //                 const parsed = JSON.parse(str);
    //                 if (Array.isArray(parsed)) {
    //                     needed = parsed.map((s: string | { name: string }) => (typeof s === 'string' ? s : String(s)));
    //                 } else if (typeof parsed === 'string') {
    //                     needed = [parsed];
    //                 }
    //             } catch {
    //                 needed = [str];
    //             }
    //         } else {
    //             needed = [str];
    //         }
    //     }
    //     return needed.map((s: string) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean);
    // }

    // Helper to normalize shipyard services for comparison
    // function normalizeServiceList(list: string[] | string): string[] {
    //     if (typeof list === 'string') {
    //         // Split by comma, semicolon, or newline
    //         return list
    //             .split(/[,;\n]+/)
    //             .map(s => s.trim().toLowerCase())
    //             .filter(Boolean);
    //     }
    //     return list.map(s => s.trim().toLowerCase()).filter(Boolean);
    // }

    // const normalizedShipyardServices = normalizeServiceList(shipyardServices);

    // Super robust normalization: remove non-alphanumeric except space, collapse spaces, trim, lowercase
    function superNormalize(str: string | undefined | null): string {
        if (!str) return '';
        return str
            .replace(/[^a-z0-9 ]+/gi, ' ') // Remove non-alphanumeric except space
            .replace(/\s+/g, ' ')         // Collapse multiple spaces
            .trim()
            .toLowerCase();
    }

    // function isServiceOffered(neededService: string, offeredServices: string[]): boolean {
    //     const normNeeded = superNormalize(neededService);
    //     return offeredServices.some(offered => {
    //         const normOffered = superNormalize(offered);
    //         return normOffered === normNeeded ||
    //             normOffered.includes(normNeeded) ||
    //             normNeeded.includes(normOffered);
    //     });
    // }

    // In the Bid dialog, update the Bid button to be enabled only if at least one service is offered
    // const canBid = selectedRequest && getNormalizedNeededServices(selectedRequest).some((service: string) => isServiceOffered(service, normalizedShipyardServices));

    // Compute the list of services that are both needed and offered (checked)
    // function getCheckedServices(selectedRequest: DrydockRequest | null, offeredServices: string[]): string[] {
    //     if (!selectedRequest) return [];
    //     return getNormalizedNeededServices(selectedRequest).filter(service => isServiceOffered(service, offeredServices));
    // }

    // Calculate bid using the provided formula
    function calculateBid() {
        if (!selectedRequest || bidForm.servicesOffered.length === 0) {
            toast({
                title: "Error",
                description: "Please select at least one service to calculate bid.",
                variant: "destructive",
            });
            return;
        }

        console.log('=== CALCULATION DEBUG ===');
        console.log('Selected services offered:', bidForm.servicesOffered);
        console.log('Shipyard services data:', shipyardServicesData);
        console.log('Shipyard services names:', shipyardServicesData.map(s => s.name));
        
        const neededServices = getServicesWithArea(selectedRequest);
        console.log('=== NEEDED SERVICES DEBUG ===');
        console.log('Selected request:', selectedRequest);
        console.log('Needed services:', neededServices);
        console.log('Number of needed services:', neededServices.length);
        console.log('Needed service names:', neededServices.map(s => s.name));
        
        const results = {
            services: [] as Array<{
                name: string;
                reqSqM: number;
                refPrice: number;
                refSqM: number;
                refHours: number;
                refWorkers: number;
                refDays: number;
                unitPrice: number;
                workerHoursPerSqM: number;
                serviceCost: number;
                totalWorkerHours: number;
                serviceDays: number;
            }>,
            subtotal: 0,
            contingency: 0,
            finalBid: 0,
            projectDuration: 0,
            maxServiceDays: 0,
            totalServiceDays: 0
        };

        let maxServiceDays = 0;
        let totalServiceDays = 0;

        // For each selected service, find matching needed service and calculate
        bidForm.servicesOffered.forEach(offeredService => {
            console.log(`\nProcessing offered service: "${offeredService}"`);
            
            // Find matching needed service - try exact match first, then partial match
            let matchingNeededService = neededServices.find(needed => 
                superNormalize(needed.name) === superNormalize(offeredService)
            );
            
            // If no exact match, try partial matching (contains)
            if (!matchingNeededService) {
                matchingNeededService = neededServices.find(needed => 
                    superNormalize(needed.name).includes(superNormalize(offeredService)) ||
                    superNormalize(offeredService).includes(superNormalize(needed.name))
                );
            }
            
            console.log('Matching needed service:', matchingNeededService);

            if (matchingNeededService) {
                // Find the reference data from shipyard services database
                const serviceData = shipyardServicesData.find(s => {
                    const serviceName = s.name || s.service_name;
                    return superNormalize(serviceName) === superNormalize(offeredService) ||
                           superNormalize(serviceName).includes(superNormalize(offeredService)) ||
                           superNormalize(offeredService).includes(superNormalize(serviceName));
                });
                
                console.log('Found service data:', serviceData);

                if (serviceData) {
                    // Use the simplified formula with only 3 key values from database
                    // Handle different possible field names
                    const refPrice = Number(serviceData.price || serviceData.unit_price) || 0;        // Ref_Price
                    const refSqM = Number(serviceData.squareMeters || serviceData.square_meters || serviceData.area) || 1;   // Ref_SqM (default to 1 to avoid division by zero)
                    const refDays = Number(serviceData.days || serviceData.duration) || 1;          // Ref_Days (default to 1)

                    const reqSqM = Number(matchingNeededService.area) || 0;
                    
                    console.log(`Calculation inputs: refPrice=${refPrice}, refSqM=${refSqM}, refDays=${refDays}, reqSqM=${reqSqM}`);
                    console.log(`Service data object:`, serviceData);

                    // Validate inputs before calculation
                    if (refPrice <= 0 || refSqM <= 0 || refDays <= 0) {
                        console.error(`Invalid service data for ${offeredService}:`, { refPrice, refSqM, refDays });
                        toast({
                            title: "Calculation Error",
                            description: `Invalid service data for ${offeredService}. Please check your service configuration.`,
                            variant: "destructive",
                        });
                        return;
                    }

                    // Simple formula as specified
                    const unitPrice = refPrice / refSqM;                    // Unit Price = Ref_Price ÷ Ref_SqM
                    const serviceCost = unitPrice * reqSqM;                 // Service Cost = Unit Price × Requested SqM
                    const serviceDays = refDays * (reqSqM / refSqM);        // Service Days = Ref_Days × (Requested SqM ÷ Ref_SqM)
                    
                    console.log(`Calculated: unitPrice=${unitPrice}, serviceCost=${serviceCost}, serviceDays=${serviceDays}`);

                    results.services.push({
                        name: offeredService,
                        reqSqM: reqSqM,
                        refPrice: refPrice,
                        refSqM: refSqM,
                        refHours: Number(serviceData.hours || serviceData.work_hours) || 0,           // Keep for display
                        refWorkers: Number(serviceData.workers || serviceData.worker_count) || 0,       // Keep for display
                        refDays: refDays,
                        unitPrice: unitPrice,
                        workerHoursPerSqM: 0,                  // Not used in simple formula
                        serviceCost: serviceCost,
                        totalWorkerHours: 0,                   // Not used in simple formula
                        serviceDays: serviceDays
                    });

                    results.subtotal += serviceCost;
                    maxServiceDays = Math.max(maxServiceDays, serviceDays);
                    totalServiceDays += serviceDays;
                } else {
                    console.log(`No service data found for: ${offeredService}`);
                }
            } else {
                console.log(`No matching needed service found for: ${offeredService}`);
            }
        });

        // If no services were calculated, show error instead of test data
        if (results.services.length === 0) {
            console.log('No services matched - this indicates a data issue');
            toast({
                title: "Calculation Error",
                description: "Unable to match selected services with vessel requirements. Please check your service data.",
                variant: "destructive",
            });
            return;
        }

        console.log('Final results:', results);

        // Simple total calculation (no contingency as per your specification)
        results.contingency = 0;  // No contingency in simple method
        results.finalBid = results.subtotal;  // Total Bid = Sum of all Service Costs
        results.maxServiceDays = maxServiceDays;  // If done together (parallel)
        results.totalServiceDays = totalServiceDays;  // If done one after another (sequential)
        results.projectDuration = maxServiceDays; // Default to parallel (longest service)

        setCalculationResults(results);
        setShowCalculationDialog(true);
    }

    // Generate PDF using jsPDF and upload to S3
    async function generatePDF(results: {
        services: Array<{
            name: string;
            reqSqM: number;
            refPrice: number;
            refSqM: number;
            refHours: number;
            refWorkers: number;
            refDays: number;
            unitPrice: number;
            workerHoursPerSqM: number;
            serviceCost: number;
            totalWorkerHours: number;
            serviceDays: number;
        }>;
        finalBid: number;
        maxServiceDays: number;
        totalServiceDays: number;
    }): Promise<string | null> {
        const currentDate = new Date().toLocaleDateString();
        const vesselName = selectedRequest?.vessel?.name || 'Unknown Vessel';
        const companyName = selectedRequest?.company_name || 'Unknown Company';
        const imoNumber = selectedRequest?.vessel?.imo_number || 'N/A';
        
        const doc = new jsPDF();
        let yPosition = 20;
        
        // Header with border
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.rect(15, 10, 180, 25);
        
        // Title
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('DRYDOCK SERVICE BID', 105, 22, { align: 'center' });
        
        // Subtitle
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Marine Drydock Services', 105, 28, { align: 'center' });
        
        yPosition = 45;
        
        // Project Information Section
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('PROJECT INFORMATION', 20, yPosition);
        yPosition += 8;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Date: ${currentDate}`, 20, yPosition);
        yPosition += 6;
        doc.text(`Vessel Name: ${vesselName}`, 20, yPosition);
        yPosition += 6;
        doc.text(`IMO Number: ${imoNumber}`, 20, yPosition);
        yPosition += 6;
        doc.text(`Company: ${companyName}`, 20, yPosition);
        yPosition += 15;
        
        // Selected Services Section
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('SELECTED SERVICES', 20, yPosition);
        yPosition += 8;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        results.services.forEach((service: {
            name: string;
            reqSqM: number;
            refPrice: number;
            refSqM: number;
            refHours: number;
            refWorkers: number;
            refDays: number;
            unitPrice: number;
            workerHoursPerSqM: number;
            serviceCost: number;
            totalWorkerHours: number;
            serviceDays: number;
        }) => {
            doc.text(`• ${service.name}`, 25, yPosition);
            yPosition += 5;
        });
        yPosition += 10;
        
        // Service Calculations Table
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('SERVICE CALCULATIONS', 20, yPosition);
        yPosition += 10;
        
        // Table header
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Service', 20, yPosition);
        doc.text('Area (m²)', 80, yPosition);
        doc.text('Unit Price', 110, yPosition);
        doc.text('Service Cost', 150, yPosition);
        doc.text('Days', 180, yPosition);
        
        // Draw table header line
        doc.line(20, yPosition + 2, 190, yPosition + 2);
        yPosition += 8;
        
        // Table data
        doc.setFont('helvetica', 'normal');
        results.services.forEach((service: {
            name: string;
            reqSqM: number;
            refPrice: number;
            refSqM: number;
            refHours: number;
            refWorkers: number;
            refDays: number;
            unitPrice: number;
            workerHoursPerSqM: number;
            serviceCost: number;
            totalWorkerHours: number;
            serviceDays: number;
        }) => {
            if (yPosition > 250) {
                doc.addPage();
                yPosition = 20;
            }
            
            doc.text(service.name, 20, yPosition);
            doc.text(`${service.reqSqM}`, 80, yPosition);
            doc.text(`₱${service.unitPrice.toLocaleString()}`, 110, yPosition);
            doc.text(`₱${service.serviceCost.toLocaleString()}`, 150, yPosition);
            doc.text(`${Math.round(service.serviceDays)}`, 180, yPosition);
            yPosition += 6;
        });
        
        yPosition += 10;
        
        // Bid Summary Section
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('BID SUMMARY', 20, yPosition);
        yPosition += 10;
        
        // Summary box
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.rect(20, yPosition - 5, 170, 15 + (results.services.length * 6));
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        results.services.forEach((service: {
            name: string;
            reqSqM: number;
            refPrice: number;
            refSqM: number;
            refHours: number;
            refWorkers: number;
            refDays: number;
            unitPrice: number;
            workerHoursPerSqM: number;
            serviceCost: number;
            totalWorkerHours: number;
            serviceDays: number;
        }) => {
            doc.text(`${service.name}:`, 25, yPosition);
            doc.text(`₱${service.serviceCost.toLocaleString()}`, 160, yPosition, { align: 'right' });
            yPosition += 6;
        });
        
        yPosition += 5;
        doc.line(25, yPosition, 185, yPosition);
        yPosition += 5;
        
        doc.setFont('helvetica', 'bold');
        doc.text('TOTAL BID:', 25, yPosition);
        doc.text(`₱${results.finalBid.toLocaleString()}`, 160, yPosition, { align: 'right' });
        yPosition += 15;
        
        // Duration Section
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('PROJECT DURATION', 20, yPosition);
        yPosition += 10;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Parallel Execution (Recommended): ${Math.round(results.maxServiceDays)} days`, 20, yPosition);
        
        // Footer
        yPosition = 280;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text('This report was generated automatically by the Marinex system.', 20, yPosition);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, yPosition + 5);
        
        try {
            // Create blob and upload to S3 via proxy
            const pdfBlob = doc.output('blob');
            
            // Convert blob to File for FormData
            const pdfFile = new File([pdfBlob], `bid-certificate-${Date.now()}.pdf`, {
                type: 'application/pdf',
            });
            
            // Use proxy upload API to avoid CORS issues
            const formData = new FormData();
            formData.append('file', pdfFile);
            formData.append('prefix', 'bid-certificates');
            
            const uploadResponse = await fetch('/api/uploads/upload', {
                method: 'POST',
                body: formData,
            });

            if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json().catch(() => ({ error: 'Unknown error' }));
                console.error('Failed to upload PDF:', errorData);
                throw new Error('Failed to upload PDF to S3');
            }

            const result = await uploadResponse.json();

            if (!result.success || !result.url) {
                throw new Error('Failed to upload PDF to S3');
            }

            toast({
                title: "Success",
                description: "Bid certificate PDF generated and saved successfully!",
            });

            return result.url;
        } catch (error) {
            console.error('Error generating/uploading PDF:', error);
            toast({
                title: "Error",
                description: "Failed to generate bid certificate PDF. Please try again.",
                variant: "destructive",
            });
            return null;
        }
    }

  return (
    <SidebarProvider>
      <ShipyardSidebar />
      <SidebarInset>
        <AppHeader 
          breadcrumbs={[
            { label: "Dashboard", href: "/pages/shipyard" },
            { label: "Bid Drydock", isCurrentPage: true }
          ]} 
        />
        {loading || !dataLoaded ? (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#134686]"></div>
              <p className="text-sm text-gray-600">Loading drydock requests and data...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-5 pt-0 mt-0">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-lg md:text-xl font-bold text-[#134686]">Browse and Bid Drydock Request</h1>
                  <p className="text-sm text-gray-500 mt-1">Browse and select drydock requests to view information and bid on.</p>
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
                <label className="text-sm font-medium">Filter by bid status:</label>
                <Select value={bidStatusFilter} onValueChange={setBidStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Bid Status" />
                  </SelectTrigger>
                  <SelectContent className='bg-white border-gray-300'>
                    <SelectItem value="All">All</SelectItem>
                    <SelectItem value="Unbid">Not Yet Bidded</SelectItem>
                    <SelectItem value="Bid">Already Bidded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="p-4">
              {drydockRequests.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <div className="text-lg font-medium mb-2">No drydock requests found</div>
                            <div className="text-sm">There are currently no drydock requests available for bidding.</div>

                        </div>
                    ) : filteredRequests.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <div className="text-lg font-medium mb-2">No requests match your filters</div>
                            <div className="text-sm">Try adjusting your priority or bid status filters.</div>
                            <div className="text-sm mt-2">Total requests available: {drydockRequests.length}</div>
                        </div>
                    ) : (
                        <div className="flex flex-row flex-wrap gap-5 pl-2 pt-0 w-full max-w-7xl">
                                {filteredRequests.map((request) => (
                                <VesselCard
                                    key={request.id}
                                    request={request}
                                    onBidClick={(request) => {
                                        setSelectedRequest(request);
                                        setOpenDialog(true);
                                    }}
                                    hasUserBid={hasUserBid(request.id)}
                                />
                                ))}
                        </div>
              )}
            </div>
          </>
        )}
      </SidebarInset>
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <DialogContent className="!w-[900px] !max-w-[900px] h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-[#134686] text-xl font-bold">Drydock Request Details</DialogTitle>
                        <p className="text-sm text-gray-600">Enter vessel details and view required information.</p>
                    </DialogHeader>
                    {selectedRequest && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <label className="flex flex-col">
                                    <span className="mb-2 text-sm font-medium text-gray-600">Company Name</span>
                                    <Input 
                                        className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-500 font-normal shadow-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition h-[38px]" 
                                        readOnly 
                                        value={selectedRequest.company_name || ''} 
                                        placeholder="Company Name" 
                                    />
                                </label>
                                <label className="flex flex-col">
                                    <span className="mb-2 text-sm font-medium text-gray-600">Company Location</span>
                                    <Input 
                                        className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-500 font-normal shadow-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition h-[38px]" 
                                        readOnly 
                                        value={selectedRequest.company_location || 'N/A'} 
                                        placeholder="Company Location" 
                                    />
                                </label>
                                <label className="flex flex-col">
                                    <span className="mb-2 text-sm font-medium text-gray-600">Vessel Name</span>
                                    <Input 
                                        className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-500 font-normal shadow-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition h-[38px]" 
                                        readOnly 
                                        value={selectedRequest.vessel?.name || ''} 
                                        placeholder="Vessel Name" 
                                    />
                                </label>
                                <label className="flex flex-col">
                                    <span className="mb-2 text-sm font-medium text-gray-600">IMO Number</span>
                                    <Input 
                                        className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-600 font-normal shadow-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition h-[38px]" 
                                        readOnly 
                                        value={selectedRequest.vessel?.imo_number || ''} 
                                        placeholder="e.g. 1234567" 
                                    />
                                </label>
                                <label className="flex flex-col">
                                    <span className="mb-2 text-sm font-medium text-gray-600">Flag</span>
                                    <Input 
                                        className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-600 font-normal shadow-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition h-[38px]" 
                                        readOnly 
                                        value={selectedRequest.vessel?.flag ? selectedRequest.vessel.flag.charAt(0).toUpperCase() + selectedRequest.vessel.flag.slice(1).toLowerCase() : ''} 
                                        placeholder="Select flag" 
                                    />
                                </label>
                                <label className="flex flex-col">
                                    <span className="mb-2 text-sm font-medium text-gray-600">Ship Type</span>
                                    <Input 
                                        className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-600 font-normal shadow-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition h-[38px]" 
                                        readOnly 
                                        value={selectedRequest.vessel?.ship_type ? selectedRequest.vessel.ship_type.charAt(0).toUpperCase() + selectedRequest.vessel.ship_type.slice(1).toLowerCase() : ''} 
                                        placeholder="Select type" 
                                    />
                                </label>
                                <label className="flex flex-col">
                                    <span className="mb-2 text-sm font-medium text-gray-600">Length Overall (m)</span>
                                    <Input 
                                        className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-600 font-normal shadow-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition h-[38px]" 
                                        readOnly 
                                        value={selectedRequest.vessel?.length_overall || ''} 
                                        placeholder="e.g. 200" 
                                    />
                                </label>
                                <label className="flex flex-col">
                                    <span className="mb-2 text-sm font-medium text-gray-600">Gross Tonnage</span>
                                    <Input 
                                        className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-600 font-normal shadow-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition h-[38px]" 
                                        readOnly 
                                        value={selectedRequest.vessel?.gross_tonnage || ''} 
                                        placeholder="e.g. 50000" 
                                    />
                                </label>
                                <label className="flex flex-col">
                                    <span className="mb-2 text-sm font-medium text-gray-600">Year of Build</span>
                                    <Input 
                                        className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-600 font-normal shadow-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition h-[38px]" 
                                        readOnly 
                                        value="2010" 
                                        placeholder="e.g. 2010" 
                                    />
                                </label>
                                <label className="flex flex-col">
                                    <span className="mb-2 text-sm font-medium text-gray-600">Vessel Certification Expiry Date</span>
                                    <Input 
                                        className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-600 font-normal shadow-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition h-[38px]" 
                                        readOnly 
                                        value="15/12/2025" 
                                        placeholder="dd/mm/yyyy" 
                                    />
                                </label>
                            </div>

                            {/* Services Table */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-medium text-gray-600">Services needed by the vessel</h3>
                                <div className="border border-gray-300 rounded-md overflow-hidden">
                                    <table className="w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b border-gray-300">Name of the Service</th>
                                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b border-gray-300">How many Square Meters?</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {getServicesWithArea(selectedRequest).length > 0 ? (
                                                getServicesWithArea(selectedRequest).map((service, index) => (
                                                    <tr key={index} className="border-b border-gray-200 last:border-b-0">
                                                        <td className="px-4 py-3 text-sm text-gray-700">{service.name}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-700">{service.area > 0 ? `${service.area} m²` : 'N/A'}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={2} className="px-4 py-3 text-sm text-gray-500 text-center">No services specified</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Initial Scope of Works Section */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-medium text-gray-600">Initial Scope of Works</h3>
                                {selectedRequest.scope_of_work ? (
                                    <div className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 h-[38px] flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <span className="text-sm text-gray-700"> Initial Scope of Works Document</span>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const response = await fetch(`/api/signed-url?url=${encodeURIComponent(selectedRequest.scope_of_work || '')}`);
                                                    const data = await response.json();
                                                    if (data.signedUrl) {
                                                        window.open(data.signedUrl, '_blank');
                                                    } else {
                                                        toast({
                                                            title: "Error",
                                                            description: "Failed to access document",
                                                            variant: "destructive"
                                                        });
                                                    }
                                                } catch {
                                                    toast({
                                                        title: "Error",
                                                        description: "Failed to access document",
                                                        variant: "destructive"
                                                    });
                                                }
                                            }}
                                            className="underline text-sm font-medium cursor-pointer hover:text-blue-600"
                                        >
                                            View File
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-full rounded-md border border-gray-300 bg-gray-50 px-4 py-2 h-[38px] flex items-center">
                                        <span className="text-sm text-gray-500">No scope of works document available</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button className='cursor-pointer' variant="outline" onClick={() => setOpenDialog(false)}>Cancel</Button>
                        <Button className='cursor-pointer bg-green-600 hover:bg-green-700 text-white' onClick={() => { setOpenDialog(false); setOpenBidDialog(true); }}>Bid Drydock</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={openBidDialog} onOpenChange={setOpenBidDialog}>
                <DialogContent className="!w-[600px] !max-w-[95vw]">
                    <DialogHeader>
                        <DialogTitle>Bid Drydock</DialogTitle>
                        <DialogDescription>Select the services you can provide and submit your bid.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-6">
                        {/* Services Needed by Vessel */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium text-gray-900">Services Needed by Vessel</h3>
                            {selectedRequest && getServicesWithArea(selectedRequest).length > 0 ? (
                                <div className="border border-gray-300 rounded-md overflow-hidden">
                                    <table className="w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b border-gray-300">Name of the service</th>
                                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b border-gray-300">Square Meters</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {getServicesWithArea(selectedRequest).map((service, index) => (
                                                <tr key={index} className="border-b border-gray-200 last:border-b-0">
                                                    <td className="px-4 py-3 text-sm text-gray-700">{service.name}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-700">{service.area > 0 ? `${service.area} m²` : 'N/A'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="border border-gray-300 rounded-md p-3 bg-gray-50">
                                    <span className="text-sm text-gray-500">No services specified</span>
                                </div>
                            )}
                        </div>

                        {/* Your Available Services */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium text-gray-900">Select Services You Can Provide</h3>
                            <div className=" overflow-y-auto">
                                {shipyardServices.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        {shipyardServices.map((service, index) => (
                                            <div key={index} className="flex items-center space-x-2 p-2 border border-gray-300 rounded-md">
                                                <Checkbox
                                                    id={`service-${index}`}
                                                    checked={bidForm.servicesOffered.includes(service)}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) {
                                                            setBidForm(prev => ({
                                                                ...prev,
                                                                servicesOffered: [...prev.servicesOffered, service]
                                                            }));
                                                        } else {
                                                            setBidForm(prev => ({
                                                                ...prev,
                                                                servicesOffered: prev.servicesOffered.filter(s => s !== service)
                                                            }));
                                                        }
                                                    }}
                                                />
                                                <label htmlFor={`service-${index}`} className="text-sm text-gray-700 cursor-pointer">
                                                    {service}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-sm text-gray-500">No services available</span>
                                )}
                            </div>
                        </div>

                    </div>
                    <DialogFooter>
                        <Button className='cursor-pointer' variant="outline" onClick={() => setShowCancelConfirm(true)}>Cancel</Button>
                        <Button 
                            className='cursor-pointer bg-blue-600 hover:bg-blue-700 text-white' 
                            onClick={calculateBid}
                            disabled={bidForm.servicesOffered.length === 0}
                        >
                            Calculate
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Cancel Confirmation Dialog */}
            <ConfirmDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
                <ConfirmDialogContent>
                    <ConfirmDialogHeader>
                        <ConfirmDialogTitle>Cancel Bidding?</ConfirmDialogTitle>
                        <ConfirmDialogDescription>
                            Are you sure you want to cancel? All unsaved changes will be lost.
                        </ConfirmDialogDescription>
                    </ConfirmDialogHeader>
                    <ConfirmDialogFooter>
                        <Button variant="outline" onClick={() => setShowCancelConfirm(false)}>No</Button>
                        <Button variant="destructive" onClick={() => { setShowCancelConfirm(false); setOpenBidDialog(false); }}>Yes, Cancel</Button>
                    </ConfirmDialogFooter>
                </ConfirmDialogContent>
            </ConfirmDialog>

            {/* Calculation Results Dialog */}
            <Dialog open={showCalculationDialog} onOpenChange={setShowCalculationDialog}>
                <DialogContent className="!w-[800px] !max-w-[95vw] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-[#134686] text-xl font-bold">Bid Calculation Results</DialogTitle>
                        <DialogDescription>Detailed breakdown of your bid calculation using the provided formula.</DialogDescription>
                    </DialogHeader>
                    {calculationResults && (
                        <div className="space-y-6">
                            {/* Service Details Table */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-md font-semibold text-gray-900">Service Calculations</h3>
                                    <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => setShowFormulaDialog(true)}
                                        className="text-xs"
                                    >
                                        Formula
                                    </Button>
                                </div>
                                <div className="border border-gray-300 rounded-md overflow-hidden">
                                    <table className="w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-900 border-b border-gray-300">Service</th>
                                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-900 border-b border-gray-300">Req SqM</th>
                                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-900 border-b border-gray-300">Unit Price</th>
                                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-900 border-b border-gray-300">Service Cost</th>
                                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-900 border-b border-gray-300">Service Days</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {calculationResults.services.map((service: {
                                                name: string;
                                                reqSqM: number;
                                                refPrice: number;
                                                refSqM: number;
                                                refHours: number;
                                                refWorkers: number;
                                                refDays: number;
                                                unitPrice: number;
                                                workerHoursPerSqM: number;
                                                serviceCost: number;
                                                totalWorkerHours: number;
                                                serviceDays: number;
                                            }, index: number) => (
                                                <tr key={index} className="border-b border-gray-200 last:border-b-0">
                                                    <td className="px-4 py-2 text-sm text-gray-700">{service.name}</td>
                                                    <td className="px-4 py-2 text-sm text-gray-700">{service.reqSqM} m²</td>
                                                    <td className="px-4 py-2 text-sm text-gray-700">₱{service.unitPrice.toLocaleString()}/m²</td>
                                                    <td className="px-4 py-2 text-sm text-gray-700">₱{service.serviceCost.toLocaleString()}</td>
                                                    <td className="px-4 py-2 text-sm text-gray-700">{Math.round(service.serviceDays)} days</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                                            {/* Project Duration */}
                            <div className="space-y-3">
                                <h3 className="text-md font-semibold text-gray-900">Total Drydock Duration</h3>
                                <div className="bg-blue-50 p-4 rounded-md space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-sm font-medium text-gray-700">Parallel Crews (Recommended):</span>
                                        <span className="text-sm text-gray-900">{Math.round(calculationResults.maxServiceDays)} days</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Summary */}
                            <div className="space-y-3">
                                <h3 className="text-md font-semibold text-gray-900">Bid Summary</h3>
                                <div className="bg-gray-50 p-4 rounded-md space-y-2">
                                    {calculationResults.services.map((service, index) => (
                                        <div key={index} className="flex justify-between">
                                            <span className="text-sm font-medium text-gray-700">{service.name}:</span>
                                            <span className="text-sm text-gray-900">₱{service.serviceCost.toLocaleString()}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between border-t border-gray-300 pt-2">
                                        <span className="text-base font-bold text-gray-900">Total Bid:</span>
                                        <span className="text-base font-bold text-green-600">₱{calculationResults.finalBid.toLocaleString()}</span>
                                    </div>
                                </div>
                             </div>

                             {/* Generate PDF Section */}
                             <div className="space-y-3">
                                 <h3 className="text-md font-semibold text-gray-900">Generate Report</h3>
                                 <div className="bg-gray-50 p-4 rounded-md">
                                     <div className="flex items-center justify-between">
                                         <div className="flex items-center space-x-2">
                                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                             </svg>
                                             <span className="text-sm text-gray-700">Bid Calculation Report</span>
                                         </div>
                                        
                                     </div>
                                 </div>
                             </div>

                            
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCalculationDialog(false)}>Close</Button>
                        <Button 
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={async () => {
                                if (!selectedRequest || !calculationResults || !user?.id) {
                                    toast({
                                        title: "Error",
                                        description: "Missing required information for bid submission.",
                                        variant: "destructive",
                                    });
                                    return;
                                }

                                try {
                                    // Generate PDF certificate first
                                    toast({
                                        title: "Generating Certificate",
                                        description: "Creating bid certificate PDF...",
                                    });

                                    const certificateUrl = await generatePDF(calculationResults);
                                    
                                    if (!certificateUrl) {
                                        toast({
                                            title: "Error",
                                            description: "Failed to generate bid certificate. Please try again.",
                                            variant: "destructive",
                                        });
                                        return;
                                    }

                                    // Submit bid with certificate URL
                                    const response = await fetch('/api/shipyard/submit-bid', {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                        },
                                        body: JSON.stringify({
                                            drydockRequestId: selectedRequest.id,
                                            shipyardUserId: user.id,
                                            servicesOffered: bidForm.servicesOffered,
                                            serviceCalculations: calculationResults.services,
                                            totalBid: calculationResults.finalBid,
                                            totalDays: calculationResults.maxServiceDays,
                                            parallelDays: calculationResults.maxServiceDays,
                                            sequentialDays: calculationResults.totalServiceDays,
                                            bidCertificateUrl: certificateUrl
                                        }),
                                    });

                                    if (response.ok) {
                                        toast({
                                            title: "Success",
                                            description: "Bid submitted successfully with certificate!",
                                        });
                                        setShowCalculationDialog(false);
                                        setOpenBidDialog(false);
                                        
                                        // Update bid status for this request
                                        setBidStatuses(prev => ({
                                            ...prev,
                                            [selectedRequest.id]: true
                                        }));
                                        
                                        // Refresh the page to update the UI
                                        window.location.reload();
                                    } else {
                                        const data = await response.json();
                                        toast({
                                            title: "Error",
                                            description: "Failed to submit bid: " + (data.error || 'Unknown error'),
                                            variant: "destructive",
                                        });
                                    }
                                } catch (error) {
                                    console.error('Error submitting bid:', error);
                                    toast({
                                        title: "Error",
                                        description: "Failed to submit bid. Please try again.",
                                        variant: "destructive",
                                    });
                                }
                            }}
                        >
                            Bid Now
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Formula Dialog */}
            <Dialog open={showFormulaDialog} onOpenChange={setShowFormulaDialog}>
                <DialogContent className="!w-[500px] !max-w-[95vw]">
                    <DialogHeader>
                        <DialogTitle className="text-[#134686] text-xl font-bold">Calculation Formula</DialogTitle>
                        <DialogDescription>Formulas used for bid calculation.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="bg-gray-50 p-4 rounded-md text-sm text-gray-700 space-y-3">
                            <div className="flex items-center space-x-2">
                                <span className="font-semibold text-gray-900">Unit Price</span>
                                <span className="text-gray-500">=</span>
                                <span>Ref_Price ÷ Ref_SqM</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <span className="font-semibold text-gray-900">Service Cost</span>
                                <span className="text-gray-500">=</span>
                                <span>Unit Price × Requested SqM</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <span className="font-semibold text-gray-900">Service Days</span>
                                <span className="text-gray-500">=</span>
                                <span>Ref_Days × (Requested SqM ÷ Ref_SqM)</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                <span className="font-semibold text-gray-900">Total Bid</span>
                                <span className="text-gray-500">=</span>
                                <span>Sum of all Service Costs</span>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowFormulaDialog(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
    </SidebarProvider>
  )
}

