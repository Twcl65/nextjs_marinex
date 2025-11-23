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
import { Eye, FileText, Download, ExternalLink, Plus, ChevronLeft, ChevronRight, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { DialogFooter } from "@/components/ui/dialog"

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
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(5)
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
  const [deleteMode, setDeleteMode] = useState(false)
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set())
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

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
    setDeleteMode(false)
    setSelectedDocuments(new Set())
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

  const handleToggleDeleteMode = () => {
    setDeleteMode(!deleteMode)
    setSelectedDocuments(new Set())
  }

  const handleToggleDocumentSelection = (documentId: string) => {
    const newSelected = new Set(selectedDocuments)
    if (newSelected.has(documentId)) {
      newSelected.delete(documentId)
    } else {
      newSelected.add(documentId)
    }
    setSelectedDocuments(newSelected)
  }

  const handleDeleteDocuments = async () => {
    if (selectedDocuments.size === 0) {
      toast({
        variant: "destructive",
        title: "No Selection",
        description: "Please select at least one document to delete",
      })
      return
    }

    setIsDeleting(true)
    try {
      if (!token) {
        toast({
          variant: "destructive",
          title: "Authentication Required",
          description: "You must be logged in to delete documents",
        })
        return
      }

      const deletePromises = Array.from(selectedDocuments).map(async (documentId) => {
        const response = await fetch(`/api/shipowner/vessel-documents?documentId=${documentId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to delete document')
        }

        return response.json()
      })

      await Promise.all(deletePromises)

      toast({
        variant: "default",
        title: "Success",
        description: `Successfully deleted ${selectedDocuments.size} document(s)`,
      })

      // Refresh documents list
      if (selectedVessel) {
        fetchDocuments(selectedVessel.id)
      }
      // Refresh vessels list to update document count
      fetchVessels()

      // Reset delete mode
      setDeleteMode(false)
      setSelectedDocuments(new Set())
      setShowDeleteConfirmDialog(false)
    } catch (error) {
      console.error('Error deleting documents:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete documents. Please try again.",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // Filter and search functions
  const filteredVessels = vessels.filter(vessel => {
    const matchesSearch = searchTerm === "" || 
      vessel.vesselName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vessel.imoNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vessel.shipType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vessel.flag.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesSearch
  })

  // Pagination
  const totalPages = Math.ceil(filteredVessels.length / rowsPerPage)
  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage
  const currentVessels = filteredVessels.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  // Reset to first page when search term changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

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
        <div className="pl-5">
          <div>
            <h1 className="text-xl md:text-xl font-bold text-[#134686]">Manage Documents</h1>
            <p className="text-sm text-muted-foreground mt-1">View and manage documents sent to your vessels by shipowners and marinas.</p>
          </div>
        </div>

        <div className="px-3 md:px-5 pb-0">
          {/* Search Section */}
          <div className="flex flex-wrap items-center gap-4 mb-5 mt-4">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Label htmlFor="search" className="text-xs font-normal whitespace-nowrap">Search:</Label>
              <Input
                id="search"
                placeholder="Search by vessel name, IMO number, ship type, or flag..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full max-w-80"
              />
            </div>
          </div>

          <div className="border border-gray-300 rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow className="align-middle h-4">
                  <TableHead className="whitespace-nowrap py-2 h-12 w-[200px]">Vessel Name</TableHead>
                  <TableHead className="whitespace-nowrap py-2 h-12 w-[120px]">IMO Number</TableHead>
                  <TableHead className="whitespace-nowrap py-2 h-12 w-[100px]">Ship Type</TableHead>
                  <TableHead className="whitespace-nowrap py-2 h-12 w-[80px]">Flag</TableHead>
                  <TableHead className="whitespace-nowrap py-2 h-12 w-[100px]">Year Built</TableHead>
                  <TableHead className="whitespace-nowrap py-2 h-12 w-[120px] text-center">Document Count</TableHead>
                  <TableHead className="whitespace-nowrap py-2 h-12 w-[150px] text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <p className="text-gray-600">Loading vessels...</p>
                    </TableCell>
                  </TableRow>
                ) : filteredVessels.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        
                        <p className="text-sm text-gray-500">
                          {searchTerm ? "No vessels match your search criteria" : "You don't have any active vessels yet"}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  currentVessels.map((vessel) => (
                    <TableRow key={vessel.id} className="align-middle h-6">
                      <TableCell className="py-2 font-medium">{vessel.vesselName}</TableCell>
                      <TableCell className="py-2">{vessel.imoNumber}</TableCell>
                      <TableCell className="py-2">{vessel.shipType}</TableCell>
                      <TableCell className="py-2">{vessel.flag}</TableCell>
                      <TableCell className="py-2">{vessel.yearOfBuild}</TableCell>
                      <TableCell className="py-2 text-center">
                        <Badge className="font-semibold">
                          {vessel.documentCount + ' Documents'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-center">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleViewDocuments(vessel)}
                          disabled={vessel.documentCount === 0}
                          className="gap-2 h-7 px-3 text-xs cursor-pointer bg-gray-600 hover:bg-gray-700 text-white"
                        >
                          <FileText className="h-4 w-4" />
                          View Documents
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          {!loading && filteredVessels.length > 0 && (
            <div className="flex flex-wrap items-center justify-between text-sm px-0 mt-3">
              <div className='text-sm text-gray-500'>
                {filteredVessels.length === 0 ? '0' : `${startIndex + 1} - ${Math.min(endIndex, filteredVessels.length)}`} of {filteredVessels.length} row(s)
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

        {/* Documents Modal */}
        <Dialog open={showDocumentsModal} onOpenChange={(open) => {
          setShowDocumentsModal(open)
          if (!open) {
            // Reset delete mode when closing modal
            setDeleteMode(false)
            setSelectedDocuments(new Set())
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-[#134686]">
                Documents for {selectedVessel?.vesselName}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-0 pt-0 mb-2">
                This is all the list of documents associated with this vessel.
              </p>
              {!loadingDocuments && (
                <div className="flex items-center justify-between mt-2">
                  <Button
                    onClick={handleAddDocument}
                    className="gap-2 bg-green-600 hover:bg-green-700 text-white cursor-pointer"
                    variant="default"
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                    Add Document
                  </Button>
                  <Button
                    onClick={handleToggleDeleteMode}
                    className="gap-2 bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                    variant="default"
                    size="sm"
                  >
                    <Trash2 className="h-4 w-4" />
                    {deleteMode ? 'Cancel' : ''}
                  </Button>
                </div>
              )}
            </DialogHeader>

            {loadingDocuments ? (
              <div className="py-8 text-center">
                <p className="text-gray-600">Loading documents...</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="py-8 text-center">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-600">No documents found for this vessel</p>
              </div>
            ) : (
              <div className="space-y-4 mt-2">
                {deleteMode && selectedDocuments.size > 0 && (
                  <div className="flex items-center justify-between mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <span className="text-sm text-red-700 font-medium">
                      {selectedDocuments.size} document(s) selected
                    </span>
                    <Button
                      onClick={() => setShowDeleteConfirmDialog(true)}
                      className="gap-2 bg-red-600 hover:bg-red-700 text-white"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Selected
                    </Button>
                  </div>
                )}
                {documents.map((document) => (
                  <div
                    key={document.id}
                    className={`border rounded-lg p-4 transition-colors ${
                      deleteMode && selectedDocuments.has(document.id)
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      {deleteMode && (
                        <Checkbox
                          checked={selectedDocuments.has(document.id)}
                          onCheckedChange={() => handleToggleDocumentSelection(document.id)}
                          className="mt-1"
                        />
                      )}
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

                      {!deleteMode && (
                        <div className="flex items-center gap-2">
                          {document.documentUrl ? (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleDownloadDocument(document)}
                                className="gap-2 bg-green-600 hover:bg-green-700 text-white cursor-pointer"
                              >
                                <Download className="h-4 w-4" />
                                Download
                              </Button>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => {
                                  handleDownloadDocument(document)
                                }}
                                className="gap-2 bg-gray-800 hover:bg-gray-900 text-white cursor-pointer"
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
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete {selectedDocuments.size} selected document(s)? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirmDialog(false)}
                disabled={isDeleting}
                className="bg-gray-600 hover:bg-gray-700 text-white border-gray-600 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={handleDeleteDocuments}
                disabled={isDeleting}
                className="gap-2 bg-green-600 hover:bg-green-700 text-white cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
              </Button>
            </DialogFooter>
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
                  <SelectContent className="bg-white">
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
                  className="gap-2 bg-green-600 hover:bg-green-700 text-white cursor-pointer"
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
