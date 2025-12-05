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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { CalendarCheck, Loader2 } from 'lucide-react';
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

interface BidHistoryEntry {
    vesselName: string;
    companyName: string;
    bidAmount: number;
    bidDate: string;
    status: string;
    certificateUrl?: string;
}

interface BidForm {
    servicesOffered: string[];
    unitCost: string;
}

interface ServiceCalculation {
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
    materialsCost: number;
    laborCost: number;
    equipmentCost: number;
}

interface AdditionalCostItem {
    name: string;
    amount: number;
    description?: string;
}

interface PricingBreakdown {
    currency: string;
    perService: Array<{
        name: string;
        materialsCost: number;
        laborCost: number;
        equipmentCost: number;
        totalCost: number;
    }>;
    totals: {
        materials: number;
        labor: number;
        equipment: number;
        subtotal: number;
    };
    notes?: string;
}

interface ScheduleDetails {
    totalDays: number;
    startDate?: string | null;
    endDate?: string | null;
    dockingWindow?: {
        docking?: string | null;
        undocking?: string | null;
    };
    penalties?: {
        liquidatedDamagesRate: number;
        description: string;
    };
}

interface ContractConditions {
    paymentTerms: string[];
    insuranceAndLiability: string;
    warranty: string;
    qualityAssurance: string;
    hse: string[];
}

interface TaxesAndFees {
    vat: {
        rate: number;
        includedInTotal: boolean;
        note: string;
    };
    portCharges: string;
    importDuties: string;
    otherPayments: Array<{ name: string; detail: string }>;
}

interface AdditionalCosts {
    items: AdditionalCostItem[];
    incidentalNote: string;
    total: number;
}

interface CalculationResults {
    services: ServiceCalculation[];
    subtotal: number;
    contingency: number;
    finalBid: number;
    totalDurationDays: number;
    pricingBreakdown: PricingBreakdown;
    scheduleDetails: ScheduleDetails;
    contractConditions: ContractConditions;
    taxesAndFees: TaxesAndFees;
    additionalCosts: AdditionalCosts;
    requiredDocumentation: string[];
    bidDocumentUrl?: string | null;
    grandTotal: number;
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
                        <Badge variant="secondary" className="shadow bg-yellow-500 text-white px-2 py-0.5 text-[10px] flex items-center gap-1">
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
                            {(() => {
                                const services = getNormalizedNeededServices(request).map(service => service.replace(/\s*-\s*\d+$/, ''))
                                if (services.length === 0) {
                                    return <span className="text-gray-400 text-xs">No services specified</span>
                                }
                                const displayServices = services.slice(0, 2)
                                const remainingCount = services.length - 2
                                return (
                                    <span className="text-xs text-gray-700">
                                        {displayServices.join(', ')}
                                        {remainingCount > 0 && ` +${remainingCount} more`}
                                    </span>
                                )
                            })()}
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
        unitCost: ''
    });
    const [selectedRequest, setSelectedRequest] = useState<DrydockRequest | null>(null);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    // const [showBidConfirm] = useState(false);
    const [showCalculationDialog, setShowCalculationDialog] = useState(false);
    const [showFormulaDialog, setShowFormulaDialog] = useState(false);
    const [calculationResults, setCalculationResults] = useState<CalculationResults | null>(null);
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
    const [bidDocumentUrl, setBidDocumentUrl] = useState<string | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [isGeneratingDocument, setIsGeneratingDocument] = useState(false);
    const [isSubmittingBid, setIsSubmittingBid] = useState(false);
    const [liquidatedDamagesRate, setLiquidatedDamagesRate] = useState(0.5);

    const [showHistoryDialog, setShowHistoryDialog] = useState(false);
    const [bidHistory, setBidHistory] = useState<BidHistoryEntry[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const totalBidAmount = calculationResults?.finalBid ?? 0;
    const additionalCostsTotal = calculationResults?.additionalCosts?.total ?? 0;
    const grandTotalAmount = calculationResults?.grandTotal ?? (totalBidAmount + additionalCostsTotal);
    const totalDurationDays = calculationResults?.scheduleDetails?.totalDays ?? calculationResults?.totalDurationDays ?? 0;
    const totalServicesSelected = calculationResults?.services?.length ?? 0;
    const totalRequestedSqM = calculationResults?.services?.reduce((sum, service) => sum + (service.reqSqM || 0), 0) ?? 0;
    const subtotalAmount = calculationResults?.subtotal ?? 0;
    const contingencyAmount = calculationResults?.contingency ?? 0;
    const scheduleDetails = calculationResults?.scheduleDetails;
    const pricingBreakdown = calculationResults?.pricingBreakdown;
    const contractConditions = calculationResults?.contractConditions;
    const taxesAndFees = calculationResults?.taxesAndFees;
    const additionalCosts = calculationResults?.additionalCosts;
    const requiredDocumentation = calculationResults?.requiredDocumentation ?? [];
    const formatDisplayDate = (iso?: string | null) => {
        if (!iso) return 'TBD';
        const date = new Date(iso);
        if (isNaN(date.getTime())) return 'TBD';
        return date.toLocaleDateString();
    };
    const scheduleStartLabel = formatDisplayDate(scheduleDetails?.startDate);
    const scheduleEndLabel = formatDisplayDate(scheduleDetails?.endDate);
    const penaltyDescription = scheduleDetails?.penalties?.description;
    const bidPdfUrl = calculationResults?.bidDocumentUrl ?? bidDocumentUrl;

    const handleRegenerateDocument = async () => {
        if (!calculationResults) return;
        try {
            setIsGeneratingDocument(true);
            const refreshedUrl = await generatePDF(calculationResults);
            setBidDocumentUrl(refreshedUrl);
            setCalculationResults(prev => prev ? { ...prev, bidDocumentUrl: refreshedUrl } : prev);
        } finally {
            setIsGeneratingDocument(false);
        }
    };

    const fetchBidHistory = async () => {
        if (!user?.id) return;
        setLoadingHistory(true);
        try {
            // Re-using the drydock-bidding endpoint with a query param
            const response = await fetch(`/api/shipyard/drydock-bidding?userId=${user.id}&detailed=true`);
            if (response.ok) {
                const data = await response.json();
                setBidHistory(data.bids || []);
            } else {
                toast({
                    title: "Error fetching history",
                    description: "Could not load your bid history at this time.",
                    variant: "destructive"
                });
                setBidHistory([]);
            }
        } catch (error) {
            console.error('Error fetching bid history:', error);
            toast({
                title: "Error",
                description: "An error occurred while fetching bid history.",
                variant: "destructive"
            });
            setBidHistory([]);
        } finally {
            setLoadingHistory(false);
        }
    };


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
                
                // Filter out completed drydock requests
                const filteredRequests = (data.drydockRequests || []).filter(
                    (request: DrydockRequest) => request.status?.toUpperCase() !== 'COMPLETED'
                );
                
                setDrydockRequests(filteredRequests);
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

    // Auto-select services needed by shipowner when bid dialog opens
    useEffect(() => {
        if (openBidDialog && selectedRequest && shipyardServices.length > 0 && bidForm.servicesOffered.length === 0) {
            const neededServices = getServicesWithArea(selectedRequest).map(s => s.name);
            const matchedServices: string[] = [];
            
            // Match needed services with available shipyard services
            neededServices.forEach(neededService => {
                const normalizedNeeded = neededService.toLowerCase().trim();
                const matched = shipyardServices.find(shipyardService => {
                    const normalizedShipyard = shipyardService.toLowerCase().trim();
                    return normalizedShipyard === normalizedNeeded ||
                           normalizedShipyard.includes(normalizedNeeded) ||
                           normalizedNeeded.includes(normalizedShipyard);
                });
                if (matched) {
                    matchedServices.push(matched);
                }
            });
            
            // Auto-select matched services
            if (matchedServices.length > 0) {
                setBidForm(prev => ({
                    ...prev,
                    servicesOffered: matchedServices
                }));
            }
        }
    }, [openBidDialog, selectedRequest, shipyardServices]);

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

    function addDays(date: Date, days: number) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    // Calculate bid using the provided formula
    async function calculateBid() {
        if (!selectedRequest || bidForm.servicesOffered.length === 0) {
            toast({
                title: "Error",
                description: "Please select at least one service to calculate bid.",
                variant: "destructive",
            });
            return;
        }

        if (isCalculating) {
            return;
        }

        setIsCalculating(true);
        setBidDocumentUrl(null);

        try {
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
            
            const MATERIAL_SHARE = 0.45;
            const LABOR_SHARE = 0.35;
            const EQUIPMENT_SHARE = 0.20;
            const TENDER_FEE_AMOUNT = 25000;

            const results: CalculationResults = {
                services: [],
                subtotal: 0,
                contingency: 0,
                finalBid: 0,
                totalDurationDays: 0,
                pricingBreakdown: {
                    currency: 'PHP',
                    perService: [],
                    totals: {
                        materials: 0,
                        labor: 0,
                        equipment: 0,
                        subtotal: 0
                    },
                notes: undefined
                },
                scheduleDetails: {
                    totalDays: 0,
                    startDate: null,
                    endDate: null,
                    dockingWindow: {
                        docking: null,
                        undocking: null
                    },
                    penalties: {
                        liquidatedDamagesRate,
                        description: `Liquidated damages at ${liquidatedDamagesRate}% of the contract price per calendar day of delay beyond approved completion.`
                    }
                },
                contractConditions: {
                    paymentTerms: [
                        "20% mobilization upon PO issuance (bank transfer, PHP).",
                        "50% progress billing upon owner-approved midpoint milestone.",
                        "30% upon completion, acceptance, and redelivery."
                    ],
                    insuranceAndLiability: "Shipyard maintains comprehensive liability, WHM, and builder's risk coverages. Loss or damage to the vessel within the premises remains the shipyard's responsibility except for force majeure events.",
                    warranty: "Six (6) months workmanship and materials warranty after redelivery. Defects discovered within the period are rectified at no additional cost.",
                    qualityAssurance: "Inspection & Test Plans (ITPs) signed jointly with the owner's representative and the assigned class society surveyor before closing work packs.",
                    hse: [
                        "Hot work permits issued daily with fire-watch assignment and gas monitoring.",
                        "Tank/void entry follows DOLE/OSHA confined-space protocols; gas-free certificates issued by certified chemist.",
                        "Waste segregation, bilge control, and sludge disposal handled through DENR-accredited haulers."
                    ]
                },
                taxesAndFees: {
                    vat: {
                        rate: 0.12,
                        includedInTotal: true,
                        note: "Philippines VAT rate (12%) is included in invoicing unless owner provides zero-rating/exemption certificates."
                    },
                    portCharges: "Docking/undocking fees generally waived while the vessel is inside a MARINA-accredited drydock subject to approved documentation.",
                    importDuties: "Imported spares/materials may incur customs duties; exemptions apply when supported by BoC/DOF approvals.",
                    otherPayments: [
                        { name: "Tender / ITB Fee", detail: "Indicative ₱25,000 one-time, non-refundable to access bid documents." },
                        { name: "Bid Security (EMD)", detail: "2% of the Approved Budget for Contract, refundable after award." },
                        { name: "Performance Guarantee", detail: "10% of total contract price, released upon successful completion." },
                        { name: "Labor Welfare Cess", detail: "1% of labor component when mandated by local regulations." }
                    ]
                },
                additionalCosts: {
                    items: [],
                    incidentalNote: "Owner to bear pilots, tugs, crew housing, cranes, and sea trials unless otherwise agreed.",
                    total: 0
                },
                requiredDocumentation: [
                    "Company profile and past drydock projects (last 5 years).",
                    "Signed self-declarations on legal capacity and tax compliance.",
                    "Bank account & remittance instructions.",
                    "List of available machinery, equipment, and certifications.",
                    "Proof of insurance coverage and safety programs."
                ],
                bidDocumentUrl: null,
                grandTotal: 0
            };

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

                        const materialsCost = serviceCost * MATERIAL_SHARE;
                        const laborCost = serviceCost * LABOR_SHARE;
                        const equipmentCost = serviceCost * EQUIPMENT_SHARE;

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
                            serviceDays: serviceDays,
                            materialsCost,
                            laborCost,
                            equipmentCost
                        });

                        results.pricingBreakdown.perService.push({
                            name: offeredService,
                            materialsCost,
                            laborCost,
                            equipmentCost,
                            totalCost: serviceCost
                        });
                        results.pricingBreakdown.totals.materials += materialsCost;
                        results.pricingBreakdown.totals.labor += laborCost;
                        results.pricingBreakdown.totals.equipment += equipmentCost;

                        results.subtotal += serviceCost;
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
            results.pricingBreakdown.totals.subtotal = results.finalBid;

            const totalDuration = Math.ceil(totalServiceDays);
            results.totalDurationDays = totalDuration;
            results.scheduleDetails.totalDays = totalDuration;

            // Auto-generate start date as today
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Set to start of day
            const startDateString = today.toISOString();
            
            // Calculate end date based on duration
            const computedEnd = addDays(today, totalDuration);
            const endDateString = computedEnd.toISOString();
            
            results.scheduleDetails.startDate = startDateString;
            results.scheduleDetails.endDate = endDateString;
            results.scheduleDetails.dockingWindow = {
                docking: startDateString,
                undocking: endDateString
            };

            // Update additional costs with computed values
            const bidSecurityAmount = results.finalBid * 0.02;
            const performanceGuaranteeAmount = results.finalBid * 0.10;
            const laborWelfareCessAmount = results.pricingBreakdown.totals.labor * 0.01;
            const additionalCostItems: AdditionalCostItem[] = [
                { name: "Tender Fee", amount: TENDER_FEE_AMOUNT, description: "Non-refundable" },
                { name: "Bid Security (2%)", amount: bidSecurityAmount, description: "Refundable after award" },
                { name: "Performance Guarantee (10%)", amount: performanceGuaranteeAmount, description: "Released upon completion" },
                { name: "Labor Welfare Cess (1% of labor)", amount: laborWelfareCessAmount, description: "Subject to DOLE directives" }
            ];
            const additionalCostsTotal = additionalCostItems.reduce((sum, item) => sum + item.amount, 0);
            results.additionalCosts = {
                items: additionalCostItems,
                incidentalNote: "Owner to cover pilots, tugs, crew housing, crane hire, and sea trials unless specified.",
                total: additionalCostsTotal
            };
            results.grandTotal = results.finalBid + additionalCostsTotal;

            setCalculationResults(results);
            setShowCalculationDialog(true);

            try {
                setIsGeneratingDocument(true);
                const generatedUrl = await generatePDF(results);
                setBidDocumentUrl(generatedUrl);
                setCalculationResults(prev => prev ? { ...prev, bidDocumentUrl: generatedUrl } : prev);
            } finally {
                setIsGeneratingDocument(false);
            }
        } catch (error) {
            console.error('Error during calculation:', error);
            toast({
                title: "Calculation Error",
                description: "An error occurred while calculating the bid. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsCalculating(false);
        }
    }

    // Generate PDF using jsPDF and upload to S3
    async function generatePDF(results: {
        services: ServiceCalculation[];
        finalBid: number;
        totalDurationDays?: number;
        pricingBreakdown?: PricingBreakdown;
        scheduleDetails?: ScheduleDetails;
        contractConditions?: ContractConditions;
        taxesAndFees?: TaxesAndFees;
        additionalCosts?: AdditionalCosts;
        requiredDocumentation?: string[];
        grandTotal: number;
    }): Promise<string | null> {

        const getBase64Image = async (url: string): Promise<string | null> => {
            try {
                const response = await fetch(url);
                if (!response.ok) return null;
                const blob = await response.blob();
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch (error) {
                console.error("Error fetching image for PDF:", error);
                return null;
            }
        };

        const doc = new jsPDF();
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();

        const marinexBlue = '#134686';
        const lightGray = '#F3F4F6';
        const darkGray = '#374151';
        const midGray = '#6B7281';

        const logoUrl = '/assets/marinex_logo.png';
        const logoData = await getBase64Image(logoUrl);

        const addHeader = () => {
            if (logoData) {
                doc.addImage(logoData, 'PNG', 14, 12, 35, 11);
            }
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(darkGray);
            doc.text('BID QUOTATION', pageWidth - 14, 20, { align: 'right' });

            doc.setDrawColor(marinexBlue);
            doc.setLineWidth(1);
            doc.line(14, 30, pageWidth - 14, 30);
        };

        const addFooter = (pageNumber: number) => {
            const footerY = pageHeight - 20;
            doc.setDrawColor(marinexBlue);
            doc.setLineWidth(0.5);
            doc.line(14, footerY, pageWidth - 14, footerY);

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(midGray);
            doc.text('Marinex Inc. | Generated by Marinex Portal', 14, footerY + 8);
            doc.text(`Page ${pageNumber}`, pageWidth - 14, footerY + 8, { align: 'right' });
            doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, footerY + 12);
        };
        
        const addWatermark = () => {
            doc.setFontSize(50);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(230, 230, 230); // Light gray
            doc.text('FOR BIDDING PURPOSES', pageWidth / 2, pageHeight / 2, {
                align: 'center',
                angle: 45
            });
        };

        let pageNumber = 1;
        addHeader();
        addFooter(pageNumber);
        addWatermark();
        let yPosition = 45;

        // Section: Project Information
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(marinexBlue);
        doc.text('PROJECT & VESSEL INFORMATION', 14, yPosition);
        yPosition += 4;
        doc.setDrawColor(lightGray);
        doc.setLineWidth(0.2);
        doc.line(14, yPosition, pageWidth - 14, yPosition);
        yPosition += 8;

        const projectInfo = [
            { label: 'Vessel Name:', value: selectedRequest?.vessel?.name || 'N/A' },
            { label: 'IMO Number:', value: selectedRequest?.vessel?.imo_number || 'N/A' },
            { label: 'Ship Type:', value: selectedRequest?.vessel?.ship_type || 'N/A' },
            { label: 'Flag:', value: selectedRequest?.vessel?.flag || 'N/A' },
            { label: 'Requesting Company:', value: selectedRequest?.company_name || 'N/A' },
            { label: 'Request Date:', value: selectedRequest?.request_date ? new Date(selectedRequest.request_date).toLocaleDateString() : 'N/A' },
        ];

        doc.setFontSize(10);
        projectInfo.forEach(info => {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(darkGray);
            doc.text(info.label, 16, yPosition);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(midGray);
            doc.text(info.value, 70, yPosition);
            yPosition += 7;
        });

        const checkNewPage = (extraHeight = 0) => {
            if (yPosition + extraHeight > pageHeight - 30) {
                doc.addPage();
                pageNumber++;
                yPosition = 45;
                addHeader();
                addFooter(pageNumber);
                addWatermark();
                return true;
            }
            return false;
        };
        
        yPosition += 5;
        checkNewPage();

        // Section: Scope of Work (Services)
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(marinexBlue);
        doc.text('SCOPE OF WORK - REQUESTED SERVICES', 14, yPosition);
        yPosition += 4;
        doc.setDrawColor(lightGray);
        doc.line(14, yPosition, pageWidth - 14, yPosition);
        yPosition += 8;

        const servicesTable = results.services.map(s => [s.name, `${s.reqSqM.toLocaleString()} m²`, `₱${s.unitPrice.toLocaleString()}`, `₱${s.serviceCost.toLocaleString()}`]);
        
        // Manual table drawing
        const tableHeaders = ['Service Description', 'Area', 'Unit Price', 'Total Service Cost'];
        const colWidths = [80, 30, 40, 40];
        const startX = 14;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(lightGray);
        doc.rect(startX, yPosition, colWidths.reduce((a,b) => a+b), 8, 'F');
        let currentX = startX + 2;
        tableHeaders.forEach((header, i) => {
            doc.text(header, currentX, yPosition + 6);
            currentX += colWidths[i];
        });
        yPosition += 8;

        doc.setFont('helvetica', 'normal');
        servicesTable.forEach((row, rowIndex) => {
            checkNewPage(8);
            if(rowIndex % 2 === 1) {
                doc.setFillColor(248, 249, 250); // very light gray
                doc.rect(startX, yPosition, colWidths.reduce((a,b) => a+b), 8, 'F');
            }
            currentX = startX + 2;
            row.forEach((cell, i) => {
                doc.text(cell, currentX, yPosition + 6);
                currentX += colWidths[i];
            });
            yPosition += 8;
        });

        // Subtotal
        yPosition += 2;
        doc.setFont('helvetica', 'bold');
        doc.text('Service Subtotal:', startX + colWidths[0] + colWidths[1] + colWidths[2] - 2, yPosition + 6, { align: 'right' });
        doc.text(`₱${results.finalBid.toLocaleString()}`, startX + colWidths.reduce((a,b) => a+b) - 2, yPosition + 6, { align: 'right' });
        yPosition += 10;
        
        checkNewPage(20);

        // Section: Schedule & Timelines
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(marinexBlue);
        doc.text('PROPOSED SCHEDULE', 14, yPosition);
        yPosition += 4;
        doc.setDrawColor(lightGray);
        doc.line(14, yPosition, pageWidth - 14, yPosition);
        yPosition += 8;

        const scheduleInfo = [
            { label: 'Estimated Project Duration:', value: `${Math.round(results.totalDurationDays || 0)} calendar days` },
            { label: 'Proposed Start Date:', value: formatDisplayDate(results.scheduleDetails?.startDate) },
            { label: 'Proposed Completion Date:', value: formatDisplayDate(results.scheduleDetails?.endDate) },
            { label: 'Liquidated Damages:', value: results.scheduleDetails?.penalties?.description || 'N/A' }
        ];

        doc.setFontSize(10);
        scheduleInfo.forEach(info => {
            checkNewPage(7);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(darkGray);
            doc.text(info.label, 16, yPosition);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(midGray);
            doc.text(info.value, 70, yPosition);
            yPosition += 7;
        });
        yPosition += 5;

        checkNewPage(20);

        // Section: Financial Summary
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(marinexBlue);
        doc.text('FINANCIAL SUMMARY', 14, yPosition);
        yPosition += 4;
        doc.setDrawColor(lightGray);
        doc.line(14, yPosition, pageWidth - 14, yPosition);
        yPosition += 8;

        doc.setFillColor(lightGray);
        doc.rect(14, yPosition, pageWidth - 28, 30, 'F');
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(darkGray);
        doc.text('Service Subtotal:', 20, yPosition + 8);
        doc.text(`₱${results.finalBid.toLocaleString()}`, pageWidth - 20, yPosition + 8, {align: 'right'});

        doc.text('Additional Upfront Costs (Tender Fee, Security, etc.):', 20, yPosition + 16);
        doc.text(`₱${(results.additionalCosts?.total || 0).toLocaleString()}`, pageWidth - 20, yPosition + 16, {align: 'right'});

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(marinexBlue);
        doc.text('Grand Total Bid Amount:', 20, yPosition + 25);
        doc.text(`PHP ${results.grandTotal.toLocaleString()}`, pageWidth - 20, yPosition + 25, {align: 'right'});
        yPosition += 35;
        
        checkNewPage(40);
        
        // Section: Terms and Conditions
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(marinexBlue);
        doc.text('TERMS & CONDITIONS', 14, yPosition);
        yPosition += 4;
        doc.setDrawColor(lightGray);
        doc.line(14, yPosition, pageWidth - 14, yPosition);
        yPosition += 8;

        doc.setFontSize(9);
        doc.setTextColor(darkGray);
        doc.setFont('helvetica', 'bold');
        doc.text('Payment Terms:', 16, yPosition);
        yPosition += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(midGray);
        results.contractConditions?.paymentTerms.forEach(term => {
            checkNewPage(5);
            doc.text(`• ${term}`, 20, yPosition);
            yPosition += 5;
        });

        checkNewPage(15);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(darkGray);
        doc.text('Warranty:', 16, yPosition);
        yPosition += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(midGray);
        const warrantyText = doc.splitTextToSize(results.contractConditions?.warranty || 'N/A', pageWidth - 36);
        doc.text(warrantyText, 20, yPosition);
        yPosition += warrantyText.length * 4;
        
        yPosition += 10;
        checkNewPage(10);

        // Signature Section
        const signatureY = pageHeight - 60;
        if (yPosition > signatureY - 10) {
            checkNewPage(60);
            yPosition = signatureY - 20;
        } else {
            yPosition = signatureY - 20;
        }
        
        doc.setDrawColor(darkGray);
        doc.setLineWidth(0.3);
        doc.line(14, yPosition, 80, yPosition);
        doc.line(pageWidth - 80, yPosition, pageWidth - 14, yPosition);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(darkGray);
        doc.text('Authorized Shipyard Representative', 14, yPosition + 5);
        doc.text('Shipowner Representative (for acceptance)', pageWidth - 14, yPosition + 5, { align: 'right' });
        
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
                        fetchBidHistory();
                        setShowHistoryDialog(true);
                    }}
                    variant="outline"
                >
                    Show History
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
            <Dialog open={openBidDialog} onOpenChange={(open) => {
                setOpenBidDialog(open);
                if (!open) {
                    // Reset form when dialog closes
                    setBidForm({
                        servicesOffered: [],
                        unitCost: ''
                    });
                    setCalculationResults(null);
                    setBidDocumentUrl(null);
                    setLiquidatedDamagesRate(0.5);
                }
            }}>
                <DialogContent className="!w-[600px] !max-w-[95vw]">
                    <DialogHeader>
                        <DialogTitle>Bid Drydock</DialogTitle>
                        <DialogDescription>Select the services you can provide and submit your bid.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-6">
                        {/* Your Available Services */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-700">Select Services</h3>
                            <div className="overflow-y-auto max-h-[300px]">
                                {shipyardServices.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        {shipyardServices.map((service, index) => {
                                            const isSelected = bidForm.servicesOffered.includes(service);
                                            return (
                                                <div
                                                    key={index}
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setBidForm(prev => ({
                                                                ...prev,
                                                                servicesOffered: prev.servicesOffered.filter(s => s !== service)
                                                            }));
                                                        } else {
                                                            setBidForm(prev => ({
                                                                ...prev,
                                                                servicesOffered: [...prev.servicesOffered, service]
                                                            }));
                                                        }
                                                    }}
                                                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                                        isSelected
                                                            ? 'border-blue-500 bg-blue-50 shadow-md'
                                                            : 'border-gray-300 bg-white hover:border-gray-400 hover:shadow-sm'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                                                            {service}
                                                        </span>
                                                        {isSelected && (
                                                            <svg
                                                                className="w-5 h-5 text-blue-600"
                                                                fill="currentColor"
                                                                viewBox="0 0 20 20"
                                                            >
                                                                <path
                                                                    fillRule="evenodd"
                                                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                                                    clipRule="evenodd"
                                                                />
                                                            </svg>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <span className="text-sm text-gray-500">No services available</span>
                                )}
                            </div>
                        </div>

                        {/* Liquidated Damages */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-700">Contract Terms</h3>
                            <label className="flex flex-col gap-1 text-sm text-gray-600">
                                <span>Liquidated Damages (% of contract per delayed day)</span>
                                <Input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    value={liquidatedDamagesRate}
                                    onChange={(e) => setLiquidatedDamagesRate(Number(e.target.value) || 0)}
                                    className="h-9"
                                    placeholder="0.5"
                                />
                            </label>
                            <p className="text-xs text-gray-500">
                                Start date will be set to today. Completion date will be calculated based on service duration.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button className='cursor-pointer' variant="outline" onClick={() => setShowCancelConfirm(true)}>Cancel</Button>
                        <Button 
                            className='cursor-pointer bg-blue-600 hover:bg-blue-700 text-white' 
                            onClick={calculateBid}
                            disabled={bidForm.servicesOffered.length === 0 || isCalculating}
                        >
                            {isCalculating ? 'Calculating...' : 'Calculate'}
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
                        <Button variant="destructive" onClick={() => {
                            // Reset all form data
                            setBidForm({
                                servicesOffered: [],
                                unitCost: ''
                            });
                            setCalculationResults(null);
                            setBidDocumentUrl(null);
                            setLiquidatedDamagesRate(0.5);
                            setShowCancelConfirm(false);
                            setOpenBidDialog(false);
                        }}>Yes, Cancel</Button>
                    </ConfirmDialogFooter>
                </ConfirmDialogContent>
            </ConfirmDialog>

            {/* Calculation Results Dialog */}
            <Dialog open={showCalculationDialog} onOpenChange={(open) => {
                setShowCalculationDialog(open);
                if (!open) {
                    setIsSubmittingBid(false);
                }
            }}>
                <DialogContent className="!w-[800px] !max-w-[95vw] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-[#134686] text-xl font-bold">Bid Calculation Results</DialogTitle>
                        <DialogDescription>Detailed breakdown of your bid calculation using the provided formula.</DialogDescription>
                    </DialogHeader>
                    {calculationResults && (
                        <div className="space-y-6">
                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                            <div className="rounded-lg border border-gray-200 bg-white p-3 ">
                                    <p className="text-[10px] font-semibold uppercase text-gray-500">Services</p>
                                    <p className="mt-1 text-xl font-bold text-gray-900">{totalServicesSelected}</p>
                                </div>
                                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                                    <p className="text-[10px] font-semibold uppercase text-blue-900">Total Duration</p>
                                    <p className="mt-1 text-xl font-bold text-blue-900">{totalDurationDays} days</p>
                                </div>
                                <div className="rounded-lg border border-yellow-100 bg-yellow-50 p-3 ">
                                    <p className="text-[10px] font-semibold uppercase text-yellow-900">Subtotal</p>
                                    <p className="mt-1 text-xl font-bold text-yellow-900">₱{subtotalAmount.toLocaleString()}</p>
                                </div>
                                <div className="rounded-lg border border-green-100 bg-green-50 p-3">
                                    <p className="text-[10px] font-semibold uppercase text-green-700">Grand Total</p>
                                    <p className="mt-1 text-xl font-bold text-green-700">₱{grandTotalAmount.toLocaleString()}</p>
                                </div>
                               
                               
                               
                            </div>

                            {/* Service Details */}
                            <div className="rounded-lg border border-gray-200 bg-white p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                    <h3 className="text-md font-semibold text-gray-900">Service Calculations</h3>
                                </div>
                                <div className="space-y-4">
                                    {calculationResults.services.map((service, index) => {
                                        const pricingItem = pricingBreakdown?.perService.find(item => item.name === service.name);
                                        return (
                                            <div key={index} className="bg-white border-t border-gray-300 p-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-700 text-xs font-semibold">
                                                            {index + 1}
                                                        </div>
                                                        <h4 className="text-sm font-semibold text-gray-900">{service.name}</h4>
                                                    </div>
                                                    <span className="text-base font-bold text-gray-900">₱{service.serviceCost.toLocaleString()}</span>
                                                </div>
                                                {pricingItem && (
                                                    <div className="space-y-2 pt-3 border-t border-gray-200">
                                                        <div className="flex items-center justify-between text-xs">
                                                            <div className="flex items-center gap-4">
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-gray-500">Materials:</span>
                                                                    <span className="font-semibold text-gray-900">₱{pricingItem.materialsCost.toLocaleString()}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-gray-500">Labor:</span>
                                                                    <span className="font-semibold text-gray-900">₱{pricingItem.laborCost.toLocaleString()}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-gray-500">Equipment:</span>
                                                                    <span className="font-semibold text-gray-900">₱{pricingItem.equipmentCost.toLocaleString()}</span>
                                                                </div>
                                                            </div>
                                                            <div className="text-gray-500">
                                                                {service.reqSqM} m² • {Math.round(service.serviceDays)} days
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Bid Summary */}
                            <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
                                <h3 className="text-md font-semibold text-gray-900">Bid Summary</h3>
                                <div className="divide-y divide-gray-100 text-sm">
                                    {calculationResults.services.map((service, index) => (
                                        <div key={index} className="flex items-center justify-between py-2">
                                            <span className="font-medium text-gray-700">{service.name}</span>
                                            <span className="font-semibold text-gray-900">₱{service.serviceCost.toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 space-y-3">
                                    <div className="flex items-center justify-between text-sm font-semibold text-gray-800">
                                        <span>Service Subtotal</span>
                                        <span>₱{calculationResults.finalBid.toLocaleString()}</span>
                                    </div>
                                    {additionalCosts?.items?.length ? (
                                        <div className="rounded-md border border-gray-100 bg-gray-50 p-3 space-y-2">
                                            <p className="text-sm font-semibold text-gray-800">Additional Required Payments</p>
                                            {additionalCosts.items.map((item, index) => (
                                                <div key={index} className="flex items-center justify-between text-sm text-gray-700">
                                                    <span>{item.name}</span>
                                                    <span>₱{item.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                </div>
                                            ))}
                                            <div className="flex items-center justify-between pt-2 border-t border-gray-200 text-sm font-semibold text-gray-800">
                                                <span>Total Upfront Costs</span>
                                                <span>₱{additionalCosts.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                            </div>
                                        </div>
                                    ) : null}
                                    <div className="flex items-center justify-between border-t-2 border-gray-300 pt-4">
                                        <span className="text-lg font-bold text-gray-900">Grand Total</span>
                                        <span className="text-lg font-bold text-green-600">₱{grandTotalAmount.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Generate PDF Section */}
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
                                <div className="flex items-center space-x-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    <div>
                                        <h3 className="text-md font-semibold text-gray-900">Bid Document</h3>
                                        <p className="text-sm text-gray-600">
                                            {isGeneratingDocument ? 'Generating secure PDF...' : bidPdfUrl ? 'Latest PDF bid document is ready.' : 'Document generates automatically after each calculation.'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <Button
                                        variant="outline"
                                        disabled={!bidPdfUrl || isGeneratingDocument}
                                        onClick={() => {
                                            if (bidPdfUrl) {
                                                // Use proxy route to avoid CORS errors
                                                const proxyUrl = `/api/proxy-pdf?url=${encodeURIComponent(bidPdfUrl)}`;
                                                window.open(proxyUrl, '_blank');
                                            }
                                        }}
                                    >
                                        View Bid Document
                                    </Button>
                                    <Button
                                        className="bg-blue-600 hover:bg-blue-700 text-white"
                                        onClick={handleRegenerateDocument}
                                        disabled={isGeneratingDocument || !calculationResults}
                                    >
                                        {isGeneratingDocument ? 'Generating...' : 'Regenerate Document'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCalculationDialog(false)}>Close</Button>
                        <Button 
                            className="bg-green-600 hover:bg-green-700 text-white"
                            disabled={isSubmittingBid}
                            onClick={async () => {
                                if (!selectedRequest || !calculationResults || !user?.id) {
                                    toast({
                                        title: "Error",
                                        description: "Missing required information for bid submission.",
                                        variant: "destructive",
                                    });
                                    return;
                                }

                                setIsSubmittingBid(true);
                                try {
                                    let certificateUrl = bidPdfUrl;
                                    if (!certificateUrl) {
                                        toast({
                                            title: "Generating Certificate",
                                            description: "Creating bid certificate PDF...",
                                        });
                                        certificateUrl = await generatePDF(calculationResults);
                                    }
                                    
                                    if (!certificateUrl) {
                                        toast({
                                            title: "Error",
                                            description: "Failed to generate bid certificate. Please try again.",
                                            variant: "destructive",
                                        });
                                        return;
                                    }

                                    setBidDocumentUrl(certificateUrl);
                                    setCalculationResults(prev => prev ? { ...prev, bidDocumentUrl: certificateUrl } : prev);

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
                                            totalBid: calculationResults.grandTotal,
                                            totalDays: calculationResults.totalDurationDays,
                                            bidCertificateUrl: certificateUrl,
                                            pricingBreakdown: calculationResults.pricingBreakdown,
                                            scheduleDetails: calculationResults.scheduleDetails,
                                            contractConditions: calculationResults.contractConditions,
                                            taxesAndFees: calculationResults.taxesAndFees,
                                            additionalCosts: calculationResults.additionalCosts,
                                            requiredDocumentation: calculationResults.requiredDocumentation
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
                                } finally {
                                    setIsSubmittingBid(false);
                                }
                            }}
                        >
                            {isSubmittingBid ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                'Bid Now'
                            )}
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

            {/* Bid History Dialog */}
            <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
                <DialogContent className="!w-[900px] !max-w-[95vw] h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>My Bid History</DialogTitle>
                        <DialogDescription>
                            A record of all the bids you have submitted.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-grow overflow-y-auto">
                        {loadingHistory ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                                <p className="ml-2 text-gray-600">Loading history...</p>
                            </div>
                        ) : bidHistory.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Vessel Name</TableHead>
                                        <TableHead>Company</TableHead>
                                        <TableHead>Bid Amount</TableHead>
                                        <TableHead>Bid Date</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {bidHistory.map((bid, index) => (
                                        <TableRow key={index}>
                                            <TableCell>{bid.vesselName}</TableCell>
                                            <TableCell>{bid.companyName}</TableCell>
                                            <TableCell>₱{bid.bidAmount.toLocaleString()}</TableCell>
                                            <TableCell>{new Date(bid.bidDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        bid.status === 'ACCEPTED' ? 'default' :
                                                        bid.status === 'REJECTED' ? 'destructive' :
                                                        'secondary'
                                                    }
                                                    className={
                                                        bid.status === 'ACCEPTED' ? 'bg-green-500 text-white' : ''
                                                    }
                                                >
                                                    {bid.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {bid.certificateUrl ? (
                                                    <a href={`/api/proxy-pdf?url=${encodeURIComponent(bid.certificateUrl)}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                                        View
                                                    </a>
                                                ) : (
                                                    'N/A'
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-gray-500">You have not submitted any bids yet.</p>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowHistoryDialog(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

    </SidebarProvider>
  )
}

