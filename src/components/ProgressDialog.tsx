"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, CheckCircle } from "lucide-react"

interface Service {
  id: string
  serviceName: string
  startDate: string
  endDate: string
  progress: number
  progressUpdates: Array<{
    progressLevel: string
    progressPercent: number
    comment?: string
    imageUrl?: string
    updatedAt: string
  }>
}

interface ProgressDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vesselName: string
  shipyardName: string
  startDate: string
  endDate: string
  services: Service[]
}

export function ProgressDialog({
  open,
  onOpenChange,
  vesselName,
  shipyardName,
  startDate,
  endDate,
  services
}: ProgressDialogProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getStatusColor = (progress: number) => {
    if (progress === 100) return "bg-green-500"
    if (progress >= 75) return "bg-blue-500"
    if (progress >= 50) return "bg-yellow-500"
    if (progress >= 25) return "bg-orange-500"
    return "bg-gray-500"
  }

  const getStatusText = (progress: number) => {
    if (progress === 100) return "COMPLETED"
    if (progress >= 75) return "NEAR COMPLETION"
    if (progress >= 50) return "IN PROGRESS"
    if (progress >= 25) return "STARTED"
    return "PENDING"
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-900">
            Service Progress Updates
          </DialogTitle>
          <p className="text-sm text-gray-600 mt-2">
            Track the status, schedule, and completion of each drydock service
          </p>
        </DialogHeader>

        {/* Vessel and Shipyard Information */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-500">Vessel Name</label>
            <div className="p-2 bg-gray-50 rounded border text-sm font-medium">
              {vesselName}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-500">Shipyard Name</label>
            <div className="p-2 bg-gray-50 rounded border text-sm font-medium">
              {shipyardName}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-500">Start Date</label>
            <div className="p-2 bg-gray-50 rounded border text-sm font-medium">
              {formatDate(startDate)}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-500">End Date</label>
            <div className="p-2 bg-gray-50 rounded border text-sm font-medium">
              {formatDate(endDate)}
            </div>
          </div>
        </div>

        {/* Service Progress Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <Card key={service.id} className="border-2 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg font-bold text-gray-700">
                      {index + 1}.
                    </span>
                    <Badge 
                      className={`${getStatusColor(service.progress)} text-white font-semibold`}
                    >
                      {service.progress}%
                    </Badge>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={`font-semibold ${
                      service.progress === 100 
                        ? 'border-green-500 text-green-700' 
                        : 'border-blue-500 text-blue-700'
                    }`}
                  >
                    {getStatusText(service.progress)}
                  </Badge>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  {service.serviceName}
                </h3>

                <div className="flex items-center space-x-2 mb-4">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-600">
                    {formatDate(service.startDate)} - {formatDate(service.endDate)}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">Progress</span>
                    <span className="text-gray-600">{service.progress}%</span>
                  </div>
                  <Progress 
                    value={service.progress} 
                    className="h-2"
                  />
                </div>

                {/* Recent Progress Updates */}
                {service.progressUpdates.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">
                      Recent Updates
                    </h4>
                    <div className="space-y-2">
                      {service.progressUpdates.slice(0, 2).map((update, updateIndex) => (
                        <div key={updateIndex} className="text-xs text-gray-600">
                          <div className="flex items-center space-x-2">
                            <Clock className="h-3 w-3" />
                            <span>
                              {new Date(update.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                          {update.comment && (
                            <p className="mt-1 text-gray-500 italic">
                              &quot;{update.comment}&quot;
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-center mt-6">
          <Button 
            onClick={() => onOpenChange(false)}
            className="bg-black text-white hover:bg-gray-800 px-8"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
