import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import { logUserActivity, ActivityType } from '@/lib/activity-logger'
import { uploadFileToS3 } from '@/lib/s3-upload'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    
    const serviceId = formData.get('serviceId') as string
    const progress = parseInt(formData.get('progress') as string)
    const comment = (formData.get('comment') as string) || ''
    const image = formData.get('image') as File | null

    if (!serviceId || isNaN(progress)) {
      return NextResponse.json(
        { error: 'Missing or invalid required fields: serviceId, progress' },
        { status: 400 }
      )
    }

    let imageUrl: string | null = null

    // Handle image upload if provided
    if (image && image.size > 0) {
      console.log(`[Upload] Image found for service ${serviceId}, uploading to S3...`)
      imageUrl = await uploadFileToS3({
        file: image,
        folder: 'progress',
        prefix: `progress-${serviceId}`,
      })
      if (!imageUrl) {
        console.error(`[Upload] S3 upload failed for service ${serviceId}`)
        return NextResponse.json(
          { error: 'Image upload failed' },
          { status: 500 }
        )
      }
      console.log(`[Upload] Image uploaded successfully: ${imageUrl}`)
    }

    // Determine progress level based on percentage
    let progressLevel: string
    if (progress <= 15) progressLevel = 'Level 1'
    else if (progress <= 25) progressLevel = 'Level 2'
    else if (progress <= 50) progressLevel = 'Level 3'
    else if (progress <= 75) progressLevel = 'Level 4'
    else progressLevel = 'Level 5'

    // Use a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Create progress record
      const progressRecord = await tx.drydockProgress.create({
        data: {
          drydockServiceId: serviceId,
          progressLevel,
          progressPercent: progress,
          comment: comment || null,
          imageUrl,
          updatedBy: 'shipyard-user' // You might want to get this from auth context
        }
      })

      // Update the service progress
      await tx.drydockService.update({
        where: { id: serviceId },
        data: { progress }
      })
      
      return progressRecord
    })

    // Fetch booking and request information to send notification to shipowner
    const serviceWithBooking = await prisma.$queryRaw<Array<{
      serviceName: string;
      userId: string;
      vesselId: string;
      vesselName: string;
      companyName: string;
      shipyardName: string;
      shipyardUserId: string;
    }>>`
      SELECT 
        ds.serviceName,
        db.userId,
        dr.vesselId,
        dr.vesselName,
        dr.companyName,
        db_bid.shipyardName,
        db.shipyardUserId
      FROM drydock_services ds
      LEFT JOIN drydock_bookings db ON ds.drydockBookingId = db.id
      LEFT JOIN drydock_requests dr ON db.drydockRequestId = dr.id
      LEFT JOIN drydock_bids db_bid ON db.drydockBidId = db_bid.id
      WHERE ds.id = ${serviceId}
    `

    if (serviceWithBooking && serviceWithBooking.length > 0) {
      const serviceInfo = serviceWithBooking[0]
      
      // Create notification message for shipowner
      const shipownerMessage = `Dear **${serviceInfo.companyName || 'Valued Customer'}**,

We would like to inform you that progress has been updated for the **${serviceInfo.serviceName}** service on your vessel **${serviceInfo.vesselName}**.

The shipyard **${serviceInfo.shipyardName}** has updated the progress to **${progress}%** (${progressLevel}).

${comment && comment.trim() ? `**Update Details:**\n${comment}\n\n` : ''}You can view the detailed progress updates through your dashboard.

If you have any questions or need assistance, please feel free to contact us.

Thank you for using our services.

Best regards,
**Maritime Industry Authority**`

      const notificationId = crypto.randomUUID()

      // Create notification for shipowner
      await prisma.$executeRaw`
        INSERT INTO drydock_mc_notifications (
          id, userId, vesselId, drydockReport, drydockCertificate, 
          safetyCertificate, vesselPlans, title, type, message, 
          isRead, createdAt, updatedAt
        ) VALUES (
          ${notificationId}, ${serviceInfo.userId}, ${serviceInfo.vesselId}, 
          0, 0, 0, 0,
          'Service Progress Updated', 'Progress Update',
          ${shipownerMessage}, 0, NOW(), NOW()
        )
      `

      console.log('Shipowner notification created successfully:', notificationId)
      
      // Log activity for shipyard user
      await logUserActivity(
        serviceInfo.shipyardUserId,
        ActivityType.PROGRESS_UPDATED,
        `Progress updated for ${serviceInfo.serviceName} on ${serviceInfo.vesselName} (${progress}%)`,
        'TrendingUp',
        {
          vesselId: serviceInfo.vesselId,
          vesselName: serviceInfo.vesselName,
          serviceName: serviceInfo.serviceName,
          progressPercent: progress,
          drydockRequestId: serviceId
        }
      )
    }

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Progress updated successfully'
    })

  } catch (error) {
    console.error('Error updating drydock progress:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update progress',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const serviceId = searchParams.get('serviceId')

    if (!serviceId) {
      return NextResponse.json(
        { error: 'serviceId is required' },
        { status: 400 }
      )
    }

    const progressRecords = await prisma.drydockProgress.findMany({
      where: {
        drydockServiceId: serviceId
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      data: progressRecords
    })

  } catch (error) {
    console.error('Error fetching drydock progress:', error)
    return NextResponse.json(
      { error: 'Failed to fetch progress records' },
      { status: 500 }
    )
  }
}
