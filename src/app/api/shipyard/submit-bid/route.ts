import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      drydockRequestId,
      shipyardUserId,
      servicesOffered,
      serviceCalculations,
      totalBid,
      totalDays,
      bidCertificateUrl,
      pricingBreakdown,
      scheduleDetails,
      contractConditions,
      taxesAndFees,
      additionalCosts,
      requiredDocumentation
    } = body

    // Fetch shipyard user information
    const shipyardUser = await prisma.user.findUnique({
      where: { id: shipyardUserId },
      select: {
        id: true,
        shipyardName: true,
        officeAddress: true,
        contactNumber: true,
        contactPerson: true,
        businessRegNumber: true,
        logoUrl: true,
        certificateBuilder: true,
        certificateRepair: true,
        certificateOther: true
      }
    })

    if (!shipyardUser) {
      return NextResponse.json(
        { error: 'Shipyard user not found' },
        { status: 404 }
      )
    }

    // Create the bid using raw SQL (since Prisma client generation has permission issues)
    const bidId = crypto.randomUUID()
    await prisma.$executeRaw`
      INSERT INTO drydock_bids (
        id, drydockRequestId, shipyardUserId, shipyardName, shipyardAddress, 
        shipyardContactNumber, shipyardContactPerson, shipyardBusinessReg, 
        shipyardLogoUrl, certificateBuilder, certificateRepair, certificateOther,
        bidCertificateUrl, servicesOffered, serviceCalculations, totalBid, totalDays,
        pricingBreakdown, scheduleDetails, contractConditions, taxesAndFees,
        additionalCosts, requiredDocumentation, status, submittedAt, updatedAt
      ) VALUES (
        ${bidId}, ${drydockRequestId}, ${shipyardUserId}, 
        ${shipyardUser.shipyardName || 'Unknown Shipyard'}, 
        ${shipyardUser.officeAddress || 'Unknown Address'}, 
        ${shipyardUser.contactNumber || 'Unknown'}, 
        ${shipyardUser.contactPerson}, 
        ${shipyardUser.businessRegNumber}, 
        ${shipyardUser.logoUrl}, 
        ${shipyardUser.certificateBuilder}, 
        ${shipyardUser.certificateRepair}, 
        ${shipyardUser.certificateOther},
        ${bidCertificateUrl || null},
        ${JSON.stringify(servicesOffered)}, 
        ${JSON.stringify(serviceCalculations)}, 
        ${totalBid}, ${totalDays},
        ${pricingBreakdown ? JSON.stringify(pricingBreakdown) : null},
        ${scheduleDetails ? JSON.stringify(scheduleDetails) : null},
        ${contractConditions ? JSON.stringify(contractConditions) : null},
        ${taxesAndFees ? JSON.stringify(taxesAndFees) : null},
        ${additionalCosts ? JSON.stringify(additionalCosts) : null},
        ${requiredDocumentation ? JSON.stringify(requiredDocumentation) : null},
        'SUBMITTED', NOW(), NOW()
      )
    `

    console.log('Bid created successfully:', bidId)

    return NextResponse.json({ 
      success: true, 
      bidId: bidId,
      message: 'Bid submitted successfully' 
    }, { status: 201 })

  } catch (error) {
    console.error('Error submitting bid:', error)
    return NextResponse.json(
      { error: 'Failed to submit bid' },
      { status: 500 }
    )
  }
}
