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

      // Recent Activities - get recent activities from users_activity table for all marina users
      (async () => {
        // Get all marina user IDs
        const marinaUsers = await prisma.user.findMany({
          where: { role: 'MARINA' },
          select: { id: true }
        })
        const marinaUserIds = marinaUsers.map(u => u.id)
        
        if (marinaUserIds.length === 0) {
          return []
        }
        
        // Build the query with proper parameterization for MySQL
        const userIdsPlaceholder = marinaUserIds.map(() => '?').join(',')
        const query = `
          SELECT 
            id,
            userId,
            activityType,
            message,
            icon,
            createdAt
          FROM users_activity
          WHERE userId IN (${userIdsPlaceholder})
          ORDER BY createdAt DESC
          LIMIT 10
        `
        
        return prisma.$queryRawUnsafe<Array<{
          id: string
          userId: string
          activityType: string
          message: string
          icon: string
          createdAt: Date
        }>>(query, ...marinaUserIds)
      })()
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
        icon: activity.icon || 'Users'
      }
    })

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


