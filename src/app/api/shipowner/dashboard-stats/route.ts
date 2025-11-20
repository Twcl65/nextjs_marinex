import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get all statistics in parallel for better performance
    const [
      totalVessels,
      ongoingDrydock,
      vesselRecertifications,
      expiringSoon,
      vesselExpirations,
      recentActivities
    ] = await Promise.all([
      // Total Vessels - count of all vessels for this user
      prisma.shipVessel.count({
        where: {
          userId: userId,
          status: 'ACTIVE'
        }
      }),

      // Ongoing Drydock - count of bookings in progress
      prisma.drydockBooking.count({
        where: {
          userId: userId,
          status: {
            in: ['CONFIRMED', 'IN_PROGRESS']
          }
        }
      }),

      // Vessel Recertifications - count of in-progress recertifications
      prisma.drydockVesselRecertificate.count({
        where: {
          userId: userId,
          status: {
            in: ['PENDING', 'IN_REVIEW']
          }
        }
      }),

      // Expiring Soon - count of vessels with certifications expiring within 90 days
      (async () => {
        const now = new Date()
        const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
        
        return prisma.shipVessel.count({
          where: {
            userId: userId,
            status: 'ACTIVE',
            vesselCertificationExpiry: {
              not: null,
              gte: now,
              lte: ninetyDaysFromNow
            }
          }
        })
      })(),

      // Vessel Certificate Expirations - get vessels with upcoming expirations
      (async () => {
        const now = new Date()
        const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
        
        return prisma.shipVessel.findMany({
          where: {
            userId: userId,
            status: 'ACTIVE',
            vesselCertificationExpiry: {
              not: null,
              gte: now,
              lte: ninetyDaysFromNow
            }
          },
          select: {
            id: true,
            vesselName: true,
            imoNumber: true,
            vesselCertificationExpiry: true,
            vesselImageUrl: true
          },
          orderBy: {
            vesselCertificationExpiry: 'asc'
          },
          take: 10
        })
      })(),

      // Recent Activities - get recent bookings, recertifications, and requests
      Promise.all([
        prisma.drydockBooking.findMany({
          where: {
            userId: userId
          },
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            createdAt: true,
            status: true,
            drydockRequest: {
              select: {
                vesselName: true
              }
            }
          }
        }),
        prisma.drydockVesselRecertificate.findMany({
          where: {
            userId: userId
          },
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            createdAt: true,
            status: true,
            vesselName: true
          }
        }),
        prisma.drydockRequest.findMany({
          where: {
            userId: userId
          },
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            createdAt: true,
            status: true,
            vesselName: true
          }
        })
      ])
    ])

    // Transform vessel expirations
    const transformedExpirations = vesselExpirations.map((vessel) => {
      const expiryDate = vessel.vesselCertificationExpiry!
      const formattedDate = expiryDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })

      return {
        id: vessel.id,
        name: vessel.vesselName,
        imo: vessel.imoNumber,
        expiration: formattedDate,
        imageUrl: vessel.vesselImageUrl
      }
    })

    // Transform recent activities
    const activities: Array<{
      type: string
      message: string
      time: string
      icon: string
      date: Date
    }> = []

    const [bookingActivities, recertActivities, requestActivities] = recentActivities

    // Add booking activities
    bookingActivities.forEach((activity) => {
      activities.push({
        type: 'booking',
        message: `Booking ${activity.status.toLowerCase()} for ${activity.drydockRequest.vesselName}`,
        time: getTimeAgo(activity.createdAt),
        icon: 'Wrench',
        date: activity.createdAt
      })
    })

    // Add recertification activities
    recertActivities.forEach((activity) => {
      activities.push({
        type: 'recertification',
        message: `Recertification ${activity.status.toLowerCase()} for ${activity.vesselName}`,
        time: getTimeAgo(activity.createdAt),
        icon: 'RefreshCw',
        date: activity.createdAt
      })
    })

    // Add request activities
    requestActivities.forEach((activity) => {
      activities.push({
        type: 'request',
        message: `Drydock request ${activity.status.toLowerCase()} for ${activity.vesselName}`,
        time: getTimeAgo(activity.createdAt),
        icon: 'FileText',
        date: activity.createdAt
      })
    })

    // Sort activities by date (most recent first) and take the most recent 5
    activities.sort((a, b) => b.date.getTime() - a.date.getTime())
    
    // Remove date before returning
    const finalActivities = activities.slice(0, 5).map(({ date, ...rest }) => rest)

    return NextResponse.json({
      totalVessels,
      ongoingDrydock,
      vesselRecertifications,
      expiringSoon,
      vesselExpirations: transformedExpirations,
      activities: finalActivities
    })
  } catch (error) {
    console.error('Error fetching dashboard statistics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    )
  }
}

// Helper function to calculate time ago
function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) {
    return 'Just now'
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
  if (diffInWeeks < 4) {
    return `${diffInWeeks} ${diffInWeeks === 1 ? 'week' : 'weeks'} ago`
  }
  
  const diffInMonths = Math.floor(diffInDays / 30)
  return `${diffInMonths} ${diffInMonths === 1 ? 'month' : 'months'} ago`
}

