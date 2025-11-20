'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Bell } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Notification {
  id: string
  title: string
  type: string
  message: string
  vesselName: string
  imoNumber: string
  isRead: boolean
  createdAt: string
  updatedAt: string
}

export function NotificationDropdown() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showAllDialog, setShowAllDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'read' | 'unread'>('all')
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  const [showNotificationDialog, setShowNotificationDialog] = useState(false)

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return

    try {
      setIsLoading(true)
      const token = localStorage.getItem('authToken')
      if (!token) {
        console.error('No auth token found')
        return
      }

      const response = await fetch(`/api/mc-notifications?userId=${user.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unreadCount || 0)
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Failed to fetch notifications:', errorData.error || 'Unknown error')
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user?.id])

  // Fetch notifications when dropdown opens or user changes
  useEffect(() => {
    if (user?.id) {
      fetchNotifications()
    }
  }, [user?.id, fetchNotifications])

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen && user?.id) {
      fetchNotifications()
    }
  }, [isOpen, user?.id, fetchNotifications])

  // Fetch notifications when all notifications dialog opens
  useEffect(() => {
    if (showAllDialog && user?.id) {
      fetchNotifications()
    }
  }, [showAllDialog, user?.id, fetchNotifications])

  // Reset search and filter when dialog closes
  useEffect(() => {
    if (!showAllDialog) {
      setSearchQuery('')
      setFilterType('all')
    }
  }, [showAllDialog])

  // Poll for new notifications every 30 seconds when dropdown is closed
  useEffect(() => {
    if (!user?.id) return

    const interval = setInterval(() => {
      if (!isOpen) {
        fetchNotifications()
      }
    }, 30000) // Poll every 30 seconds

    return () => clearInterval(interval)
  }, [user?.id, isOpen, fetchNotifications])

  // Get notifications grouped by day (today first, then other days)
  const getNotificationsByDay = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const todayNotifications: Notification[] = []
    const otherDaysNotifications: Notification[] = []
    
    notifications.forEach(notification => {
      const notificationDate = new Date(notification.createdAt)
      notificationDate.setHours(0, 0, 0, 0)
      
      if (notificationDate.getTime() === today.getTime()) {
        todayNotifications.push(notification)
      } else {
        otherDaysNotifications.push(notification)
      }
    })
    
    // Sort by most recent first
    todayNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    otherDaysNotifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    
    return {
      today: todayNotifications,
      otherDays: otherDaysNotifications
    }
  }

  const { today: todayNotifications, otherDays: otherDaysNotifications } = getNotificationsByDay()
  const allNotifications = [...todayNotifications, ...otherDaysNotifications]

  // Function to mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const token = localStorage.getItem('authToken')
      if (!token) {
        console.error('No auth token found')
        return
      }

      // Optimistically update UI
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      )
      setUnreadCount((prev) => (prev > 0 ? prev - 1 : 0))

      const response = await fetch('/api/mc-notifications', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notificationId }),
      })

      if (response.ok) {
        // Refresh in background to keep in sync
        fetchNotifications()
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Failed to mark notification as read:', errorData.error || 'Unknown error')
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }, [fetchNotifications])

  // Format relative time (e.g., "2 months ago")
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
    }

    if (diffInSeconds < intervals.minute) {
      return 'Just now'
    } else if (diffInSeconds < intervals.hour) {
      const minutes = Math.floor(diffInSeconds / intervals.minute)
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
    } else if (diffInSeconds < intervals.day) {
      const hours = Math.floor(diffInSeconds / intervals.hour)
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
    } else if (diffInSeconds < intervals.week) {
      const days = Math.floor(diffInSeconds / intervals.day)
      return `${days} ${days === 1 ? 'day' : 'days'} ago`
    } else if (diffInSeconds < intervals.month) {
      const weeks = Math.floor(diffInSeconds / intervals.week)
      return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`
    } else if (diffInSeconds < intervals.year) {
      const months = Math.floor(diffInSeconds / intervals.month)
      return `${months} ${months === 1 ? 'month' : 'months'} ago`
    } else {
      const years = Math.floor(diffInSeconds / intervals.year)
      return `${years} ${years === 1 ? 'year' : 'years'} ago`
    }
  }

  // Filter and search notifications for the dialog
  const filteredNotifications = useMemo(() => {
    let filtered = notifications

    // Apply filter
    if (filterType === 'read') {
      filtered = filtered.filter(n => n.isRead)
    } else if (filterType === 'unread') {
      filtered = filtered.filter(n => !n.isRead)
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        n =>
          n.title.toLowerCase().includes(query) ||
          n.message.toLowerCase().includes(query) ||
          n.vesselName.toLowerCase().includes(query) ||
          n.type.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [notifications, searchQuery, filterType])

  if (!user) return null

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-8 w-8 p-0 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
        >
          <Bell className="h-5 w-5 text-gray-700" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 flex items-center justify-center text-xs font-semibold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        className="w-80 bg-white border border-gray-200 shadow-lg rounded-lg p-0" 
        align="end"
      >
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
          <span className="text-xs text-gray-500">Recently updated</span>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="px-4 py-8 text-center">
              <div className="text-sm text-gray-500">Loading...</div>
            </div>
          ) : allNotifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <div className="text-sm text-gray-500">No notifications for today.</div>
            </div>
          ) : (
            <div className="py-2">
              {/* Today's Notifications */}
              {todayNotifications.length > 0 && (
                <>
                  {todayNotifications.slice(0, 5).map((notification) => (
                    <div
                      key={notification.id}
                      className={`px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                        !notification.isRead ? 'bg-blue-50' : ''
                      }`}
                      onClick={async () => {
                        // Mark as read immediately when clicked
                        if (!notification.isRead) {
                          await markAsRead(notification.id)
                        }
                        setSelectedNotification(notification)
                        setShowNotificationDialog(true)
                        setIsOpen(false)
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {!notification.isRead && (
                          <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium mb-1 ${
                            notification.isRead ? 'text-gray-500' : 'text-gray-900'
                          }`}>
                            {notification.title}
                          </div>
                          <div className={`text-xs line-clamp-2 ${
                            notification.isRead ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            {notification.message.replace(/\*\*/g, '').substring(0, 100)}
                            {notification.message.length > 100 ? '...' : ''}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(notification.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
              
              {/* Other Days Notifications */}
              {todayNotifications.length < 5 && otherDaysNotifications.length > 0 && (
                <>
                  {otherDaysNotifications.slice(0, 5 - todayNotifications.length).map((notification) => (
                    <div
                      key={notification.id}
                      className={`px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                        !notification.isRead ? 'bg-blue-50' : ''
                      }`}
                      onClick={async () => {
                        // Mark as read immediately when clicked
                        if (!notification.isRead) {
                          await markAsRead(notification.id)
                        }
                        setSelectedNotification(notification)
                        setShowNotificationDialog(true)
                        setIsOpen(false)
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {!notification.isRead && (
                          <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium mb-1 ${
                            notification.isRead ? 'text-gray-500' : 'text-gray-900'
                          }`}>
                            {notification.title}
                          </div>
                          <div className={`text-xs line-clamp-2 ${
                            notification.isRead ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            {notification.message.replace(/\*\*/g, '').substring(0, 100)}
                            {notification.message.length > 100 ? '...' : ''}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(notification.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200">
          <button
            onClick={() => {
              setIsOpen(false)
              setShowAllDialog(true)
            }}
            className="w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 text-center transition-colors"
          >
            View all notifications
          </button>
        </div>
      </DropdownMenuContent>

      {/* All Notifications Dialog */}
      <Dialog open={showAllDialog} onOpenChange={setShowAllDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">All Notifications</DialogTitle>
            <DialogDescription>
              Here is a list of all your notifications.
            </DialogDescription>
          </DialogHeader>

          {/* Search and Filter */}
          <div className="flex gap-3 mb-4">
            <Input
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Select value={filterType} onValueChange={(value: 'all' | 'read' | 'unread') => setFilterType(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
                <SelectItem value="read">Read</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="py-8 text-center">
                <div className="text-sm text-gray-500">Loading...</div>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="py-8 text-center">
                <div className="text-sm text-gray-500">
                  {searchQuery ? 'No notifications found matching your search.' : 'No notifications available.'}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                      !notification.isRead
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={async () => {
                      // Mark as read immediately when clicked
                      if (!notification.isRead) {
                        await markAsRead(notification.id)
                      }
                      setSelectedNotification(notification)
                      setShowNotificationDialog(true)
                    }}
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {!notification.isRead && (
                          <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                        )}
                        <h4 className="font-semibold text-gray-900 flex-1">{notification.title}</h4>
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
                        {formatRelativeTime(notification.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {notification.message.replace(/\*\*/g, '')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Notification Detail Dialog */}
      <Dialog 
        open={showNotificationDialog} 
        onOpenChange={(open) => {
          setShowNotificationDialog(open)
          if (!open) {
            setSelectedNotification(null)
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {selectedNotification?.title || 'Notification'}
            </DialogTitle>
            {selectedNotification && (
              <DialogDescription>
                Notification details
              </DialogDescription>
            )}
          </DialogHeader>

          {selectedNotification && (
            <div className="flex-1 overflow-y-auto flex flex-col">
              {/* Message Section - Displayed First */}
              <div className="mb-4">
                <div className="text-gray-700 leading-relaxed">
                  {(() => {
                    // Normalize the message: remove markdown formatting, normalize whitespace
                    const normalizedMessage = selectedNotification.message
                      .replace(/\*\*/g, '') // Remove markdown bold
                      .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with max 2
                      .trim() // Remove leading/trailing whitespace
                    
                    // Split by double newlines to preserve paragraph breaks
                    const paragraphs = normalizedMessage.split(/\n\n+/)
                    
                    return (
                      <div className="space-y-3">
                        {paragraphs.map((paragraph, index) => (
                          <p key={index} className="text-sm leading-6">
                            {paragraph.split('\n').map((line, lineIndex, lines) => (
                              <span key={lineIndex}>
                                {line}
                                {lineIndex < lines.length - 1 && <br />}
                              </span>
                            ))}
                          </p>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </div>

              {/* Details Section - Displayed Below in Row */}
              <div className="text-sm text-gray-500 mt-4 pt-4 border-t border-gray-200">
                <div className="flex flex-wrap gap-4">
                  <div>Vessel: <span className="font-medium text-gray-700">{selectedNotification.vesselName}</span></div>
                  <div>IMO: <span className="font-medium text-gray-700">{selectedNotification.imoNumber}</span></div>
                  <div>Type: <span className="font-medium text-gray-700">{selectedNotification.type}</span></div>
                  <div>Received: <span className="font-medium text-gray-700">{new Date(selectedNotification.createdAt).toLocaleString()}</span></div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DropdownMenu>
  )
}


