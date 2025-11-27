import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const shipyardUserId = searchParams.get('shipyardUserId')

    if (!shipyardUserId) {
      return NextResponse.json({ error: 'Shipyard User ID is required' }, { status: 400 })
    }

    // Get all statistics in parallel for better performance
    const [
      drydockBidCount,
      confirmedBookingCount,
      drydockOperationCount,
      totalDocumentsCount,
      bookedVessels,
      recentActivities
    ] = await Promise.all([
      // Drydock Bid - count of active bids submitted by this shipyard
      prisma.drydockBid.count({
        where: {
          shipyardUserId: shipyardUserId,
          status: {
            in: ['SUBMITTED', 'UNDER_REVIEW']
          }
        }
      }),

      // Confirmed Booking - count of confirmed bookings for this shipyard
      prisma.drydockBooking.count({
        where: {
          shipyardUserId: shipyardUserId,
          status: 'CONFIRMED'
        }
      }),

      // Drydock Operation - count of in-progress bookings
      prisma.drydockBooking.count({
        where: {
          shipyardUserId: shipyardUserId,
          status: 'IN_PROGRESS'
        }
      }),

      // Total Documents - count of bookings with documents (simplified)
      prisma.drydockBooking.count({
        where: {
          shipyardUserId: shipyardUserId,
          status: {
            in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED']
          }
        }
      }),

      // Booked Vessels - get confirmed and in-progress bookings with vessel info
      prisma.drydockBooking.findMany({
        where: {
          shipyardUserId: shipyardUserId,
          status: {
            in: ['CONFIRMED', 'IN_PROGRESS']
          }
        },
        include: {
          drydockRequest: {
            select: {
              vesselName: true,
              imoNumber: true,
              vesselImageUrl: true
            }
          },
          services: {
            select: {
              progress: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10
      }),

      // Recent Activities - get recent activities from users_activity table
      prisma.$queryRaw<Array<{
        id: string
        userId: string
        activityType: string
        message: string
        icon: string
        createdAt: Date
      }>>`
        SELECT 
          id,
          userId,
          activityType,
          message,
          icon,
          createdAt
        FROM users_activity
        WHERE userId = ${shipyardUserId}
        ORDER BY createdAt DESC
        LIMIT 10
      `
    ])

    // Calculate progress for booked vessels
    const vesselsWithProgress = bookedVessels.map(booking => {
      const services = booking.services || []
      const totalProgress = services.length > 0
        ? Math.round(services.reduce((sum, s) => sum + (s.progress || 0), 0) / services.length)
        : 0

      return {
        name: booking.drydockRequest.vesselName,
        imo: booking.drydockRequest.imoNumber,
        progress: totalProgress,
        imageUrl: booking.drydockRequest.vesselImageUrl
      }
    })

    // Transform recent activities from users_activity table
    const activitiesRaw = Array.isArray(recentActivities) ? recentActivities : []
    
    const finalActivities = activitiesRaw.slice(0, 5).map((activity: {
      id: string
      userId: string
      activityType: string
      message: string
      icon: string
      createdAt: Date
    }) => {
      const createdAt = activity.createdAt instanceof Date 
        ? activity.createdAt 
        : new Date(activity.createdAt)
      
      return {
        type: activity.activityType,
        message: activity.message,
        time: getTimeAgo(createdAt),
        icon: activity.icon || 'Wrench'
      }
    })

    return NextResponse.json({
      drydockBid: drydockBidCount,
      confirmedBooking: confirmedBookingCount,
      drydockOperation: drydockOperationCount,
      totalDocuments: totalDocumentsCount,
      bookedVessels: vesselsWithProgress,
      activities: finalActivities
    })
  } catch (error) {
    console.error('Error fetching shipyard dashboard statistics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    )
  }
}

// Helper function to calculate time ago
function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000)
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds} seconds ago`
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`
  }
  
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`
  }
  
  const diffInWeeks = Math.floor(diffInDays / 7)
  return `${diffInWeeks} ${diffInWeeks === 1 ? 'week' : 'weeks'} ago`
}

// Helper function to extract hours from time string for sorting
function extractHours(timeStr: string): number {
  if (timeStr.includes('hour')) {
    const match = timeStr.match(/(\d+)\s*hour/)
    return match ? parseInt(match[1]) : 0
  } else if (timeStr.includes('day')) {
    const match = timeStr.match(/(\d+)\s*day/)
    return match ? parseInt(match[1]) * 24 : 0
  } else if (timeStr.includes('week')) {
    const match = timeStr.match(/(\d+)\s*week/)
    return match ? parseInt(match[1]) * 24 * 7 : 0
  }
  return 0
}

