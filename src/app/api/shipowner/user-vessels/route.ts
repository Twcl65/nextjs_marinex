import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    const vessels = await prisma.shipVessel.findMany({
      where: {
        userId: userId,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        vesselName: true,
        imoNumber: true,
        vesselImageUrl: true
      },
      orderBy: {
        vesselName: 'asc'
      }
    })

    return NextResponse.json({
      success: true,
      data: vessels
    })

  } catch (error) {
    console.error('Error fetching user vessels:', error)
    return NextResponse.json(
      { error: 'Failed to fetch vessels' },
      { status: 500 }
    )
  }
}
