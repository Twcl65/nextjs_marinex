"use client"

import { ShipyardSidebar } from "@/components/shipyard-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppHeader } from "@/components/AppHeader"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { useAuth } from "@/contexts/AuthContext"
import { useEffect, useState } from "react"
import { 
  Wrench, 
  CheckCircle, 
  FileText, 
  RefreshCw,
  Clock,
  TrendingUp
} from "lucide-react"

export default function ShipyardPage() {
  const { user } = useAuth()
  const [dashboardData, setDashboardData] = useState({
    drydockBid: 0,
    confirmedBooking: 0,
    drydockOperation: 0,
    totalDocuments: 0,
    bookedVessels: [] as Array<{ name: string; imo: string; progress: number; imageUrl: string | null }>,
    activities: [] as Array<{ type: string; message: string; time: string; icon: string }>
  })
  const [isLoading, setIsLoading] = useState(true)

  // Function to fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setIsLoading(true)
      if (!user?.id) {
        console.error('User ID not available')
        return
      }

      const response = await fetch(`/api/shipyard/dashboard-stats?shipyardUserId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        setDashboardData(data)
      } else {
        console.error('Failed to fetch dashboard data')
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch dashboard statistics on mount
  useEffect(() => {
    if (user?.id) {
      fetchDashboardData()
    }
  }, [user?.id])

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <ProtectedRoute allowedRoles={['SHIPYARD']}>
      <SidebarProvider>
      <ShipyardSidebar />
        <SidebarInset className="bg-white">
        <AppHeader 
          breadcrumbs={[
            { label: "Dashboard", href: "/pages/shipyard" },
            { label: "Shipyard", isCurrentPage: true }
          ]} 
        />
          
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#134686]"></div>
                <p className="text-sm text-gray-600">Loading dashboard data...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Welcome Section */}
              <div className="flex items-center justify-between p-5 pb-5 pt-0">
            <div className="flex items-center gap-4">
              <div className="pt-5">
                <div className="text-md font-semibold">Welcome back, {user?.fullName || user?.shipyardName || 'Shipyard'}!</div>
                <div className="text-sm text-muted-foreground">Here is your shipyard dashboard overview.</div>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 px-5">
            {/* Drydock Bid - with icon background #134686 */}
            <Card className="flex flex-row items-center gap-4 h-20 w-full p-4 border border-gray-200 bg-white shadow-sm rounded-lg hover:shadow-md transition-shadow duration-200">
              <div className="w-12 h-12 flex items-center justify-center bg-red-500 rounded-lg shadow-lg">
                <Wrench className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col justify-center h-full">
                <span className="text-xs text-gray-600 font-medium">Drydock Bid</span>
                <span className="text-lg font-bold text-gray-900">{dashboardData.drydockBid}</span>
                <span className="text-xs text-gray-500">Active bids</span>
              </div>
            </Card>

            {/* Confirmed Booking */}
            <Card className="flex flex-row items-center gap-4 h-20 w-full p-4 border border-gray-200 bg-white shadow-sm rounded-lg hover:shadow-md transition-shadow duration-200">
              <div className="w-12 h-12 flex items-center justify-center bg-green-500 rounded-lg shadow-lg">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col justify-center h-full">
                <span className="text-xs text-gray-600 font-medium">Confirmed Booking</span>
                <span className="text-lg font-bold text-gray-900">{dashboardData.confirmedBooking}</span>
                <span className="text-xs text-gray-500">Ready to start</span>
              </div>
            </Card>

            {/* Drydock Operation */}
            <Card className="flex flex-row items-center gap-4 h-20 w-full p-4 border border-gray-200 bg-white shadow-sm rounded-lg hover:shadow-md transition-shadow duration-200">
              <div className="w-12 h-12 flex items-center justify-center bg-[#FF6C0C] rounded-lg shadow-lg">
                <Wrench className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col justify-center h-full">
                <span className="text-xs text-gray-600 font-medium">Drydock Operation</span>
                <span className="text-lg font-bold text-gray-900">{dashboardData.drydockOperation}</span>
                <span className="text-xs text-gray-500">In progress</span>
              </div>
            </Card>

            {/* Total Documents */}
            <Card className="flex flex-row items-center gap-4 h-20 w-full p-4 border border-gray-200 bg-white shadow-sm rounded-lg hover:shadow-md transition-shadow duration-200">
              <div className="w-12 h-12 flex items-center justify-center bg-[#134686] rounded-lg shadow-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col justify-center h-full">
                <span className="text-xs text-gray-600 font-medium">Total Documents</span>
                <span className="text-lg font-bold text-gray-900">{dashboardData.totalDocuments}</span>
                <span className="text-xs text-gray-500">Available files</span>
              </div>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-5 pb-6">
            {/* Booked Vessels Completion - Left Side */}
            <Card className="h-80 flex flex-col shadow-sm border border-gray-200 bg-white rounded-xl overflow-hidden">
              <div className="px-4 pt-0 pb-0">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-base font-semibold">Booked Vessels Completion</div>
                    <div className="text-sm text-muted-foreground">Progress Overview</div>
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
                ) : dashboardData.bookedVessels.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-sm text-gray-500">No booked vessels available</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dashboardData.bookedVessels.map((vessel, index) => (
                      <div key={index} className="p-3 bg-white rounded-lg border border-gray-200">
                        <div className="flex items-center gap-3 mb-2">
                          <Avatar className="w-10 h-10 bg-blue-100">
                            <AvatarImage src={vessel.imageUrl || undefined} />
                            <AvatarFallback className="bg-blue-500 text-white">
                              {getInitials(vessel.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="font-medium text-sm text-gray-900">{vessel.name}</div>
                            <div className="text-xs text-gray-500">IMO: {vessel.imo}</div>
                          </div>
                          <div className="text-sm font-semibold text-gray-900">{vessel.progress}%</div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-gray-800 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${vessel.progress}%` }}
                          ></div>
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
                      // Map icon strings to actual icon components
                      const iconMap: { [key: string]: React.ComponentType<{ className?: string }> } = {
                        'Wrench': Wrench,
                        'CheckCircle': CheckCircle,
                        'FileText': FileText,
                        'TrendingUp': TrendingUp,
                        'RefreshCw': RefreshCw
                      }
                      
                      const IconComponent = iconMap[activity.icon] || Wrench
                      
                      return (
                        <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200">
                          <div className="w-8 h-8 bg-[#134686] rounded-lg flex items-center justify-center flex-shrink-0">
                            <IconComponent className="w-4 h-4 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900">{activity.message}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
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
            </>
          )}
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRoute>
  )
}
