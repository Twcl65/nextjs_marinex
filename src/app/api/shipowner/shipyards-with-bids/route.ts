import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const drydockRequestId = searchParams.get('drydockRequestId')

    if (!drydockRequestId) {
      return NextResponse.json({ error: 'Drydock Request ID is required' }, { status: 400 })
    }

    console.log('Fetching shipyards with bids for drydock request:', drydockRequestId)

    // Fetch shipyards that have submitted bids for this drydock request
    // Only show recommended bids (status = 'RECOMMENDED')
    const shipyardsWithBids = await prisma.$queryRaw`
      SELECT 
        db.id as bidId,
        db.drydockRequestId,
        db.shipyardUserId,
        db.shipyardName,
        db.shipyardAddress,
        db.shipyardContactNumber,
        db.shipyardContactPerson,
        db.shipyardBusinessReg,
        db.shipyardLogoUrl,
        db.certificateBuilder,
        db.certificateRepair,
        db.certificateOther,
        db.bidCertificateUrl,
        db.servicesOffered,
        db.serviceCalculations,
        db.totalBid,
        db.totalDays,
        db.status as bidStatus,
        db.submittedAt as bidDate,
        u.logoUrl as userLogoUrl
      FROM drydock_bids db
      LEFT JOIN users u ON db.shipyardUserId = u.id
      WHERE db.drydockRequestId = ${drydockRequestId}
        AND db.status = 'RECOMMENDED'
      ORDER BY db.submittedAt DESC
    `

    console.log(`Found ${Array.isArray(shipyardsWithBids) ? shipyardsWithBids.length : 0} recommended shipyards with bids for drydock request ${drydockRequestId}`)

    // Transform the data to match the expected format
    const transformedShipyards = Array.isArray(shipyardsWithBids)
      ? shipyardsWithBids.map((shipyard: {
        bidId: string;
        drydockRequestId: string;
        shipyardUserId: string;
        shipyardName: string;
        shipyardAddress: string;
        shipyardContactNumber: string;
        shipyardContactPerson: string;
        shipyardBusinessReg: string;
        shipyardLogoUrl: string | null;
        certificateBuilder: string | null;
        certificateRepair: string | null;
        certificateOther: string | null;
        bidCertificateUrl: string | null;
        servicesOffered: Record<string, unknown>;
        serviceCalculations: Record<string, unknown>;
        totalBid: number;
        totalDays: number;
        bidStatus: string;
        bidDate: Date;
        userLogoUrl: string | null;
      }) => ({
          bidId: shipyard.bidId,
          drydockRequestId: shipyard.drydockRequestId,
          shipyardUserId: shipyard.shipyardUserId,
          shipyardName: shipyard.shipyardName,
          shipyardAddress: shipyard.shipyardAddress,
          shipyardContactNumber: shipyard.shipyardContactNumber,
          shipyardContactPerson: shipyard.shipyardContactPerson,
          shipyardBusinessReg: shipyard.shipyardBusinessReg,
          shipyardLogoUrl: shipyard.shipyardLogoUrl || shipyard.userLogoUrl,
          certificateBuilder: shipyard.certificateBuilder,
          certificateRepair: shipyard.certificateRepair,
          certificateOther: shipyard.certificateOther,
          bidCertificateUrl: shipyard.bidCertificateUrl,
          servicesOffered: shipyard.servicesOffered,
          serviceCalculations: shipyard.serviceCalculations,
          totalBid: shipyard.totalBid,
          totalDays: shipyard.totalDays,
          bidStatus: shipyard.bidStatus,
          bidDate: shipyard.bidDate
        }))
      : []

    return NextResponse.json({
      success: true,
      shipyards: transformedShipyards
    })

  } catch (error) {
    console.error('Error fetching shipyards with bids:', error)
    return NextResponse.json(
      { error: 'Failed to fetch shipyards with bids' },
      { status: 500 }
    )
  }
}
