import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { drydockRequestId, drydockBidId, userId, shipyardUserId, notes } = body

    // Validate required fields
    if (!drydockRequestId || !drydockBidId || !userId || !shipyardUserId) {
      return NextResponse.json(
        { error: 'Missing required fields: drydockRequestId, drydockBidId, userId, shipyardUserId' },
        { status: 400 }
      )
    }

    // Check if booking already exists for this bid (only if not cancelled)
    const existingBooking = await prisma.$queryRaw`
      SELECT id, status FROM drydock_bookings 
      WHERE drydockBidId = ${drydockBidId} AND userId = ${userId}
      LIMIT 1
    `

    if (Array.isArray(existingBooking) && existingBooking.length > 0) {
      const booking = existingBooking[0] as { id: string; status: string }
      // Only prevent booking if it's not cancelled
      if (booking.status !== 'CANCELLED') {
        return NextResponse.json(
          { error: 'Booking already exists for this bid' },
          { status: 409 }
        )
      }
    }

    let bookingId: string
    
    if (Array.isArray(existingBooking) && existingBooking.length > 0) {
      // Update existing cancelled booking
      const existing = existingBooking[0] as { id: string; status: string }
      bookingId = existing.id
      
      await prisma.$executeRaw`
        UPDATE drydock_bookings 
        SET status = 'PENDING', bookingDate = NOW(), notes = ${notes || null}, updatedAt = NOW()
        WHERE id = ${bookingId}
      `
    } else {
      // Create new booking
      bookingId = `booking_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      await prisma.$executeRaw`
        INSERT INTO drydock_bookings (
          id, drydockRequestId, drydockBidId, userId, shipyardUserId, 
          status, bookingDate, notes, createdAt, updatedAt
        ) VALUES (
          ${bookingId}, ${drydockRequestId}, ${drydockBidId}, ${userId}, ${shipyardUserId},
          'PENDING', NOW(), ${notes || null}, NOW(), NOW()
        )
      `
    }

    // Fetch the created booking with related data
    const booking = await prisma.$queryRaw`
      SELECT 
        db.id,
        db.status,
        db.bookingDate,
        dr.vesselName,
        dr.imoNumber,
        db_bid.shipyardName,
        db_bid.totalBid,
        u.fullName as userFullName,
        u.email as userEmail,
        su.fullName as shipyardFullName,
        su.email as shipyardEmail
      FROM drydock_bookings db
      LEFT JOIN drydock_requests dr ON db.drydockRequestId = dr.id
      LEFT JOIN drydock_bids db_bid ON db.drydockBidId = db_bid.id
      LEFT JOIN users u ON db.userId = u.id
      LEFT JOIN users su ON db.shipyardUserId = su.id
      WHERE db.id = ${bookingId}
    `

    console.log('Drydock booking created:', booking)

    const bookingData = Array.isArray(booking) && booking.length > 0 ? booking[0] : null
    
    if (!bookingData) {
      return NextResponse.json(
        { error: 'Failed to retrieve created booking' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      booking: {
        id: bookingData.id,
        status: bookingData.status,
        bookingDate: bookingData.bookingDate,
        vesselName: bookingData.vesselName,
        imoNumber: bookingData.imoNumber,
        shipyardName: bookingData.shipyardName,
        totalBid: bookingData.totalBid,
        shipownerName: bookingData.userFullName,
        shipownerEmail: bookingData.userEmail,
        shipyardContactName: bookingData.shipyardFullName,
        shipyardContactEmail: bookingData.shipyardEmail
      }
    })

  } catch (error) {
    console.error('Error creating drydock booking:', error)
    return NextResponse.json(
      { error: 'Failed to create drydock booking' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')
    const drydockRequestId = searchParams.get('drydockRequestId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Fetch bookings for the user using raw SQL with enhanced bid information
    const bookings = drydockRequestId 
      ? await prisma.$queryRaw`
          SELECT 
            db.id,
            db.drydockRequestId,
            db.drydockBidId,
            db.shipyardUserId,
            db.status,
            db.bookingDate,
            db.notes,
            dr.vesselName,
            dr.imoNumber,
            dr.status as requestStatus,
            db_bid.shipyardName,
            db_bid.totalBid,
            db_bid.totalDays,
            db_bid.status as bidStatus,
            db_bid.servicesOffered,
            db_bid.serviceCalculations,
            db_bid.bidCertificateUrl,
            db_bid.submittedAt as bidDate,
            su.fullName as shipyardContactName,
            su.email as shipyardContactEmail,
            su.contactNumber as shipyardContactNumber,
            su.officeAddress as shipyardAddress,
            su.contactPerson as shipyardContactPerson,
            su.businessRegNumber as shipyardBusinessReg,
            su.logoUrl as shipyardLogoUrl,
            su.certificateBuilder,
            su.certificateRepair,
            su.certificateOther
          FROM drydock_bookings db
          LEFT JOIN drydock_requests dr ON db.drydockRequestId = dr.id
          LEFT JOIN drydock_bids db_bid ON db.drydockBidId = db_bid.id
          LEFT JOIN users su ON db.shipyardUserId = su.id
          WHERE db.userId = ${userId} AND db.drydockRequestId = ${drydockRequestId}
          ORDER BY db.createdAt DESC
        `
      : await prisma.$queryRaw`
          SELECT 
            db.id,
            db.drydockRequestId,
            db.drydockBidId,
            db.shipyardUserId,
            db.status,
            db.bookingDate,
            db.notes,
            dr.vesselName,
            dr.imoNumber,
            dr.status as requestStatus,
            db_bid.shipyardName,
            db_bid.totalBid,
            db_bid.totalDays,
            db_bid.status as bidStatus,
            db_bid.servicesOffered,
            db_bid.serviceCalculations,
            db_bid.bidCertificateUrl,
            db_bid.submittedAt as bidDate,
            su.fullName as shipyardContactName,
            su.email as shipyardContactEmail,
            su.contactNumber as shipyardContactNumber,
            su.officeAddress as shipyardAddress,
            su.contactPerson as shipyardContactPerson,
            su.businessRegNumber as shipyardBusinessReg,
            su.logoUrl as shipyardLogoUrl,
            su.certificateBuilder,
            su.certificateRepair,
            su.certificateOther
          FROM drydock_bookings db
          LEFT JOIN drydock_requests dr ON db.drydockRequestId = dr.id
          LEFT JOIN drydock_bids db_bid ON db.drydockBidId = db_bid.id
          LEFT JOIN users su ON db.shipyardUserId = su.id
          WHERE db.userId = ${userId}
          ORDER BY db.createdAt DESC
        `

    return NextResponse.json({
      success: true,
      bookings: Array.isArray(bookings) ? bookings.map((booking: {
        id: string;
        drydockRequestId: string;
        drydockBidId: string;
        shipyardUserId: string;
        status: string;
        bookingDate: Date;
        notes: string | null;
        vesselName: string;
        imoNumber: string;
        requestStatus: string;
        shipyardName: string;
        totalBid: number;
        totalDays: number;
        bidStatus: string;
        servicesOffered: Record<string, unknown>;
        serviceCalculations: Record<string, unknown>;
        bidCertificateUrl: string | null;
        bidDate: Date;
        shipyardContactName: string;
        shipyardContactEmail: string;
        shipyardContactNumber: string;
        shipyardAddress: string;
        shipyardContactPerson: string;
        shipyardBusinessReg: string;
        shipyardLogoUrl: string | null;
        certificateBuilder: string | null;
        certificateRepair: string | null;
        certificateOther: string | null;
      }) => ({
        id: booking.id,
        drydockRequestId: booking.drydockRequestId,
        drydockBidId: booking.drydockBidId,
        shipyardUserId: booking.shipyardUserId,
        status: booking.status,
        bookingDate: booking.bookingDate,
        notes: booking.notes,
        vesselName: booking.vesselName,
        imoNumber: booking.imoNumber,
        requestStatus: booking.requestStatus,
        shipyardName: booking.shipyardName,
        totalBid: booking.totalBid,
        totalDays: booking.totalDays,
        bidStatus: booking.bidStatus,
        servicesOffered: booking.servicesOffered,
        serviceCalculations: booking.serviceCalculations,
        bidCertificateUrl: booking.bidCertificateUrl,
        bidDate: booking.bidDate,
        shipyardContactName: booking.shipyardContactName,
        shipyardContactEmail: booking.shipyardContactEmail,
        shipyardContactNumber: booking.shipyardContactNumber,
        shipyardAddress: booking.shipyardAddress,
        shipyardContactPerson: booking.shipyardContactPerson,
        shipyardBusinessReg: booking.shipyardBusinessReg,
        shipyardLogoUrl: booking.shipyardLogoUrl,
        certificateBuilder: booking.certificateBuilder,
        certificateRepair: booking.certificateRepair,
        certificateOther: booking.certificateOther
      })) : []
    })

  } catch (error) {
    console.error('Error fetching drydock bookings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch drydock bookings' },
      { status: 500 }
    )
  }
}

