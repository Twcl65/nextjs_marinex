"use client"

import { useState, useEffect, useCallback } from "react"
import { ShipownerSidebar } from "@/components/shipowner-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppHeader } from "@/components/AppHeader"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { Eye, FileText, Download, ExternalLink, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Vessel {
  id: string
  vesselName: string
  imoNumber: string
  shipType: string
  flag: string
  yearOfBuild: number
  lengthOverall: number
  grossTonnage: number
  vesselImageUrl: string | null
  status: string
  createdAt: string
  documentCount: number
}

interface Document {
  id: string
  vesselId: string
  senderId: string
  documentType: string
  documentName: string
  documentUrl: string
  description: string | null
  createdAt: string
  updatedAt: string
  status?: string | null
  isCertificate?: boolean
  sender: {
    id: string
    name: string | null
    role: string
    logoUrl: string | null
  }
}

export default function ManageDocumentsPage() {
  const { user, token } = useAuth()
  const { toast } = useToast()
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  const [showDocumentsModal, setShowDocumentsModal] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showAddDocumentModal, setShowAddDocumentModal] = useState(false)
  const [isSubmittingDocument, setIsSubmittingDocument] = useState(false)
  const [documentForm, setDocumentForm] = useState({
    documentType: '',
    documentName: '',
    description: '',
    documentFile: null as File | null
  })

  const fetchVessels = useCallback(async () => {
    if (!token) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/shipowner/vessels-with-documents', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setVessels(data.data || [])
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast({
          variant: "destructive",
          title: "Error",
          description: errorData.error || "Failed to fetch vessels",
        })
      }
    } catch (error) {
      console.error('Error fetching vessels:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred while fetching vessels",
      })
    } finally {
      setLoading(false)
    }
  }, [token, toast])

  const fetchDocuments = useCallback(async (vesselId: string) => {
    if (!token) return

    try {
      setLoadingDocuments(true)
      const response = await fetch(`/api/shipowner/vessel-documents?vesselId=${vesselId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setDocuments(data.data || [])
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast({
          variant: "destructive",
          title: "Error",
          description: errorData.error || "Failed to fetch documents",
        })
      }
    } catch (error) {
      console.error('Error fetching documents:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred while fetching documents",
      })
    } finally {
      setLoadingDocuments(false)
    }
  }, [token, toast])

  const handleSyncDocuments = useCallback(async (showToast = true) => {
    if (!token) return

    try {
      setSyncing(true)
      const response = await fetch('/api/shipowner/sync-vessel-documents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        if (showToast && data.synced > 0) {
          toast({
            variant: "success",
            title: "Documents Synced",
            description: data.message || `Successfully synced ${data.synced} documents`,
          })
        }
      } else {
        const errorData = await response.json().catch(() => ({}))
        if (showToast) {
          toast({
            variant: "destructive",
            title: "Sync Failed",
            description: errorData.error || "Failed to sync documents",
          })
        }
      }
    } catch (error) {
      console.error('Error syncing documents:', error)
      if (showToast) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "An error occurred while syncing documents",
        })
      }
    } finally {
      setSyncing(false)
    }
  }, [token, toast])

  // Auto-sync documents when page loads (silent sync, no toast)
  useEffect(() => {
    if (user?.id && token) {
      handleSyncDocuments(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, token])

  // Fetch vessels after sync completes or on initial load
  useEffect(() => {
    if (user?.id && token && !syncing) {
      fetchVessels()
    }
  }, [user?.id, token, syncing, fetchVessels])

  const handleViewDocuments = (vessel: Vessel) => {
    setSelectedVessel(vessel)
    setShowDocumentsModal(true)
    fetchDocuments(vessel.id)
  }

  const handleAddDocument = () => {
    // Close the documents modal first
    setShowDocumentsModal(false)
    // Then open the add document modal after a brief delay
    setTimeout(() => {
      setShowAddDocumentModal(true)
      // Reset form
      setDocumentForm({
        documentType: '',
        documentName: '',
        description: '',
        documentFile: null
      })
    }, 100)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setDocumentForm(prev => ({ ...prev, documentFile: file }))
  }

  const handleSubmitDocument = async () => {
    if (!selectedVessel) return

    if (!documentForm.documentType || !documentForm.documentName || !documentForm.documentFile) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all required fields (Document Type, Document Name, and File)",
      })
      return
    }

    if (!token) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "You must be logged in to add a document",
      })
      return
    }

    setIsSubmittingDocument(true)

    try {
      const formData = new FormData()
      formData.append('vesselId', selectedVessel.id)
      formData.append('documentType', documentForm.documentType)
      formData.append('documentName', documentForm.documentName)
      if (documentForm.description) {
        formData.append('description', documentForm.description)
      }
      formData.append('documentFile', documentForm.documentFile)

      const response = await fetch('/api/shipowner/vessel-documents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      })

      if (response.ok) {
        toast({
          variant: "default",
          title: "Success",
          description: "Document added successfully",
        })
        setShowAddDocumentModal(false)
        // Reset form
        setDocumentForm({
          documentType: '',
          documentName: '',
          description: '',
          documentFile: null
        })
        // Refresh documents list
        fetchDocuments(selectedVessel.id)
        // Refresh vessels list to update document count
        fetchVessels()
        // Reopen the documents dialog after a brief delay
        setTimeout(() => {
          setShowDocumentsModal(true)
        }, 100)
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast({
          variant: "destructive",
          title: "Error",
          description: errorData.error || "Failed to add document",
        })
      }
    } catch (error) {
      console.error('Error adding document:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred while adding the document",
      })
    } finally {
      setIsSubmittingDocument(false)
    }
  }

  const handleDownloadDocument = async (document: Document) => {
    try {
      // Check if it's an issued certificate without URL
      if (document.isCertificate && !document.documentUrl) {
        toast({
          title: "Certificate Record",
          description: "This certificate is being processed. Please try again later.",
        })
        return
      }

      // Check if it's an S3 URL and get signed URL if needed
      let documentUrl = document.documentUrl
      
      if (documentUrl && (documentUrl.includes('s3.amazonaws.com') || documentUrl.includes('amazonaws.com'))) {
        const response = await fetch(`/api/signed-url?url=${encodeURIComponent(documentUrl)}`)
        if (response.ok) {
          const data = await response.json()
          if (data.signedUrl) {
            documentUrl = data.signedUrl
          }
        }
      }

      if (documentUrl) {
        // Open in new tab for download
        window.open(documentUrl, '_blank')
      } else {
        toast({
          title: "No File Available",
          description: "This document does not have a downloadable file.",
        })
      }
    } catch (error) {
      console.error('Error downloading document:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to download document",
      })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getDocumentTypeBadgeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'certificate':
        return 'bg-blue-100 text-blue-800'
      case 'report':
        return 'bg-green-100 text-green-800'
      case 'plan':
        return 'bg-purple-100 text-purple-800'
      case 'other':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <SidebarProvider>
      <ShipownerSidebar />
      <SidebarInset>
        <AppHeader 
          breadcrumbs={[
            { label: "Dashboard", href: "/pages/shipowner" },
            { label: "Manage Documents", isCurrentPage: true }
          ]} 
        />
        <div className="p-3 md:p-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-[#134686]">Manage Documents</h1>
            <p className="text-sm text-muted-foreground mt-1">View and manage documents sent to your vessels by shipowners and marinas.</p>
          </div>
        </div>

        <div className="px-3 md:px-4 pb-4">
          <div className="border border-gray-300 rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Vessel Name</TableHead>
                  <TableHead className="w-[120px]">IMO Number</TableHead>
                  <TableHead className="w-[100px]">Ship Type</TableHead>
                  <TableHead className="w-[80px]">Flag</TableHead>
                  <TableHead className="w-[100px]">Year Built</TableHead>
                  <TableHead className="w-[120px] text-center">Document Count</TableHead>
                  <TableHead className="w-[150px] text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <p className="text-gray-600">Loading vessels...</p>
                    </TableCell>
                  </TableRow>
                ) : vessels.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        
                        <p className="text-gray-600">No vessels found</p>
                        <p className="text-sm text-gray-500">You don&apos;t have any active vessels yet</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  vessels.map((vessel) => (
                    <TableRow key={vessel.id}>
                      <TableCell className="font-medium">{vessel.vesselName}</TableCell>
                      <TableCell>{vessel.imoNumber}</TableCell>
                      <TableCell>{vessel.shipType}</TableCell>
                      <TableCell>{vessel.flag}</TableCell>
                      <TableCell>{vessel.yearOfBuild}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="font-semibold">
                          {vessel.documentCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewDocuments(vessel)}
                          disabled={vessel.documentCount === 0}
                          className="gap-2"
                        >
                          <Eye className="h-4 w-4" />
                          View Documents
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Documents Modal */}
        <Dialog open={showDocumentsModal} onOpenChange={setShowDocumentsModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#134686]">
                Documents for {selectedVessel?.vesselName}
              </DialogTitle>
              <DialogDescription>
                IMO Number: {selectedVessel?.imoNumber} | Total Documents: {documents.length}
              </DialogDescription>
            </DialogHeader>

            <div className="mb-0">
              <Button
                onClick={handleAddDocument}
                className="gap-2 bg-[#134686] hover:bg-[#0f3a6b] text-white"
                variant="default"
              >
                <Plus className="h-4 w-4" />
                Add Document
              </Button>
            </div>

            {loadingDocuments ? (
              <div className="py-8 text-center">
                <p className="text-gray-600">Loading documents...</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="py-8 text-center">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No documents found for this vessel</p>
              </div>
            ) : (
              <div className="space-y-4 mt-4">
                {documents.map((document) => (
                  <div
                    key={document.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-5 w-5 text-gray-500" />
                          <h3 className="font-semibold text-gray-900">{document.documentName}</h3>
                          <Badge className={getDocumentTypeBadgeColor(document.documentType)}>
                            {document.documentType}
                          </Badge>
                          {document.status && (
                            <Badge 
                              className={
                                document.status === 'new' 
                                  ? 'bg-green-100 text-green-800 border-green-200' 
                                  : 'bg-gray-100 text-gray-800 border-gray-200'
                              }
                            >
                              {document.status === 'new' ? 'New' : 'Old'}
                            </Badge>
                          )}
                        </div>
                        
                        {document.description && (
                          <p className="text-sm text-gray-600 mb-2">{document.description}</p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>
                            <strong>From:</strong> {document.sender.name || 'Unknown'} ({document.sender.role})
                          </span>
                          <span>
                            <strong>Sent:</strong> {formatDate(document.createdAt)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {document.documentUrl ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDownloadDocument(document)}
                              className="gap-2"
                            >
                              <Download className="h-4 w-4" />
                              Download
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                handleDownloadDocument(document)
                              }}
                              className="gap-2"
                            >
                              <ExternalLink className="h-4 w-4" />
                              View
                            </Button>
                          </>
                        ) : (
                          <Badge variant="outline" className="text-sm">
                            {document.isCertificate ? 'Processing Certificate...' : 'No File Available'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Add Document Dialog */}
        <Dialog open={showAddDocumentModal} onOpenChange={(open) => {
          setShowAddDocumentModal(open)
          // When closing the add document dialog, reopen the documents dialog
          if (!open && selectedVessel) {
            setTimeout(() => {
              setShowDocumentsModal(true)
            }, 100)
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#134686]">
                Add Document for {selectedVessel?.vesselName}
              </DialogTitle>
              <DialogDescription>
                Upload a new document for this vessel
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="documentType">Document Type <span className="text-red-500">*</span></Label>
                <Select
                  value={documentForm.documentType}
                  onValueChange={(value) => setDocumentForm(prev => ({ ...prev, documentType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Certificate">Certificate</SelectItem>
                    <SelectItem value="Report">Report</SelectItem>
                    <SelectItem value="Plan">Plan</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="documentName">Document Name <span className="text-red-500">*</span></Label>
                <Input
                  id="documentName"
                  placeholder="Enter document name"
                  value={documentForm.documentName}
                  onChange={(e) => setDocumentForm(prev => ({ ...prev, documentName: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter document description (optional)"
                  value={documentForm.description}
                  onChange={(e) => setDocumentForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="documentFile">Document File <span className="text-red-500">*</span></Label>
                <Input
                  id="documentFile"
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                />
                {documentForm.documentFile && (
                  <p className="text-sm text-gray-500">
                    Selected: {documentForm.documentFile.name}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowAddDocumentModal(false)}
                  disabled={isSubmittingDocument}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitDocument}
                  disabled={isSubmittingDocument}
                  className="gap-2"
                >
                  {isSubmittingDocument ? 'Uploading...' : 'Upload Document'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Toaster />
      </SidebarInset>
    </SidebarProvider>
  )
}
