import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Get all statistics in parallel for better performance
    const [
      authorityApprovalsCount,
      shipyardBiddingCount,
      monitorCertificationsCount,
      vesselRecertificationsCount,
      manageUsersCount,
      manageDocumentsCount,
      certificationStatus,
      recentActivities
    ] = await Promise.all([
      // Authority Approvals - count of pending requests
      prisma.drydockAuthorityRequest.count({
        where: {
          status: {
            in: ['REQUESTED', 'PENDING']
          }
        }
      }),

      // Shipyard Bidding - count of active bids
      prisma.drydockBid.count({
        where: {
          status: {
            in: ['SUBMITTED', 'UNDER_REVIEW']
          }
        }
      }),

      // Monitor Certifications - count of vessels with active certifications
      prisma.shipVessel.count({
        where: {
          status: 'ACTIVE',
          vesselCertificationExpiry: {
            not: null
          }
        }
      }),

      // Vessel Recertifications - count of in-progress recertifications
      prisma.drydockVesselRecertificate.count({
        where: {
          status: {
            in: ['PENDING', 'IN_REVIEW']
          }
        }
      }),

      // Manage Users - total count of SHIPOWNER and SHIPYARD users
      prisma.user.count({
        where: {
          role: {
            in: ['SHIPOWNER', 'SHIPYARD']
          }
        }
      }),

      // Manage Documents - count of vessels with uploaded documents
      prisma.shipVessel.count({
        where: {
          OR: [
            { vesselCertificationUrl: { not: null } },
            { vesselPlansUrl: { not: null } },
            { drydockCertificateUrl: { not: null } },
            { safetyCertificateUrl: { not: null } }
          ]
        }
      }),

      // Certification Status - get vessels with certifications and their expiry dates
      prisma.shipVessel.findMany({
        where: {
          vesselCertificationExpiry: {
            not: null
          },
          status: 'ACTIVE'
        },
        select: {
          vesselName: true,
          vesselCertificationExpiry: true,
          imoNumber: true
        },
        orderBy: {
          vesselCertificationExpiry: 'asc'
        },
        take: 10 // Limit to 10 most urgent
      }),

      // Recent Activities - get recent authority requests, bids, recertifications, and user registrations
      Promise.all([
        prisma.drydockAuthorityRequest.findMany({
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
        prisma.drydockBid.findMany({
          take: 5,
          orderBy: { submittedAt: 'desc' },
          select: {
            submittedAt: true,
            status: true,
            shipyardName: true
          }
        }),
        prisma.drydockVesselRecertificate.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            createdAt: true,
            status: true,
            vesselName: true
          }
        }),
        prisma.user.findMany({
          where: {
            role: {
              in: ['SHIPOWNER', 'SHIPYARD']
            }
          },
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            createdAt: true,
            status: true,
            fullName: true,
            shipyardName: true,
            role: true
          }
        })
      ])
    ])

    // Transform certification status data
    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    
    const transformedCertificationStatus = certificationStatus.map((vessel) => {
      const expiryDate = vessel.vesselCertificationExpiry!
      const isExpired = expiryDate < now
      const isExpiringSoon = expiryDate >= now && expiryDate <= thirtyDaysFromNow
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      let status: string
      let progress: number
      
      if (isExpired) {
        status = 'Notify for Drydocking'
        progress = 0
      } else if (isExpiringSoon) {
        status = 'Expiring Soon'
        progress = Math.max(25, Math.min(75, (daysUntilExpiry / 30) * 100))
      } else {
        status = 'Valid'
        progress = 100
      }

      return {
        name: vessel.vesselName,
        status,
        expiryDate: expiryDate.toISOString().split('T')[0],
        progress
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

    // Add authority request activities
    const [authorityActivities, bidActivities, recertActivities, userActivities] = recentActivities
    authorityActivities.forEach((activity) => {
      activities.push({
        type: 'approval',
        message: `New authority approval request for ${activity.drydockRequest.vesselName}`,
        time: getTimeAgo(activity.createdAt),
        icon: 'Stamp',
        date: activity.createdAt
      })
    })

    // Add bid activities
    bidActivities.forEach((activity) => {
      activities.push({
        type: 'bidding',
        message: `${activity.shipyardName} submitted a bid`,
        time: getTimeAgo(activity.submittedAt),
        icon: 'Gavel',
        date: activity.submittedAt
      })
    })

    // Add recertification activities
    recertActivities.forEach((activity) => {
      activities.push({
        type: 'certification',
        message: `Vessel recertification request for ${activity.vesselName}`,
        time: getTimeAgo(activity.createdAt),
        icon: 'BadgeCheck',
        date: activity.createdAt
      })
    })

    // Add user registration activities
    userActivities.forEach((activity) => {
      if (activity.status === 'ACTIVE') {
        const userName = activity.fullName || activity.shipyardName || 'User'
        activities.push({
          type: 'user',
          message: `New ${activity.role.toLowerCase()} registration: ${userName}`,
          time: getTimeAgo(activity.createdAt),
          icon: 'Users',
          date: activity.createdAt
        })
      }
    })

    // Sort activities by date (most recent first) and take the most recent 4
    activities.sort((a, b) => b.date.getTime() - a.date.getTime())
    
    // Remove date before returning
    const finalActivities = activities.slice(0, 4).map(({ date: _date, ...rest }) => rest)

    return NextResponse.json({
      authorityApprovals: authorityApprovalsCount,
      shipyardBidding: shipyardBiddingCount,
      monitorCertifications: monitorCertificationsCount,
      vesselRecertifications: vesselRecertificationsCount,
      manageUsers: manageUsersCount,
      manageDocuments: manageDocumentsCount,
      certificationStatus: transformedCertificationStatus.slice(0, 4),
      activities: finalActivities
    })
  } catch (error: unknown) {
    console.error('Error fetching dashboard statistics:', error)
    
    // Provide more specific error messages
    let errorMessage = 'Failed to fetch dashboard statistics'
    
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P1001') {
      errorMessage = 'Database connection error. Please try again later.'
    } else if (error instanceof Error && error.message?.includes('Can\'t reach database server')) {
      errorMessage = 'Database server is unreachable. Please check your connection.'
    } else if (error instanceof Error) {
      errorMessage = error.message || errorMessage
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

// Helper function to calculate time ago
function getTimeAgo(date: Date): string {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
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


