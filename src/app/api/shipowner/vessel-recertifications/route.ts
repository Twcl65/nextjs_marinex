import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import { uploadFileToS3 } from '@/lib/s3-upload'
import { logUserActivity, ActivityType } from '@/lib/activity-logger'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const status = searchParams.get('status') || 'all'
    const search = searchParams.get('search') || ''

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    // Build the where clause
    const whereClause: {
      userId: string
      status?: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
      OR?: Array<{
        vesselName?: { contains: string; mode: 'insensitive' }
        vesselImoNumber?: { contains: string; mode: 'insensitive' }
      }>
    } = {
      userId: userId
    }

    // Add status filter
    if (status !== 'all') {
      whereClause.status = status as 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'COMPLETED'
    }

    // Add search functionality
    if (search) {
      whereClause.OR = [
        {
          vesselName: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          vesselImoNumber: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ]
    }

    const recertifications = await prisma.drydockVesselRecertificate.findMany({
      where: whereClause,
      include: {
        vessel: {
          select: {
            vesselName: true,
            imoNumber: true,
            vesselImageUrl: true
          }
        }
      },
      orderBy: {
        requestedDate: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      data: recertifications
    })

  } catch (error) {
    console.error('Error fetching vessel recertifications:', error)
    return NextResponse.json(
      { error: 'Failed to fetch vessel recertifications' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    
    const userId = formData.get('userId') as string
    const vesselId = formData.get('vesselId') as string
    const companyName = formData.get('companyName') as string
    const vesselName = formData.get('vesselName') as string
    const vesselImoNumber = formData.get('vesselImoNumber') as string
    
    // File uploads
    const vesselPlans = formData.get('vesselPlans') as File | null
    const drydockReport = formData.get('drydockReport') as File | null
    const drydockCertificate = formData.get('drydockCertificate') as File | null
    const safetyCertificate = formData.get('safetyCertificate') as File | null

    if (!userId || !vesselId || !companyName || !vesselName || !vesselImoNumber) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Handle file uploads to S3 using shared utility (proxy upload to avoid CORS)
    const uploadFile = async (file: File | null, prefix: string) => {
      if (!file || file.size === 0) return null
      
      return await uploadFileToS3({
        file,
        folder: `vessel-recertifications/${userId}`,
        prefix: prefix
      })
    }

    const [vesselPlansUrl, drydockReportUrl, drydockCertificateUrl, safetyCertificateUrl] = await Promise.all([
      uploadFile(vesselPlans, 'vessel-plans'),
      uploadFile(drydockReport, 'drydock-report'),
      uploadFile(drydockCertificate, 'drydock-certificate'),
      uploadFile(safetyCertificate, 'safety-certificate')
    ])

    // Create recertification request
    const recertification = await prisma.drydockVesselRecertificate.create({
      data: {
        userId,
        vesselId,
        companyName,
        vesselName,
        vesselImoNumber,
        vesselPlansUrl,
        drydockReportUrl,
        drydockCertificateUrl,
        safetyCertificateUrl,
        status: 'PENDING'
      }
    })

    // Log activity
    await logUserActivity(
      userId,
      ActivityType.RECERTIFICATION_REQUESTED,
      `Recertification requested for ${vesselName}`,
      'RefreshCw',
      {
        vesselId: vesselId,
        vesselName: vesselName
      }
    )

    // Send notification to all marina users
    try {
      // Fetch all marina users
      const marinaUsers = await prisma.user.findMany({
        where: {
          role: 'MARINA'
        },
        select: {
          id: true,
          fullName: true,
          email: true
        }
      })

      // Create notification message for marina
      const notificationMessage = `Dear **Maritime Industry Authority**,

A new vessel recertification request has been submitted by **${companyName}** for the vessel **${vesselName}** (IMO: ${vesselImoNumber}).

The request is now pending review and requires your attention. Please review the submitted documents and process the recertification request accordingly.

**Request Details:**
- Company: ${companyName}
- Vessel Name: ${vesselName}
- IMO Number: ${vesselImoNumber}
- Request Date: ${new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}

You can access the request through your dashboard to review and process it.

Thank you for your attention.

Best regards,
**Marinex Platform**`

      // Create notifications for all marina users
      for (const marinaUser of marinaUsers) {
        const notificationId = crypto.randomUUID()
        
        await prisma.$executeRaw`
          INSERT INTO drydock_mc_notifications (
            id, userId, vesselId, drydockReport, drydockCertificate, 
            safetyCertificate, vesselPlans, title, type, message, 
            isRead, createdAt, updatedAt
          ) VALUES (
            ${notificationId}, ${marinaUser.id}, ${vesselId}, 
            0, 0, 0, 0,
            'Vessel Recertification Request', 'Vessel Recertification',
            ${notificationMessage}, 0, NOW(), NOW()
          )
        `
      }

      console.log(`Created notifications for ${marinaUsers.length} marina user(s) for recertification request ${recertification.id}`)
    } catch (notificationError) {
      // Log error but don't fail the request
      console.error('Error creating marina notifications:', notificationError)
    }

    return NextResponse.json({
      success: true,
      data: recertification,
      message: 'Vessel recertification request submitted successfully'
    })

  } catch (error) {
    console.error('Error creating vessel recertification:', error)
    
    // Provide more specific error messages
    let errorMessage = 'Failed to create vessel recertification request'
    if (error instanceof Error) {
      errorMessage = error.message || errorMessage
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage 
      },
      { status: 500 }
    )
  }
}
