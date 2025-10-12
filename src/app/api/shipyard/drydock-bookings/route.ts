import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const shipyardUserId = searchParams.get('shipyardUserId')

    if (!shipyardUserId) {
      return NextResponse.json({ error: 'Shipyard User ID is required' }, { status: 400 })
    }

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
        db_bid.shipyardName,
        db_bid.totalBid,
        db_bid.totalDays,
        db_bid.parallelDays,
        db_bid.sequentialDays,
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
      LEFT JOIN drydock_bids db_bid ON db.drydockBidId = db_bid.id
      LEFT JOIN users u ON db.userId = u.id
      WHERE db.shipyardUserId = ${shipyardUserId}
      ORDER BY db.createdAt DESC
    `

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
        shipyardName: string;
        totalBid: number;
        totalDays: number;
        parallelDays: number;
        sequentialDays: number;
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
        shipyardName: booking.shipyardName,
        totalBid: booking.totalBid,
        totalDays: booking.totalDays,
        parallelDays: booking.parallelDays,
        sequentialDays: booking.sequentialDays,
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

    // Update booking status
    const updatedBooking = await prisma.$executeRaw`
      UPDATE drydock_bookings 
      SET status = ${status}, notes = ${notes || null}, updatedAt = NOW()
      WHERE id = ${bookingId}
    `

    return NextResponse.json({
      success: true,
      booking: updatedBooking
    })

  } catch (error) {
    console.error('Error updating booking status:', error)
    return NextResponse.json(
      { error: 'Failed to update booking status' },
      { status: 500 }
    )
  }
}
