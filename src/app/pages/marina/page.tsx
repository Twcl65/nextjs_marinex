"use client"

import { MarinaSidebar } from "@/components/marina-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppHeader } from "@/components/AppHeader"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { useAuth } from "@/contexts/AuthContext"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  LayoutDashboard, 
  Stamp, 
  Gavel, 
  BadgeCheck, 
  RefreshCcw, 
  Users, 
  FileText, 
  RefreshCw, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  AlertCircle,
  Bell,
  Mail
} from "lucide-react"

export default function MarinaPage() {
  const { user } = useAuth()
  const [dashboardData, setDashboardData] = useState({
    authorityApprovals: 0,
    shipyardBidding: 0,
    monitorCertifications: 0,
    vesselRecertifications: 0,
    manageUsers: 0,
    manageDocuments: 0,
    certificationStatus: [] as Array<{ name: string; status: string; expiryDate: string; progress: number }>,
    activities: [] as Array<{ type: string; message: string; time: string; icon: React.ComponentType<{ className?: string }> }>
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Function to fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch('/api/marina/dashboard-stats')
      
      if (response.ok) {
        const data = await response.json()
        
        // Map icon strings to actual icon components
        const iconMap: { [key: string]: React.ComponentType<{ className?: string }> } = {
          'Stamp': Stamp,
          'Gavel': Gavel,
          'BadgeCheck': BadgeCheck,
          'Users': Users
        }
        
        const activitiesWithIcons = data.activities.map((activity: { type: string; message: string; time: string; icon: string }) => ({
          ...activity,
          icon: iconMap[activity.icon] || Users
        }))
        
        setDashboardData({
          ...data,
          activities: activitiesWithIcons
        })
      } else {
        // Try to get error message from response
        let errorMessage = 'Failed to fetch dashboard data'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          // If response is not JSON, use default message
          errorMessage = `Failed to fetch dashboard data (${response.status})`
        }
        setError(errorMessage)
        console.error('Failed to fetch dashboard data:', errorMessage)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      setError(errorMessage)
      console.error('Error fetching dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch dashboard statistics on mount
  useEffect(() => {
    fetchDashboardData()
  }, [])

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const userInitials = getInitials(user?.fullName || "Maritime Industry Authority")

  return (
    <ProtectedRoute allowedRoles={['MARINA']}>
      <SidebarProvider>
      <MarinaSidebar />
        <SidebarInset className="bg-white">
        <AppHeader 
          breadcrumbs={[
            { label: "Dashboard", href: "/pages/marina" },
            { label: "Marina", isCurrentPage: true }
          ]} 
        />
          
          {/* Welcome Section */}
          <div className="flex items-center justify-between p-5 pb-5 pt-0">
            <div className="flex items-center gap-4">
            
              <div>
                <div className="text-md font-semibold">Welcome back, {user?.fullName || 'Maritime Industry Authority'}!</div>
                <div className="text-sm text-muted-foreground">Here is your marina dashboard overview.</div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mx-5 mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <div>
                  <div className="text-sm font-medium text-red-800">Error loading dashboard</div>
                  <div className="text-xs text-red-600">{error}</div>
                </div>
              </div>
              <button
                onClick={fetchDashboardData}
                className="px-3 py-1.5 text-sm font-medium text-red-800 bg-red-100 hover:bg-red-200 rounded-md transition-colors duration-200 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 px-5">
            {/* Authority Approvals */}
            <Card className="flex flex-row items-center gap-4 h-20 w-full p-4 border border-gray-200 bg-white shadow-sm rounded-lg hover:shadow-md transition-shadow duration-200">
              <div className="w-12 h-12 flex items-center justify-center bg-black rounded-lg shadow-lg">
                <Stamp className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col justify-center h-full">
                <span className="text-xs text-gray-600 font-medium">Authority Approvals</span>
                <span className="text-lg font-bold text-gray-900">{dashboardData.authorityApprovals}</span>
                <span className="text-xs text-gray-500">Pending requests</span>
              </div>
            </Card>

            {/* Shipyard Bidding */}
            <Card className="flex flex-row items-center gap-4 h-20 w-full p-4 border border-gray-200 bg-white shadow-sm rounded-lg hover:shadow-md transition-shadow duration-200">
              <div className="w-12 h-12 flex items-center justify-center bg-green-500 rounded-lg shadow-lg">
                <Gavel className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col justify-center h-full">
                <span className="text-xs text-gray-600 font-medium">Shipyard Bidding</span>
                <span className="text-lg font-bold text-gray-900">{dashboardData.shipyardBidding}</span>
                <span className="text-xs text-gray-500">Active bids</span>
              </div>
            </Card>

            {/* Monitor Certifications */}
            <Card className="flex flex-row items-center gap-4 h-20 w-full p-4 border border-gray-200 bg-white shadow-sm rounded-lg hover:shadow-md transition-shadow duration-200">
              <div className="w-12 h-12 flex items-center justify-center bg-red-500 rounded-lg shadow-lg">
                <BadgeCheck className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col justify-center h-full">
                <span className="text-xs text-gray-600 font-medium">Monitor Certifications</span>
                <span className="text-lg font-bold text-gray-900">{dashboardData.monitorCertifications}</span>
                <span className="text-xs text-gray-500">Active monitoring</span>
              </div>
            </Card>

            {/* Vessel Recertifications */}
            <Card className="flex flex-row items-center gap-4 h-20 w-full p-4 border border-gray-200 bg-white shadow-sm rounded-lg hover:shadow-md transition-shadow duration-200">
              <div className="w-12 h-12 flex items-center justify-center bg-[#FF6C0C] rounded-lg shadow-lg">
                <RefreshCcw className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col justify-center h-full">
                <span className="text-xs text-gray-600 font-medium">Recertifications</span>
                <span className="text-lg font-bold text-gray-900">{dashboardData.vesselRecertifications}</span>
                <span className="text-xs text-gray-500">In progress</span>
              </div>
            </Card>

          </div>

          {/* Second Row Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 px-5">
            {/* Manage Users */}
            <Card className="flex flex-row items-center gap-4 h-20 w-full p-4 border border-gray-200 bg-white shadow-sm rounded-lg hover:shadow-md transition-shadow duration-200">
              <div className="w-12 h-12 flex items-center justify-center bg-[#134686] rounded-lg shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col justify-center h-full">
                <span className="text-xs text-gray-600 font-medium">Manage Users</span>
                <span className="text-lg font-bold text-gray-900">{dashboardData.manageUsers}</span>
                <span className="text-xs text-gray-500">Total users</span>
              </div>
            </Card>

           
            
            {/* Empty divs to maintain grid structure */}
            <div></div>
            <div></div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-5 pb-6">
            {/* Monitor Certifications - Left Side */}
            <Card className="h-80 flex flex-col shadow-sm border border-gray-200 bg-white rounded-xl overflow-hidden">
              <div className="px-4 pt-0 pb-0">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-base font-semibold">Monitor Certifications</div>
                    <div className="text-sm text-muted-foreground">Vessel Certification Status</div>
                  </div>
                  <button
                    onClick={fetchDashboardData}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
                    title="Refresh data"
                  >
                    <RefreshCw className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
              <CardContent className="flex-1 p-4 pt-2 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-sm text-gray-500">Loading...</div>
                  </div>
                ) : dashboardData.certificationStatus.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-sm text-gray-500">No certification data available</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dashboardData.certificationStatus.map((cert, index) => (
                    <div key={index} className="p-3 bg-white rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                            cert.status === 'Valid' ? 'border-green-500 bg-green-50' :
                            cert.status === 'Expiring Soon' ? 'border-orange-500 bg-orange-50' :
                            cert.status === 'Notify for Drydocking' ? 'border-red-500 bg-red-50' : 'border-blue-500 bg-blue-50'
                          }`}>
                            {cert.status === 'Notify for Drydocking' ? (
                              <AlertCircle className="w-4 h-4 text-red-500" />
                            ) : (
                              <BadgeCheck className={`w-4 h-4 ${
                                cert.status === 'Valid' ? 'text-green-500' :
                                cert.status === 'Expiring Soon' ? 'text-orange-500' : 'text-blue-500'
                              }`} />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-sm text-gray-900">{cert.name}</div>
                            <div className={`text-xs font-medium ${
                              cert.status === 'Valid' ? 'text-green-600' :
                              cert.status === 'Expiring Soon' ? 'text-orange-600' :
                              cert.status === 'Notify for Drydocking' ? 'text-red-600' : 'text-blue-600'
                            }`}>{cert.status}</div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          Expires: <span className="font-bold text-gray-900">{cert.expiryDate}</span>
                        </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity - Right Side */}
            <Card className="h-80 flex flex-col shadow-sm border border-gray-200 bg-white rounded-xl overflow-hidden">
              <div className="px-4 pt-0 pb-0">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-base font-semibold">Recent Activity</div>
                    <div className="text-sm text-muted-foreground">Latest updates and requests</div>
                  </div>
                  <button
                    onClick={fetchDashboardData}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
                    title="Refresh data"
                  >
                    <RefreshCw className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
              <CardContent className="flex-1 p-4 pt-2 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-sm text-gray-500">Loading...</div>
                  </div>
                ) : dashboardData.activities.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-sm text-gray-500">No recent activities</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {dashboardData.activities.map((activity, index) => {
                    const IconComponent = activity.icon
                    return (
                      <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                        <div className="w-8 h-8 bg-blue-50 border-2 border-blue-200 rounded-full flex items-center justify-center">
                          <IconComponent className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{activity.message}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {activity.time}
                          </div>
                        </div>
                      </div>
                    )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

         
      </SidebarInset>
    </SidebarProvider>
    </ProtectedRoute>
  )
}