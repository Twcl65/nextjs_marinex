import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { logUserActivity, ActivityType } from '@/lib/activity-logger'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { nanoid } from 'nanoid'

const region = process.env.AWS_REGION as string
const bucket = process.env.AWS_S3_BUCKET as string

const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const serviceId = formData.get('serviceId') as string | null
    const bookingId = formData.get('bookingId') as string | null
    const serviceName = formData.get('serviceName') as string | null
    const originalStartDateRaw = formData.get('originalStartDate') as string | null
    const originalEndDateRaw = formData.get('originalEndDate') as string | null
    const newStartDateRaw = formData.get('newStartDate') as string | null
    const reason = (formData.get('reason') as string | null) || ''
    const description = (formData.get('description') as string | null) || ''
    const image = formData.get('image') as File | null

    if (!serviceId || !newStartDateRaw || !reason.trim()) {
      return NextResponse.json(
        { error: 'Missing required fields: serviceId, newStartDate, reason' },
        { status: 400 }
      )
    }

    const newStartDate = new Date(newStartDateRaw)
    if (isNaN(newStartDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid newStartDate value' },
        { status: 400 }
      )
    }

    let imageUrl: string | null = null

    if (image && image.size > 0) {
      if (!region || !bucket) {
        return NextResponse.json({ error: 'S3 not configured' }, { status: 500 })
      }

      const fileName = image.name
      const parts = fileName.split('.')
      const fileExtension = parts.length > 1 ? '.' + parts[parts.length - 1] : ''
      const key = `service-reschedules/${Date.now()}-${nanoid(8)}${fileExtension}`

      const arrayBuffer = await image.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      try {
        const cmd = new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: image.type || 'application/octet-stream',
          ACL: 'public-read',
        })
        await s3.send(cmd)
      } catch {
        const cmd = new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: image.type || 'application/octet-stream',
        })
        await s3.send(cmd)
      }

      imageUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`
    }

    // Resolve the service we are rescheduling (or create it once if it doesn't exist yet)
    let service =
      serviceId && !serviceId.startsWith('offered-')
        ? await prisma.drydockService.findUnique({
            where: { id: serviceId },
          })
        : null

    // If not found by ID (or this is an offered-* placeholder),
    // try to resolve or create the service using booking + service name.
    if (!service) {
      if (!bookingId || !serviceName) {
        return NextResponse.json(
          { error: 'Service not found and booking/serviceName not provided' },
          { status: 400 }
        )
      }

      // Try to find an existing service for this booking + name
      service = await prisma.drydockService.findFirst({
        where: {
          drydockBookingId: bookingId,
          serviceName,
        },
      })

      if (!service) {
        const booking = await prisma.drydockBooking.findUnique({
          where: { id: bookingId },
        })

        if (!booking) {
          return NextResponse.json(
            { error: 'Related booking not found' },
            { status: 404 }
          )
        }

        // Derive previous start/end from original values (from UI) or booking date as fallback
        const prevStart =
          originalStartDateRaw && !isNaN(new Date(originalStartDateRaw).getTime())
            ? new Date(originalStartDateRaw)
            : booking.bookingDate

        const prevEnd =
          originalEndDateRaw && !isNaN(new Date(originalEndDateRaw).getTime())
            ? new Date(originalEndDateRaw)
            : prevStart

        service = await prisma.drydockService.create({
          data: {
            drydockBidId: booking.drydockBidId,
            drydockBookingId: bookingId,
            serviceName,
            startDate: prevStart,
            endDate: prevEnd,
            progress: 0,
          },
        })
      }
    }

    const previousStartDate = service.startDate

    const durationMs =
      service.endDate && service.startDate
        ? service.endDate.getTime() - service.startDate.getTime()
        : 0

    const newEndDate = durationMs
      ? new Date(newStartDate.getTime() + durationMs)
      : service.endDate

    const updatedService = await prisma.drydockService.update({
      where: { id: service.id },
      data: {
        startDate: newStartDate,
        endDate: newEndDate ?? undefined,
      },
    })

    await (prisma as any).drydockServiceReschedule.create({
      data: {
        drydockServiceId: updatedService.id,
        previousStartDate,
        newStartDate,
        reason,
        description: description || null,
        imageUrl,
      },
    })

    // Notify shipowner about service reschedule due to natural disaster
    try {
      const serviceWithBooking = await prisma.$queryRaw<Array<{
        serviceName: string
        userId: string
        vesselId: string
        vesselName: string
        companyName: string
        shipyardName: string
        shipyardUserId: string
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
        WHERE ds.id = ${updatedService.id}
      `

      if (serviceWithBooking && serviceWithBooking.length > 0) {
        const info = serviceWithBooking[0]
        const disasterType = reason || 'Natural Disaster'

        const originalStartLabel = previousStartDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: '2-digit',
        })
        const newStartLabel = newStartDate.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: '2-digit',
        })

        const shipownerMessage = `Dear **${info.companyName || 'Valued Customer'}**,

We would like to inform you that the schedule for the **${info.serviceName}** service on your vessel **${info.vesselName}** has been adjusted due to a **${disasterType}**.

- Previous start date: **${originalStartLabel}**
- New start date: **${newStartLabel}**

${description && description.trim() ? `**Details provided by the shipyard:**\n${description}\n\n` : ''}The shipyard **${info.shipyardName}** will proceed with the updated schedule. You can view the latest drydock timeline in your dashboard.

Thank you for your understanding.

Best regards,
**Maritime Industry Authority**`

        const notificationId = crypto.randomUUID()

        await prisma.$executeRaw`
          INSERT INTO drydock_mc_notifications (
            id, userId, vesselId, drydockReport, drydockCertificate, 
            safetyCertificate, vesselPlans, title, type, message, 
            isRead, createdAt, updatedAt
          ) VALUES (
            ${notificationId}, ${info.userId}, ${info.vesselId}, 
            0, 0, 0, 0,
            'Service Schedule Updated (Natural Disaster)', 'Service Rescheduled',
            ${shipownerMessage}, 0, NOW(), NOW()
          )
        `

        await logUserActivity(
          info.shipyardUserId,
          ActivityType.PROGRESS_UPDATED,
          `Service "${info.serviceName}" rescheduled due to ${disasterType}`,
          'CalendarClock',
          {
            vesselId: info.vesselId,
            vesselName: info.vesselName,
            serviceName: info.serviceName,
            previousStartDate: previousStartDate.toISOString(),
            newStartDate: newStartDate.toISOString(),
            disasterType,
          }
        )
      }
    } catch (notifyError) {
      console.error('Failed to send reschedule notification:', notifyError)
    }

    return NextResponse.json({
      success: true,
      service: updatedService,
    })
  } catch (error) {
    console.error('Error rescheduling drydock service:', error)
    return NextResponse.json(
      {
        error: 'Failed to reschedule service',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

