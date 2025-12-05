import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { jwtVerify } from "jose"
import crypto from "crypto"
import { logUserActivity, ActivityType } from "@/lib/activity-logger"

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key')

async function getAuthenticatedUser(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as { userId: string; email: string; role: string }
  } catch (error) {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const authenticatedUser = await getAuthenticatedUser(request)
    if (!authenticatedUser) {
      return NextResponse.json(
        { error: "Unauthorized. Please login." },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      vesselName,
      imoNumber,
      shipType,
      flag,
      yearOfBuild,
      lengthOverall,
      grossTonnage,
      vesselCertificationExpiry,
      vesselImageUrl,
      vesselCertificationUrl,
      vesselPlansUrl,
      drydockCertificateUrl,
      safetyCertificateUrl,
      userId
    } = body

    // Validate required fields
    if (!vesselName || !imoNumber || !shipType || !flag || !yearOfBuild || !lengthOverall || !grossTonnage) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Ensure the userId matches the authenticated user
    if (userId !== authenticatedUser.userId) {
      return NextResponse.json(
        { error: "Forbidden. You can only create vessels for your own account." },
        { status: 403 }
      )
    }

    // Check if IMO number already exists
    const existingVessel = await prisma.shipVessel.findUnique({
      where: { imoNumber }
    })

    if (existingVessel) {
      return NextResponse.json(
        { error: "A vessel with this IMO number already exists" },
        { status: 400 }
      )
    }

    // Create the vessel
    const vessel = await prisma.shipVessel.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        vesselName,
        imoNumber,
        shipType,
        flag,
        yearOfBuild: parseInt(yearOfBuild),
        lengthOverall: parseFloat(lengthOverall),
        grossTonnage: parseFloat(grossTonnage),
        vesselCertificationExpiry: vesselCertificationExpiry ? new Date(vesselCertificationExpiry) : null,
        vesselImageUrl: vesselImageUrl || null,
        vesselCertificationUrl: vesselCertificationUrl || null,
        vesselPlansUrl: vesselPlansUrl || null,
        drydockCertificateUrl: drydockCertificateUrl || null,
        safetyCertificateUrl: safetyCertificateUrl || null,
        status: 'ACTIVE'
      }
    })

    // Log activity
    await logUserActivity(
      userId,
      ActivityType.VESSEL_ADDED,
      `Added vessel ${vesselName}`,
      'Truck',
      {
        vesselId: vessel.id,
        vesselName: vesselName
      }
    )

    return NextResponse.json({
      success: true,
      vessel: {
        id: vessel.id,
        vesselName: vessel.vesselName,
        imoNumber: vessel.imoNumber,
        shipType: vessel.shipType,
        flag: vessel.flag,
        yearOfBuild: vessel.yearOfBuild,
        lengthOverall: vessel.lengthOverall,
        grossTonnage: vessel.grossTonnage,
        vesselCertificationExpiry: vessel.vesselCertificationExpiry ? vessel.vesselCertificationExpiry.toISOString() : null,
        vesselImageUrl: vessel.vesselImageUrl,
        vesselCertificationUrl: vessel.vesselCertificationUrl,
        vesselPlansUrl: vessel.vesselPlansUrl,
        drydockCertificateUrl: vessel.drydockCertificateUrl,
        safetyCertificateUrl: vessel.safetyCertificateUrl,
        status: vessel.status,
        createdAt: vessel.createdAt.toISOString(),
        updatedAt: vessel.updatedAt.toISOString()
      }
    })
  } catch (error: unknown) {
    console.error("Error creating vessel:", error)
    
    // Handle unique constraint violation
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: "A vessel with this IMO number already exists" },
        { status: 400 }
      )
    }

    const errorMessage = error instanceof Error ? error.message : "Failed to create vessel"
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || "all"
    const userId = searchParams.get("userId") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "100") // Increased limit to get all vessels
    const skip = (page - 1) * limit

    // Build where clause for filtering
    const where: {
      userId?: string
      status?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'
      OR?: Array<{
        vesselName?: { contains: string; mode: 'insensitive' }
        imoNumber?: { contains: string; mode: 'insensitive' }
        user?: { fullName: { contains: string; mode: 'insensitive' } }
      }>
    } = {}
    
    // Filter by userId if provided
    if (userId) {
      where.userId = userId
    }
    
    if (search) {
      where.OR = [
        { vesselName: { contains: search, mode: "insensitive" } },
        { imoNumber: { contains: search, mode: "insensitive" } },
        { user: { fullName: { contains: search, mode: "insensitive" } } }
      ]
    }
    
    if (status !== "all") {
      where.status = status as 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'
    }

    // Get vessels with user information
    const vessels = await prisma.shipVessel.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            logoUrl: true
          }
        },
        drydockRequests: {
          where: {
            status: 'COMPLETED'
          },
          orderBy: {
            updatedAt: 'desc'
          },
          take: 1
        }
      },
      orderBy: {
        vesselCertificationExpiry: "asc"
      },
      skip,
      take: limit
    })

    // Get total count for pagination
    const totalCount = await prisma.shipVessel.count({ where })

    // Check which vessels have notifications
    const vesselIds = vessels.map(v => v.id)
    let notifiedVesselIds = new Set<string>()
    
    if (vesselIds.length > 0) {
      // Query notifications table to find which vessels have been notified
      // Using raw query with proper escaping
      const placeholders = vesselIds.map(() => '?').join(',')
      const notifications = await prisma.$queryRawUnsafe<Array<{ vesselId: string }>>(
        `SELECT DISTINCT vesselId FROM drydock_mc_notifications WHERE vesselId IN (${placeholders})`,
        ...vesselIds
      )
      
      notifiedVesselIds = new Set(
        notifications.map((n) => n.vesselId)
      )
    }

    // Map vessels to include notification status and serialize dates
    const vesselsWithNotificationStatus = vessels.map(vessel => ({
      id: vessel.id,
      vesselName: vessel.vesselName,
      imoNumber: vessel.imoNumber,
      shipType: vessel.shipType,
      flag: vessel.flag,
      yearOfBuild: vessel.yearOfBuild,
      lengthOverall: vessel.lengthOverall,
      grossTonnage: vessel.grossTonnage,
      vesselCertificationExpiry: vessel.vesselCertificationExpiry ? vessel.vesselCertificationExpiry.toISOString() : null,
      vesselImageUrl: vessel.vesselImageUrl,
      vesselCertificationUrl: vessel.vesselCertificationUrl,
      vesselPlansUrl: vessel.vesselPlansUrl,
      drydockCertificateUrl: vessel.drydockCertificateUrl,
      safetyCertificateUrl: vessel.safetyCertificateUrl,
      status: vessel.status,
      createdAt: vessel.createdAt.toISOString(),
      updatedAt: vessel.updatedAt.toISOString(),
      isNotified: notifiedVesselIds.has(vessel.id),
      user: vessel.user
    }))

    return NextResponse.json({
      vessels: vesselsWithNotificationStatus,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    })
  } catch (error) {
    console.error("Error fetching vessels:", error)
    return NextResponse.json(
      { error: "Failed to fetch vessels" },
      { status: 500 }
    )
  }
}