import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    // Get user ID from query parameters
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Fetch vessels for the specified user
    const vessels = await prisma.shipVessel.findMany({
      where: {
        userId: userId,
        status: 'ACTIVE' // Only fetch active vessels
      },
      select: {
        id: true,
        vesselName: true,
        imoNumber: true,
        shipType: true,
        flag: true,
        yearOfBuild: true,
        lengthOverall: true,
        grossTonnage: true,
        vesselCertificationExpiry: true,
        vesselImageUrl: true,
        vesselCertificationUrl: true,
        vesselPlansUrl: true,
        drydockCertificateUrl: true,
        safetyCertificateUrl: true,
        status: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ vessels }, { status: 200 })
  } catch (error) {
    console.error('Error fetching vessels:', error)
    return NextResponse.json({ error: 'Failed to fetch vessels' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      vesselName,
      imoNumber,
      shipType,
      flag,
      yearOfBuild,
      lengthOverall,
      grossTonnage,
      vesselCertificationExpiry,
      vesselImageUrl,
      vesselCertificationUrl,
      vesselPlansUrl,
      drydockCertificateUrl,
      safetyCertificateUrl,
      userId
    } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Create new vessel
    const vessel = await prisma.shipVessel.create({
      data: {
        userId,
        vesselName,
        imoNumber,
        shipType,
        flag,
        yearOfBuild: parseInt(yearOfBuild),
        lengthOverall: parseFloat(lengthOverall),
        grossTonnage: parseFloat(grossTonnage),
        vesselCertificationExpiry: new Date(vesselCertificationExpiry),
        vesselImageUrl,
        vesselCertificationUrl,
        vesselPlansUrl,
        drydockCertificateUrl,
        safetyCertificateUrl,
        status: 'ACTIVE'
      }
    })

    return NextResponse.json({ vessel }, { status: 201 })
  } catch (error) {
    console.error('Error creating vessel:', error)
    return NextResponse.json({ error: 'Failed to create vessel' }, { status: 500 })
  }
}