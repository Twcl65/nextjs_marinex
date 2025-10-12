import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const bidderId = searchParams.get('bidderId')

    if (!bidderId) {
      return NextResponse.json({ error: 'Bidder ID is required' }, { status: 400 })
    }

    console.log('Fetching shipyard info for bidder:', bidderId)

    // First, get the shipyardUserId from the drydock_bids table
    const bidInfo = await prisma.$queryRaw`
      SELECT shipyardUserId 
      FROM drydock_bids 
      WHERE id = ${bidderId}
    `

    console.log('Bid info:', bidInfo)

    if (!Array.isArray(bidInfo) || bidInfo.length === 0) {
      return NextResponse.json({ error: 'Bid not found' }, { status: 404 })
    }

    const shipyardUserId = bidInfo[0].shipyardUserId

    if (!shipyardUserId) {
      return NextResponse.json({ error: 'No shipyard user ID found for this bid' }, { status: 404 })
    }

    // Then fetch shipyard information from users table
    const shipyardInfo = await prisma.$queryRaw`
      SELECT 
        id,
        shipyardName,
        logoUrl as shipyardLogo,
        officeAddress as shipyardAddress,
        contactNumber as shipyardContactNumber,
        contactPerson as shipyardContactPerson,
        businessRegNumber as shipyardBusinessReg,
        certificateBuilder,
        certificateRepair,
        certificateOther
      FROM users
      WHERE id = ${shipyardUserId}
    `

    console.log(`Found shipyard info:`, Array.isArray(shipyardInfo) ? shipyardInfo.length : 0)
    console.log('Raw shipyard info:', shipyardInfo)

    // Transform the data
    const transformedInfo = Array.isArray(shipyardInfo) && shipyardInfo.length > 0 ? {
      id: shipyardInfo[0].id,
      shipyard_name: shipyardInfo[0].shipyardName || 'Unknown Shipyard',
      shipyard_logo: shipyardInfo[0].shipyardLogo,
      shipyard_address: shipyardInfo[0].shipyardAddress,
      shipyard_contact_number: shipyardInfo[0].shipyardContactNumber,
      shipyard_contact_person: shipyardInfo[0].shipyardContactPerson,
      shipyard_business_reg: shipyardInfo[0].shipyardBusinessReg,
      certificate_builder: shipyardInfo[0].certificateBuilder,
      certificate_repair: shipyardInfo[0].certificateRepair,
      certificate_other: shipyardInfo[0].certificateOther
    } : null

    if (!transformedInfo) {
      return NextResponse.json({ error: 'Shipyard not found' }, { status: 404 })
    }

    return NextResponse.json({ shipyardInfo: transformedInfo }, { status: 200 })
  } catch (error) {
    console.error('Error fetching shipyard info:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    })
    
    // Check if it's a Prisma error
    if (error instanceof Error && error.message.includes('Unknown column')) {
      return NextResponse.json(
        { 
          error: 'Database schema error',
          details: 'Column name mismatch in database query'
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch shipyard info',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
