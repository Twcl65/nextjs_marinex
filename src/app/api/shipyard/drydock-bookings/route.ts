import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import crypto from 'crypto'
import { logUserActivity, ActivityType } from '@/lib/activity-logger'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const shipyardUserId = searchParams.get('shipyardUserId')
    const status = searchParams.get('status')

    if (!shipyardUserId) {
      return NextResponse.json({ error: 'Shipyard User ID is required' }, { status: 400 })
    }

    const statusFilter = status ? Prisma.sql`AND db.status = ${status}` : Prisma.empty

    // Fetch bookings for the shipyard using raw SQL with enhanced information
    const bookings = await prisma.$queryRaw`
      SELECT 
        db.id,
        db.drydockRequestId,
        db.drydockBidId,
        db.userId,
        db.shipyardUserId,
        db.status,
        db.bookingDate,
        db.notes,
        db.createdAt,
        db.updatedAt,
        dr.vesselName,
        dr.imoNumber,
        dr.flag,
        dr.shipType,
        dr.vesselImageUrl,
        dr.priorityLevel,
        dr.status as requestStatus,
        dr.companyName,
        dr.companyLogoUrl,
        dr.vesselId,
        sv.lengthOverall,
        sv.grossTonnage,
        db_bid.shipyardName,
        db_bid.totalBid,
        db_bid.totalDays,
        db_bid.status as bidStatus,
        db_bid.servicesOffered,
        db_bid.serviceCalculations,
        db_bid.bidCertificateUrl,
        db_bid.submittedAt as bidDate,
        u.fullName as shipownerName,
        u.email as shipownerEmail,
        u.contactNumber as shipownerContact,
        u.officeAddress as shipownerAddress,
        u.logoUrl as shipownerLogoUrl
      FROM drydock_bookings db
      LEFT JOIN drydock_requests dr ON db.drydockRequestId = dr.id
      LEFT JOIN ship_vessels sv ON dr.vesselId = sv.id
      LEFT JOIN drydock_bids db_bid ON db.drydockBidId = db_bid.id
      LEFT JOIN users u ON db.userId = u.id
      WHERE db.shipyardUserId = ${shipyardUserId}
      ${statusFilter}
      ORDER BY db.createdAt DESC
    `

    console.log('Raw bookings data:', bookings)

    return NextResponse.json({
      success: true,
      bookings: Array.isArray(bookings) ? bookings.map((booking: {
        id: string;
        drydockRequestId: string;
        drydockBidId: string;
        userId: string;
        shipyardUserId: string;
        status: string;
        bookingDate: Date;
        notes: string | null;
        createdAt: Date;
        updatedAt: Date;
        vesselName: string;
        imoNumber: string;
        flag: string;
        shipType: string;
        vesselImageUrl: string | null;
        priorityLevel: string;
        requestStatus: string;
        companyName: string;
        companyLogoUrl: string | null;
        vesselId: string;
        lengthOverall: number | null;
        grossTonnage: number | null;
        shipyardName: string;
        totalBid: number;
        totalDays: number;
        bidStatus: string;
        servicesOffered: Record<string, unknown>;
        serviceCalculations: Record<string, unknown>;
        bidCertificateUrl: string | null;
        bidDate: Date;
        shipownerName: string;
        shipownerEmail: string;
        shipownerContact: string;
        shipownerAddress: string;
        shipownerLogoUrl: string | null;
      }) => ({
        id: booking.id,
        drydockRequestId: booking.drydockRequestId,
        drydockBidId: booking.drydockBidId,
        userId: booking.userId,
        shipyardUserId: booking.shipyardUserId,
        status: booking.status,
        bookingDate: booking.bookingDate,
        notes: booking.notes,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt,
        vesselName: booking.vesselName,
        imoNumber: booking.imoNumber,
        flag: booking.flag,
        shipType: booking.shipType,
        vesselImageUrl: booking.vesselImageUrl,
        priorityLevel: booking.priorityLevel,
        requestStatus: booking.requestStatus,
        companyName: booking.companyName,
        companyLogoUrl: booking.companyLogoUrl,
        vesselId: booking.vesselId,
        lengthOverall: booking.lengthOverall,
        grossTonnage: booking.grossTonnage,
        shipyardName: booking.shipyardName,
        totalBid: booking.totalBid,
        totalDays: booking.totalDays,
        bidStatus: booking.bidStatus,
        servicesOffered: booking.servicesOffered,
        serviceCalculations: booking.serviceCalculations,
        bidCertificateUrl: booking.bidCertificateUrl,
        bidDate: booking.bidDate,
        shipownerName: booking.shipownerName,
        shipownerEmail: booking.shipownerEmail,
        shipownerContact: booking.shipownerContact,
        shipownerAddress: booking.shipownerAddress,
        shipownerLogoUrl: booking.shipownerLogoUrl
      })) : []
    })

  } catch (error) {
    console.error('Error fetching shipyard drydock bookings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch drydock bookings' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { bookingId, status, notes } = body

    if (!bookingId || !status) {
      return NextResponse.json(
        { error: 'Booking ID and status are required' },
        { status: 400 }
      )
    }

    // Start a transaction to update both booking and drydock request
    const result = await prisma.$transaction(async (tx) => {
      // Update booking status
      const updatedBooking = await tx.$executeRaw`
        UPDATE drydock_bookings 
        SET status = ${status}, notes = ${notes || null}, updatedAt = NOW()
        WHERE id = ${bookingId}
      `

      // If confirming the booking, also update the drydock request status to "Ongoing"
      if (status === 'CONFIRMED') {
        await tx.$executeRaw`
          UPDATE drydock_requests dr
          INNER JOIN drydock_bookings db ON dr.id = db.drydockRequestId
          SET dr.status = 'IN_PROGRESS', dr.updatedAt = NOW()
          WHERE db.id = ${bookingId}
        `

        // Fetch booking details for notification
        const bookingDetails = await tx.$queryRaw<Array<{
          userId: string;
          vesselId: string;
          vesselName: string;
          imoNumber: string;
          companyName: string;
          shipyardName: string;
          shipyardUserId: string;
        }>>`
          SELECT 
            db.userId,
            dr.vesselId,
            dr.vesselName,
            dr.imoNumber,
            dr.companyName,
            db_bid.shipyardName,
            db.shipyardUserId
          FROM drydock_bookings db
          LEFT JOIN drydock_requests dr ON db.drydockRequestId = dr.id
          LEFT JOIN drydock_bids db_bid ON db.drydockBidId = db_bid.id
          WHERE db.id = ${bookingId}
        `

        if (bookingDetails && bookingDetails.length > 0) {
          const booking = bookingDetails[0]
          
          // Create notification message for shipowner
          const shipownerMessage = `Dear **${booking.companyName || 'Valued Customer'}**,

We are pleased to inform you that your booking for **${booking.vesselName}** has been confirmed by **${booking.shipyardName}**.

Your drydock booking is now confirmed and the shipyard will proceed with the scheduled services. You can track the progress of your drydock operations through your dashboard.

If you have any questions or need assistance, please feel free to contact us.

Thank you for using our services.

Best regards,
**Maritime Industry Authority**`

          const notificationId = crypto.randomUUID()

          // Create notification for shipowner
          await tx.$executeRaw`
            INSERT INTO drydock_mc_notifications (
              id, userId, vesselId, drydockReport, drydockCertificate, 
              safetyCertificate, vesselPlans, title, type, message, 
              isRead, createdAt, updatedAt
            ) VALUES (
              ${notificationId}, ${booking.userId}, ${booking.vesselId}, 
              0, 0, 0, 0,
              'Booking Confirmed', 'Booking Confirmation',
              ${shipownerMessage}, 0, NOW(), NOW()
            )
          `

          console.log('Shipowner notification created successfully:', notificationId)
        }

        // Log activity for shipyard user
        if (bookingDetails && bookingDetails.length > 0) {
          const booking = bookingDetails[0]
          await logUserActivity(
            booking.shipyardUserId,
            ActivityType.BOOKING_CONFIRMED,
            `Booking confirmed for ${booking.vesselName}`,
            'CheckCircle',
            {
              bookingId: bookingId,
              vesselId: booking.vesselId,
              vesselName: booking.vesselName,
              shipyardName: booking.shipyardName
            }
          )
        }
      }

      return updatedBooking
    })

    return NextResponse.json({
      success: true,
      booking: result
    })

  } catch (error) {
    console.error('Error updating booking status:', error)
    return NextResponse.json(
      { error: 'Failed to update booking status' },
      { status: 500 }
    )
  }
}
