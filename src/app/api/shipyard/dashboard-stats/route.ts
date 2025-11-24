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
      recentBids,
      recentBookings
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

      // Recent Bids
      prisma.drydockBid.findMany({
        where: {
          shipyardUserId: shipyardUserId,
          status: {
            in: ['SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'RECOMMENDED']
          }
        },
        select: {
          id: true,
          submittedAt: true,
          status: true,
          drydockRequest: {
            select: {
              id: true,
              vesselName: true
            }
          }
        },
        orderBy: {
          submittedAt: 'desc'
        },
        take: 5
      }),

      // Recent Bookings
      prisma.drydockBooking.findMany({
        where: {
          shipyardUserId: shipyardUserId
        },
        select: {
          createdAt: true,
          status: true,
          drydockRequest: {
            select: {
              vesselName: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 5
      })
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

    // Combine and format recent activities
    const activities: Array<{ type: string; message: string; time: string; icon: string; date?: Date }> = []

    // Add bid activities
    recentBids.forEach((bid, index) => {
      const requestId = bid.drydockRequest?.id ? `request #${bid.drydockRequest.id.slice(-1)}` : `request #${index + 2}`
      activities.push({
        type: 'bid',
        message: `New drydock bid submitted for ${requestId}`,
        time: getTimeAgo(bid.submittedAt),
        icon: 'Wrench',
        date: bid.submittedAt
      })
    })

    // Add booking activities
    recentBookings.forEach((booking) => {
      const vesselName = booking.drydockRequest?.vesselName || 'Unknown'
      if (booking.status === 'CONFIRMED') {
        activities.push({
          type: 'booking',
          message: `Booking confirmed for ${vesselName} drydock operation`,
          time: getTimeAgo(booking.createdAt),
          icon: 'CheckCircle',
          date: booking.createdAt
        })
      }
    })

    // Sort activities by date (most recent first) and take the most recent 4
    activities.sort((a, b) => {
      if (a.date && b.date) {
        return new Date(b.date).getTime() - new Date(a.date).getTime()
      }
      return 0
    })
    
    // Remove date before returning
    const finalActivities = activities.slice(0, 4).map(({ date, ...rest }) => rest)

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
  const diffInMs = now.getTime() - new Date(date).getTime()
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
  const diffInDays = Math.floor(diffInHours / 24)

  if (diffInHours < 1) {
    return 'Less than 1 hour ago'
  } else if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`
  } else if (diffInDays < 7) {
    return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`
  } else {
    return `${Math.floor(diffInDays / 7)} ${Math.floor(diffInDays / 7) === 1 ? 'week' : 'weeks'} ago`
  }
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

