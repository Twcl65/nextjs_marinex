import { ShipyardSidebar } from "@/components/shipyard-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { ProfileDropdown } from "@/components/ProfileDropdown"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Upload, Download, Eye, Edit, Search, Plus, File, Folder } from "lucide-react"
import { ProtectedRoute } from "@/components/ProtectedRoute"

export default function ManageDocumentsPage() {
  return (
    <ProtectedRoute allowedRoles={['SHIPYARD']}>
      <SidebarProvider>
        <ShipyardSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <div className="flex-1">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbPage>Shipyard</BreadcrumbPage>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Manage Documents</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="ml-auto">
              <ProfileDropdown />
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4">
            {/* Document Management Header */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Document Management
                    </CardTitle>
                    <CardDescription>
                      Manage project documents, certificates, and compliance files
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      New Folder
                    </Button>
                    <Button>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Files
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search documents..." className="pl-10" />
                    </div>
                  </div>
                  <Select>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="project">Project Documents</SelectItem>
                      <SelectItem value="certificate">Certificates</SelectItem>
                      <SelectItem value="compliance">Compliance</SelectItem>
                      <SelectItem value="safety">Safety Documents</SelectItem>
                      <SelectItem value="technical">Technical Specs</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Filter by project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Projects</SelectItem>
                      <SelectItem value="ocean-star">Ocean Star</SelectItem>
                      <SelectItem value="marine-explorer">Marine Explorer</SelectItem>
                      <SelectItem value="sea-breeze">Sea Breeze</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Document Categories */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Project Documents</CardTitle>
                  <File className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">45</div>
                  <p className="text-xs text-muted-foreground">
                    Active project files
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Certificates</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">23</div>
                  <p className="text-xs text-muted-foreground">
                    Valid certificates
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Compliance</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">18</div>
                  <p className="text-xs text-muted-foreground">
                    Compliance documents
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Safety Docs</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">12</div>
                  <p className="text-xs text-muted-foreground">
                    Safety protocols
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Document List */}
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
                <CardDescription>
                  Browse and manage your document library
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Modified</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Folder className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">Ocean Star Project</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">Folder</Badge>
                      </TableCell>
                      <TableCell>Ocean Star</TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>Dec 10, 2024</TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Eye className="mr-1 h-3 w-3" />
                            Open
                          </Button>
                          <Button size="sm" variant="outline">
                            <Edit className="mr-1 h-3 w-3" />
                            Rename
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    
                    <TableRow>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-red-500" />
                          <span>Hull_Repair_Specifications.pdf</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">Technical Spec</Badge>
                      </TableCell>
                      <TableCell>Ocean Star</TableCell>
                      <TableCell>2.4 MB</TableCell>
                      <TableCell>Dec 8, 2024</TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800">Approved</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Eye className="mr-1 h-3 w-3" />
                            View
                          </Button>
                          <Button size="sm" variant="outline">
                            <Download className="mr-1 h-3 w-3" />
                            Download
                          </Button>
                          <Button size="sm" variant="outline">
                            <Edit className="mr-1 h-3 w-3" />
                            Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    
                    <TableRow>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-green-500" />
                          <span>Safety_Certificate_2024.pdf</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">Certificate</Badge>
                      </TableCell>
                      <TableCell>General</TableCell>
                      <TableCell>1.8 MB</TableCell>
                      <TableCell>Nov 15, 2024</TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800">Valid</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Eye className="mr-1 h-3 w-3" />
                            View
                          </Button>
                          <Button size="sm" variant="outline">
                            <Download className="mr-1 h-3 w-3" />
                            Download
                          </Button>
                          <Button size="sm" variant="outline">
                            <Edit className="mr-1 h-3 w-3" />
                            Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    
                    <TableRow>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-500" />
                          <span>Marine_Explorer_Progress_Report.docx</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">Progress Report</Badge>
                      </TableCell>
                      <TableCell>Marine Explorer</TableCell>
                      <TableCell>856 KB</TableCell>
                      <TableCell>Dec 12, 2024</TableCell>
                      <TableCell>
                        <Badge className="bg-yellow-100 text-yellow-800">Draft</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Eye className="mr-1 h-3 w-3" />
                            View
                          </Button>
                          <Button size="sm" variant="outline">
                            <Download className="mr-1 h-3 w-3" />
                            Download
                          </Button>
                          <Button size="sm" variant="outline">
                            <Edit className="mr-1 h-3 w-3" />
                            Edit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    
                    <TableRow>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-orange-500" />
                          <span>Compliance_Checklist_2024.xlsx</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">Compliance</Badge>
                      </TableCell>
                      <TableCell>General</TableCell>
                      <TableCell>1.2 MB</TableCell>
                      <TableCell>Dec 5, 2024</TableCell>
                      <TableCell>
                        <Badge className="bg-red-100 text-red-800">Expired</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            <Eye className="mr-1 h-3 w-3" />
                            View
                          </Button>
                          <Button size="sm" variant="outline">
                            <Download className="mr-1 h-3 w-3" />
                            Download
                          </Button>
                          <Button size="sm" variant="outline">
                            <Edit className="mr-1 h-3 w-3" />
                            Renew
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest document activities and updates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Hull_Repair_Specifications.pdf uploaded</p>
                      <p className="text-xs text-muted-foreground">2 hours ago by John Smith</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Marine_Explorer_Progress_Report.docx updated</p>
                      <p className="text-xs text-muted-foreground">4 hours ago by Sarah Johnson</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="w-2 h-2 bg-yellow-600 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Safety_Certificate_2024.pdf approved</p>
                      <p className="text-xs text-muted-foreground">1 day ago by Mike Wilson</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Compliance_Checklist_2024.xlsx expired</p>
                      <p className="text-xs text-muted-foreground">3 days ago - System Alert</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRoute>
  )
}
