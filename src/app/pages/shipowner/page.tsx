"use client"

import { ShipownerSidebar } from "@/components/shipowner-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppHeader } from "@/components/AppHeader"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { useAuth } from "@/contexts/AuthContext"
import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Truck,
  Wrench,
  RefreshCw,
  Calendar,
  RefreshCcw,
  Clock,
  FileText
} from "lucide-react"

export default function ShipownerPage() {
  const { user } = useAuth()
  const [dashboardData, setDashboardData] = useState({
    totalVessels: 0,
    ongoingDrydock: 0,
    vesselRecertifications: 0,
    expiringSoon: 0,
    vesselExpirations: [] as Array<{ id: string; name: string; imo: string; expiration: string; imageUrl: string | null }>,
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

      const response = await fetch(`/api/shipowner/dashboard-stats?userId=${user.id}`)
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
    <ProtectedRoute allowedRoles={['SHIPOWNER']}>
      <SidebarProvider>
        <ShipownerSidebar />
        <SidebarInset className="bg-white">
          <AppHeader 
            breadcrumbs={[
              { label: "Dashboard", href: "/pages/shipowner" },
              { label: "Shipowner", isCurrentPage: true }
            ]} 
          />
          
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-sm text-gray-500">Loading dashboard data...</div>
            </div>
          ) : (
            <>
              {/* Welcome Section */}
              <div className="flex items-center justify-between p-5 pb-5 pt-0">
                <div className="flex items-center gap-4">
                 
                  <div className="pt-5">
                    <div className="text-md font-semibold">Welcome back, {user?.fullName || 'Shipowner'}!</div>
                    <div className="text-sm text-gray-500">Here is your dashboard overview.</div>
                  </div>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 px-5">
                {/* Total Vessels */}
                <Card className="flex flex-row items-center gap-4 h-20 w-full p-4 border border-gray-200 bg-white shadow-sm rounded-lg hover:shadow-md transition-shadow duration-200">
                  <div className="w-12 h-12 flex items-center justify-center bg-red-500 rounded-lg shadow-lg">
                    <Truck className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex flex-col justify-center h-full">
                    <span className="text-xs text-gray-600 font-medium">Total Vessels</span>
                    <span className="text-lg font-bold text-gray-900">{dashboardData.totalVessels}</span>
                    <span className="text-xs text-gray-500">Active vessels</span>
                  </div>
                </Card>

                {/* Ongoing Drydock */}
                <Card className="flex flex-row items-center gap-4 h-20 w-full p-4 border border-gray-200 bg-white shadow-sm rounded-lg hover:shadow-md transition-shadow duration-200">
                  <div className="w-12 h-12 flex items-center justify-center bg-green-500 rounded-lg shadow-lg">
                    <Wrench className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex flex-col justify-center h-full">
                    <span className="text-xs text-gray-600 font-medium">Ongoing Drydock</span>
                    <span className="text-lg font-bold text-gray-900">{dashboardData.ongoingDrydock}</span>
                    <span className="text-xs text-gray-500">In progress</span>
                  </div>
                </Card>

                {/* Vessel Recertification */}
                <Card className="flex flex-row items-center gap-4 h-20 w-full p-4 border border-gray-200 bg-white shadow-sm rounded-lg hover:shadow-md transition-shadow duration-200">
                  <div className="w-12 h-12 flex items-center justify-center bg-[#FF6C0C] rounded-lg shadow-lg">
                    <RefreshCw className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex flex-col justify-center h-full">
                    <span className="text-xs text-gray-600 font-medium">Vessel Recertification</span>
                    <span className="text-lg font-bold text-gray-900">{dashboardData.vesselRecertifications}</span>
                    <span className="text-xs text-gray-500">In progress</span>
                  </div>
                </Card>

                {/* Expiring Soon */}
                <Card className="flex flex-row items-center gap-4 h-20 w-full p-4 border border-gray-200 bg-white shadow-sm rounded-lg hover:shadow-md transition-shadow duration-200">
                  <div className="w-12 h-12 flex items-center justify-center bg-[#134686] rounded-lg shadow-lg">
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex flex-col justify-center h-full">
                    <span className="text-xs text-gray-600 font-medium">Expiring Soon</span>
                    <span className="text-lg font-bold text-gray-900">{dashboardData.expiringSoon}</span>
                    <span className="text-xs text-gray-500">Within a year</span>
                  </div>
                </Card>
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-5 pb-6">
                {/* Vessel Certificate Expirations - Left Side */}
                <Card className="h-80 flex flex-col shadow-sm border border-gray-200 bg-white rounded-xl overflow-hidden">
                  <div className="px-4 pt-0 pb-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-base font-semibold">Vessel Certificate Expirations</div>
                        <div className="text-sm text-gray-500">Upcoming Expirations</div>
                      </div>
                      <button
                        onClick={fetchDashboardData}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
                        title="Refresh data"
                      >
                        <RefreshCcw className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </div>
                  <CardContent className="flex-1 p-4 pt-0  overflow-y-auto">
                    {dashboardData.vesselExpirations.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-sm text-gray-500">No expiring certificates</div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {dashboardData.vesselExpirations.map((vessel) => (
                          <div key={vessel.id} className="p-3 bg-white rounded-lg border border-gray-200">
                            <div className="flex items-center gap-3">
                              <Avatar className="w-10 h-10 bg-blue-100">
                                <AvatarImage src={vessel.imageUrl || undefined} />
                                <AvatarFallback className="bg-blue-500 text-white">
                                  {getInitials(vessel.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-gray-900">{vessel.name}</div>
                                <div className="text-xs text-gray-500">IMO: {vessel.imo}</div>
                                <div className="text-xs text-gray-600 mt-1">
                                  Expiration: <span className="font-semibold">{vessel.expiration}</span>
                                </div>
                              </div>
                              <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded whitespace-nowrap">
                                Expiring Soon
                              </span>
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
                        <div className="text-sm text-gray-500">Latest updates and requests</div>
                      </div>
                      <button
                        onClick={fetchDashboardData}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
                        title="Refresh data"
                      >
                        <RefreshCcw className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </div>
                  <CardContent className="flex-1 p-4 pt-0 overflow-y-auto">
                    {dashboardData.activities.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="text-sm text-gray-500 mb-2">
                          No recent activities found. 
                          <br />Your activity will appear here as you use the system.
                        </div>
                        <div className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Just now
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {dashboardData.activities.map((activity, index) => {
                          const IconComponent = 
                            activity.icon === 'Wrench' ? Wrench :
                            activity.icon === 'RefreshCw' ? RefreshCw :
                            activity.icon === 'FileText' ? FileText : Wrench
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
