import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const certificateId = searchParams.get('certificateId')

    if (!certificateId) {
      return NextResponse.json(
        { success: false, error: 'certificateId is required' },
        { status: 400 }
      )
    }

    const recert = await prisma.drydockVesselRecertificate.findFirst({
      where: { certificateId },
      include: {
        vessel: true,
      },
    })

    if (!recert) {
      return NextResponse.json(
        {
          success: false,
          status: 'NOT_FOUND',
          message: 'Certificate not found',
        },
        { status: 404 }
      )
    }

    const now = new Date()
    let status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' = 'ACTIVE'

    if (recert.certificateRevoked) {
      status = 'REVOKED'
    } else if (recert.certificateExpiry && recert.certificateExpiry < now) {
      status = 'EXPIRED'
    }

    return NextResponse.json({
      success: true,
      status,
      data: {
        certificateId: recert.certificateId,
        companyName: recert.companyName,
        vesselName: recert.vesselName,
        vesselImoNumber: recert.vesselImoNumber,
        issuedAt: recert.certificateIssuedAt,
        expiry: recert.certificateExpiry,
        vessel: recert.vessel
          ? {
              shipType: recert.vessel.shipType,
              flag: recert.vessel.flag,
              yearOfBuild: recert.vessel.yearOfBuild,
              lengthOverall: recert.vessel.lengthOverall,
              grossTonnage: recert.vessel.grossTonnage,
            }
          : null,
      },
    })
  } catch (error) {
    console.error('Error verifying vessel certificate:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to verify certificate',
      },
      { status: 500 }
    )
  }
}

