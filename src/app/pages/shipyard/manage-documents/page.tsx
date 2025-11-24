"use client"

import { useState, useEffect, useMemo } from "react"
import { ShipyardSidebar } from "@/components/shipyard-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppHeader } from "@/components/AppHeader"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/contexts/AuthContext"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { FileText, Download, ExternalLink, Ship, Calendar, Search } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface IssuedCertificate {
  id: string
  drydockBookingId: string
  vesselId: string
  certificateName: string
  certificateType: string
  certificateUrl: string | null
  issuedDate: string
  createdAt: string
  updatedAt: string
  vesselName: string
  imoNumber: string
  companyName: string
  companyLogoUrl?: string | null
}

interface VesselGroup {
  vesselId: string
  vesselName: string
  imoNumber: string
  documentCount: number
  documents: IssuedCertificate[]
}

interface CompanyGroup {
  companyName: string
  totalDocuments: number
  vessels: VesselGroup[]
  latestIssuedDate: string | null
  companyLogoUrl?: string | null
}

const CompanyLogo = ({ companyName, logoUrl }: { companyName: string; logoUrl?: string | null }) => {
  const [signedLogoUrl, setSignedLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const fetchLogo = async () => {
      if (!logoUrl || logoUrl === 'null' || logoUrl.trim() === '') {
        setSignedLogoUrl(null)
        return
      }

      try {
        const response = await fetch(`/api/signed-url?url=${encodeURIComponent(logoUrl)}`)
        if (!response.ok) {
          throw new Error('Failed to fetch signed URL')
        }
        const data = await response.json()
        if (isMounted) {
          setSignedLogoUrl(data.signedUrl || null)
        }
      } catch (error) {
        if (isMounted) {
          setSignedLogoUrl(null)
        }
      }
    }

    fetchLogo()

    return () => {
      isMounted = false
    }
  }, [logoUrl])

  return (
    <Avatar className="h-8 w-8 bg-gray-100 border border-gray-200">
      {signedLogoUrl ? (
        <AvatarImage src={signedLogoUrl} alt={companyName} className="object-cover" />
      ) : (
        <AvatarFallback className="text-xs font-medium text-gray-600">
          {companyName.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      )}
    </Avatar>
  )
}

export default function ManageDocumentsPage() {
  const { user, token } = useAuth()
  const { toast } = useToast()
  const [certificates, setCertificates] = useState<IssuedCertificate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<CompanyGroup | null>(null)
  const [documentsDialogOpen, setDocumentsDialogOpen] = useState(false)
  const [selectedVessel, setSelectedVessel] = useState<VesselGroup | null>(null)
  const [pagination, setPagination] = useState({
    currentPage: 1,
    rowsPerPage: 5,
  })

  useEffect(() => {
    if (user?.id && token) {
      fetchCertificates()
    }
  }, [user?.id, token])

  const fetchCertificates = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/shipyard/issued-certificates', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setCertificates(data.data || [])
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast({
          variant: "destructive",
          title: "Error",
          description: errorData.error || "Failed to fetch certificates",
        })
      }
    } catch (error) {
      console.error('Error fetching certificates:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred while fetching certificates",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadCertificate = async (certificate: IssuedCertificate) => {
    if (!certificate.certificateUrl) {
      toast({
        title: "Certificate Not Available",
        description: "This certificate PDF is still being processed. Please try again later.",
      })
      return
    }

    try {
      let documentUrl = certificate.certificateUrl
      
      if (documentUrl.includes('s3.amazonaws.com') || documentUrl.includes('amazonaws.com')) {
        const response = await fetch(`/api/signed-url?url=${encodeURIComponent(documentUrl)}`)
        if (response.ok) {
          const data = await response.json()
          if (data.signedUrl) {
            documentUrl = data.signedUrl
          }
        }
      }

      window.open(documentUrl, '_blank')
    } catch (error) {
      console.error('Error downloading certificate:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to download certificate",
      })
    }
  }

  // Helper function to determine status (new if issued within last 7 days, otherwise old)
  const getCertificateStatus = (issuedDate: string): string => {
    const now = new Date()
    const issued = new Date(issuedDate)
    const daysDiff = Math.floor((now.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24))
    return daysDiff <= 7 ? 'new' : 'old'
  }

  const companyGroups = useMemo<CompanyGroup[]>(() => {
    const map = new Map<string, {
      totalDocuments: number
      vessels: Map<string, VesselGroup>
      latestIssuedDate: Date | null
      companyLogoUrl: string | null
    }>()

    certificates.forEach((cert) => {
      if (!map.has(cert.companyName)) {
        map.set(cert.companyName, {
          totalDocuments: 0,
          vessels: new Map(),
          latestIssuedDate: null,
          companyLogoUrl: null
        })
      }
      const companyData = map.get(cert.companyName)!
      companyData.totalDocuments += 1
      const issuedDate = new Date(cert.issuedDate)
      if (!companyData.latestIssuedDate || issuedDate > companyData.latestIssuedDate) {
        companyData.latestIssuedDate = issuedDate
      }
      const vesselKey = cert.vesselId || `${cert.vesselName}-${cert.imoNumber}`
      if (!companyData.vessels.has(vesselKey)) {
        companyData.vessels.set(vesselKey, {
          vesselId: cert.vesselId,
          vesselName: cert.vesselName,
          imoNumber: cert.imoNumber,
          documentCount: 0,
          documents: []
        })
      }

      const vesselData = companyData.vessels.get(vesselKey)!
      vesselData.documentCount += 1
      vesselData.documents.push(cert)

      if (!companyData.companyLogoUrl && cert.companyLogoUrl) {
        companyData.companyLogoUrl = cert.companyLogoUrl
      }
    })

    return Array.from(map.entries()).map(([companyName, value]) => ({
      companyName,
      totalDocuments: value.totalDocuments,
      vessels: Array.from(value.vessels.values()).sort((a, b) => a.vesselName.localeCompare(b.vesselName)),
      latestIssuedDate: value.latestIssuedDate ? value.latestIssuedDate.toISOString() : null,
      companyLogoUrl: value.companyLogoUrl || null
    }))
  }, [certificates])

  const filteredCompanies = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    return companyGroups.filter(group => {
      if (!term) {
        return true
      }
      return (
        group.companyName.toLowerCase().includes(term) ||
        group.vessels.some(vessel =>
          vessel.vesselName.toLowerCase().includes(term) ||
          vessel.imoNumber.toLowerCase().includes(term)
        )
      )
    })
  }, [companyGroups, searchTerm])

  useEffect(() => {
    setPagination(prev => ({ ...prev, currentPage: 1 }))
  }, [searchTerm])

  const totalFilteredCompanies = filteredCompanies.length
  const totalPages = Math.max(1, Math.ceil(totalFilteredCompanies / pagination.rowsPerPage))
  const currentPage = Math.min(pagination.currentPage, totalPages)
  const startIndex = (currentPage - 1) * pagination.rowsPerPage
  const companiesForPage = filteredCompanies.slice(startIndex, startIndex + pagination.rowsPerPage)

  const handleViewVessels = (company: CompanyGroup) => {
    setSelectedCompany(company)
    setCompanyDialogOpen(true)
  }

  const handleViewDocuments = (vessel: VesselGroup) => {
    setSelectedVessel(vessel)
    setDocumentsDialogOpen(true)
  }

  return (
    <ProtectedRoute allowedRoles={['SHIPYARD']}>
      <SidebarProvider>
        <ShipyardSidebar />
        <SidebarInset>
          <AppHeader 
            breadcrumbs={[
              { label: "Dashboard", href: "/pages/shipyard" },
              { label: "Manage Documents", isCurrentPage: true }
            ]} 
          />

          <div className="px-6 py-0 pb-6 pt-0 mt-0">
            <div className="mb-4">
              <h1 className="text-lg md:text-xl font-bold text-[#134686]">Document Management</h1>
              <p className="text-sm text-muted-foreground mt-1">View and manage certificates you have issued to vessel owners.</p>
            </div>

            {certificates.length > 0 && (
              <div className="flex items-center gap-3 mb-4">
                <label htmlFor="company-search" className="text-sm font-medium text-gray-700 whitespace-nowrap">Search:</label>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    id="company-search"
                    placeholder="Search by company, vessel name, or IMO number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#134686]"></div>
                <span className="ml-2 text-sm text-gray-600">Loading certificates...</span>
              </div>
            ) : certificates.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Certificates Issued</h3>
                    <p className="text-sm text-gray-600">
                      You haven&apos;t issued any certificates yet. Certificates will appear here after you issue them from the Drydock Operations page.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="min-w-[220px] h-10">Company</TableHead>
                        <TableHead className="w-32 h-10">Vessels</TableHead>
                        <TableHead className="w-40 h-10">Document Count</TableHead>
                        <TableHead className="h-10">Latest Document</TableHead>
                        <TableHead className="w-40 text-right h-10">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companiesForPage.map((company: CompanyGroup) => (
                        <TableRow key={company.companyName} className="h-10">
                          <TableCell className="font-medium py-2">
                            <div className="flex items-center gap-3">
                              <CompanyLogo companyName={company.companyName} logoUrl={company.companyLogoUrl} />
                              <span>{company.companyName}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-2">{company.vessels.length} vessel{company.vessels.length !== 1 ? 's' : ''}</TableCell>
                          <TableCell className="py-2">{company.totalDocuments} document{company.totalDocuments !== 1 ? 's' : ''}</TableCell>
                        <TableCell className="text-sm text-gray-600 py-2">
                          {company.latestIssuedDate
                            ? new Date(company.latestIssuedDate).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : 'No documents yet'}
                        </TableCell>
                          <TableCell className="text-right py-2">
                            <Button
                              size="sm"
                              onClick={() => handleViewVessels(company)}
                              className="bg-[#134686] text-white hover:bg-[#0f3a6d]"
                            >
                              View Vessels
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {companiesForPage.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-sm text-gray-500 py-8">
                            No companies match your filters.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex mt-3 flex-col md:flex-row items-center justify-between text-sm text-gray-500 gap-3">
                  <div>
                    {totalFilteredCompanies === 0
                      ? '0 of 0 companies'
                      : `${startIndex + 1}-${Math.min(startIndex + pagination.rowsPerPage, totalFilteredCompanies)} of ${totalFilteredCompanies} companies`}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span>Rows per page</span>
                      <select
                        value={pagination.rowsPerPage}
                        onChange={(e) =>
                          setPagination((prev) => ({
                            ...prev,
                            rowsPerPage: Number(e.target.value),
                            currentPage: 1,
                          }))
                        }
                        className="border border-gray-200 rounded-md px-2 py-1 text-sm"
                      >
                        {[5, 10, 20, 50].map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="px-2 py-1 rounded border border-gray-200 text-sm disabled:opacity-50"
                        onClick={() => setPagination((prev) => ({ ...prev, currentPage: Math.max(1, prev.currentPage - 1) }))}
                        disabled={currentPage === 1}
                      >
                        Prev
                      </button>
                      <span>
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        className="px-2 py-1 rounded border border-gray-200 text-sm disabled:opacity-50"
                        onClick={() => setPagination((prev) => ({ ...prev, currentPage: Math.min(totalPages, prev.currentPage + 1) }))}
                        disabled={currentPage === totalPages || totalFilteredCompanies === 0}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Company Vessels Dialog */}
          <Dialog open={companyDialogOpen} onOpenChange={(open) => {
            setCompanyDialogOpen(open)
            if (!open) {
              setSelectedCompany(null)
            }
          }}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle className="text-[#134686]">
                  {selectedCompany ? `Vessels for ${selectedCompany.companyName}` : 'Vessels'}
                </DialogTitle>
                <DialogDescription>
                  Select a vessel to view the documents your shipyard has provided.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {selectedCompany?.vessels.map((vessel) => (
                  <Card key={`${vessel.vesselId}-${vessel.imoNumber}`} className="border border-gray-200 shadow-sm">
                    <CardContent className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between py-1 px-4">
                      <div className="flex flex-col text-sm text-gray-700">
                        <span className="text-base font-semibold text-gray-900">
                          {vessel.vesselName} (IMO: {vessel.imoNumber})
                        </span>
                        <span className="text-gray-500">
                          {vessel.documentCount} document{vessel.documentCount !== 1 ? 's' : ''} available
                        </span>
                      </div>
                      <Button
                        onClick={() => handleViewDocuments(vessel)}
                        className="bg-[#3C4B64] hover:bg-[#2f3a4f] text-white gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        View Documents
                      </Button>
                    </CardContent>
                  </Card>
                ))}

                {selectedCompany && selectedCompany.vessels.length === 0 && (
                  <p className="text-sm text-gray-500">No vessels available for this company.</p>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Vessel Documents Dialog */}
          <Dialog open={documentsDialogOpen} onOpenChange={(open) => {
            setDocumentsDialogOpen(open)
            if (!open) {
              setSelectedVessel(null)
            }
          }}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-[#134686]">
                  {selectedVessel ? `Documents for ${selectedVessel.vesselName}` : 'Vessel Documents'}
                </DialogTitle>
                <DialogDescription>
                  Only shipyard-issued files (bid certificates and drydock certificates) are shown here.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {selectedVessel?.documents.map((doc) => {
                  const status = getCertificateStatus(doc.issuedDate)
                  return (
                    <div key={doc.id} className="border border-gray-200 rounded-lg p-4 shadow-sm bg-white">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-gray-900 font-semibold">
                            <FileText className="h-4 w-4 text-gray-500" />
                            {doc.certificateName}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            From: {doc.companyName} (Shipowner)
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> Issued {new Date(doc.issuedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={status === 'new' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-800 border-gray-200'}>
                            {status === 'new' ? 'New' : 'Archive'}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {doc.certificateType}
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-3">
                        {doc.certificateUrl ? (
                          <>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white gap-2"
                              onClick={() => handleDownloadCertificate(doc)}
                            >
                              <Download className="h-4 w-4" />
                              Download
                            </Button>
                            <Button
                              size="sm"
                              className="bg-gray-900 hover:bg-gray-800 text-white gap-2"
                              onClick={() => handleDownloadCertificate(doc)}
                            >
                              <ExternalLink className="h-4 w-4" />
                              View
                            </Button>
                          </>
                        ) : (
                          <Badge variant="outline" className="text-sm">
                            Processing PDF...
                          </Badge>
                        )}
                      </div>
                    </div>
                  )
                })}

                {selectedVessel && selectedVessel.documents.length === 0 && (
                  <p className="text-sm text-gray-500">No documents available for this vessel yet.</p>
                )}
              </div>

              
            </DialogContent>
          </Dialog>

        </SidebarInset>
        <Toaster />
      </SidebarProvider>
    </ProtectedRoute>
  )
}
