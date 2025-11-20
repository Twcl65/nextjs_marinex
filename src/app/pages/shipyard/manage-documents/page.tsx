"use client"

import { useState, useEffect } from "react"
import { ShipyardSidebar } from "@/components/shipyard-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppHeader } from "@/components/AppHeader"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/contexts/AuthContext"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { FileText, Download, ExternalLink, Ship, Calendar } from "lucide-react"

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
}

export default function ManageDocumentsPage() {
  const { user, token } = useAuth()
  const { toast } = useToast()
  const [certificates, setCertificates] = useState<IssuedCertificate[]>([])
  const [loading, setLoading] = useState(true)

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
            <div className="mb-6">
              <h1 className="text-lg md:text-xl font-bold text-[#134686]">Document Management</h1>
              <p className="text-sm text-muted-foreground mt-1">View and manage certificates you have issued to vessel owners.</p>
            </div>

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
              <Card>
                <CardHeader>
                  <CardTitle>Issued Certificates</CardTitle>
                  <CardDescription>
                    All certificates you have issued to vessel owners. Total: {certificates.length}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Certificate Name</TableHead>
                          <TableHead>Vessel</TableHead>
                          <TableHead>IMO Number</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Issue Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {certificates.map((certificate) => {
                          const status = getCertificateStatus(certificate.issuedDate)
                          return (
                            <TableRow key={certificate.id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-gray-500" />
                                  {certificate.certificateName}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Ship className="h-4 w-4 text-gray-400" />
                                  {certificate.vesselName}
                                </div>
                              </TableCell>
                              <TableCell>{certificate.imoNumber}</TableCell>
                              <TableCell>{certificate.companyName}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-gray-400" />
                                  {new Date(certificate.issuedDate).toLocaleDateString()}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  className={
                                    status === 'new' 
                                      ? 'bg-green-100 text-green-800 border-green-200' 
                                      : 'bg-gray-100 text-gray-800 border-gray-200'
                                  }
                                >
                                  {status === 'new' ? 'New' : 'Old'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {certificate.certificateUrl ? (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleDownloadCertificate(certificate)}
                                        className="gap-2"
                                      >
                                        <Download className="h-4 w-4" />
                                        Download
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleDownloadCertificate(certificate)}
                                        className="gap-2"
                                      >
                                        <ExternalLink className="h-4 w-4" />
                                        View
                                      </Button>
                                    </>
                                  ) : (
                                    <Badge variant="outline" className="text-sm">
                                      Processing...
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </SidebarInset>
        <Toaster />
      </SidebarProvider>
    </ProtectedRoute>
  )
}
