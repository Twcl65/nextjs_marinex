import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import { logUserActivity, ActivityType } from '@/lib/activity-logger'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { nanoid } from 'nanoid'

const prisma = new PrismaClient()

const region = process.env.AWS_REGION as string
const bucket = process.env.AWS_S3_BUCKET as string

const s3 = new S3Client({ 
  region, 
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  }
})

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

      if (!region || !bucket) {
        return NextResponse.json({ error: 'S3 not configured' }, { status: 500 })
      }
      
      // Extract file extension from file name
      const fileName = image.name
      const parts = fileName.split('.')
      const fileExtension = parts.length > 1 ? '.' + parts[parts.length - 1] : ''
      
      // Generate unique key
      const key = `progress/${Date.now()}-${nanoid(8)}${fileExtension}`

      // Convert file to buffer
      const arrayBuffer = await image.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Upload to S3
      let uploadSuccess = false
      let uploadError: Error | null = null
      
      try {
        const cmd = new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: image.type || 'application/octet-stream',
          ACL: 'public-read', // Try to make it public
        })
        await s3.send(cmd)
        uploadSuccess = true
        console.log('[Upload] File uploaded with public-read ACL')
      } catch (aclError: unknown) {
        console.warn('[Upload] ACL upload failed, trying without ACL:', aclError)
        uploadError = aclError instanceof Error ? aclError : new Error('ACL upload failed')
        
        // Retry without ACL (bucket policy might handle public access)
        try {
          const cmd = new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ContentType: image.type || 'application/octet-stream',
            // No ACL - rely on bucket policy
          })
          await s3.send(cmd)
          uploadSuccess = true
          console.log('[Upload] File uploaded without ACL (using bucket policy)')
        } catch (noAclError: unknown) {
          throw noAclError instanceof Error ? noAclError : new Error('Upload failed')
        }
      }
      
      if (!uploadSuccess) {
        throw uploadError || new Error('Upload failed')
      }
      
      imageUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`
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
