import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const drydockRequestId = searchParams.get('drydockRequestId')

    if (!drydockRequestId) {
      return NextResponse.json({ error: 'Drydock Request ID is required' }, { status: 400 })
    }

    console.log('Fetching bidders for drydock request:', drydockRequestId)

    // Fetch all bidders for the specified drydock request
    const bidders = await prisma.$queryRaw`
      SELECT 
        db.id,
        db.drydockRequestId,
        db.shipyardUserId,
        db.shipyardName,
        db.shipyardAddress,
        db.shipyardContactNumber,
        db.shipyardContactPerson,
        db.shipyardBusinessReg,
        db.shipyardLogoUrl,
        db.servicesOffered,
        db.certificateBuilder,
        db.certificateRepair,
        db.certificateOther,
        db.bidCertificateUrl,
        db.totalBid,
        db.totalDays,
        db.status,
        db.submittedAt as bidDate,
        u.logoUrl as shipyardLogo
      FROM drydock_bids db
      LEFT JOIN users u ON db.shipyardUserId = u.id
      WHERE db.drydockRequestId = ${drydockRequestId}
      ORDER BY db.submittedAt DESC
    `

    console.log(`Found ${Array.isArray(bidders) ? bidders.length : 0} bidders`)

    // Transform the data to match the expected format
    const transformedBidders = Array.isArray(bidders) ? bidders.map((bidder: {
      id: string;
      drydockRequestId: string;
      shipyardUserId: string;
      shipyardName: string;
      shipyardAddress: string;
      shipyardContactNumber: string;
      shipyardContactPerson: string | null;
      shipyardBusinessReg: string | null;
      shipyardLogoUrl: string | null;
      servicesOffered: string | unknown;
      certificateBuilder: string | null;
      certificateRepair: string | null;
      certificateOther: string | null;
      bidCertificateUrl: string | null;
      totalBid: number;
      totalDays: number;
      status: string;
      bidDate: Date;
      shipyardLogo: string | null;
    }) => ({
      id: bidder.id,
      shipyard_name: bidder.shipyardName || 'Unknown Shipyard',
      shipyard_logo: bidder.shipyardLogoUrl || bidder.shipyardLogo,
      certificate_builder: bidder.certificateBuilder,
      certificate_repair: bidder.certificateRepair,
      certificate_other: bidder.certificateOther,
      bid_certificate_url: bidder.bidCertificateUrl,
      total_bid: bidder.totalBid,
      total_days: bidder.totalDays,
      services_offered: typeof bidder.servicesOffered === 'string' 
        ? JSON.parse(bidder.servicesOffered) 
        : bidder.servicesOffered,
      bid_date: bidder.bidDate,
      status: bidder.status || 'SUBMITTED'
    })) : []

    console.log('Transformed bidders:', transformedBidders.length)

    return NextResponse.json({ bidders: transformedBidders }, { status: 200 })
  } catch (error) {
    console.error('Error fetching bidders:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { 
        error: 'Failed to fetch bidders',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
