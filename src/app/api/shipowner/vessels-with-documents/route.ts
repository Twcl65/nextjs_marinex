import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key')

async function getAuthenticatedUser(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.substring(7)
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as { userId: string; email: string; role: string }
  } catch (error) {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get all vessels for the current user
    const vessels = await prisma.shipVessel.findMany({
      where: {
        userId: user.userId,
        status: 'ACTIVE'
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
        vesselImageUrl: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        vesselName: 'asc'
      }
    })

    // Get document counts for each vessel using raw SQL (including certificates)
    const vesselIds = vessels.map(v => v.id)
    const documentCountMap = new Map<string, number>()
    
    if (vesselIds.length > 0) {
      const placeholders = vesselIds.map(() => '?').join(',')
      
      // Get counts from user_documents
      const documentCounts = await prisma.$queryRawUnsafe<Array<{ vesselId: string; count: bigint }>>(
        `SELECT vesselId, COUNT(id) as count 
         FROM user_documents 
         WHERE vesselId IN (${placeholders}) 
         GROUP BY vesselId`,
        ...vesselIds
      )
      
      // Get counts from drydock_issued_certificates
      const certificateCounts = await prisma.$queryRawUnsafe<Array<{ vesselId: string; count: bigint }>>(
        `SELECT vesselId, COUNT(id) as count 
         FROM drydock_issued_certificates 
         WHERE vesselId IN (${placeholders}) 
         GROUP BY vesselId`,
        ...vesselIds
      )
      
      // Combine both counts
      const docCountMap = new Map(
        documentCounts.map(dc => [dc.vesselId, Number(dc.count)])
      )
      const certCountMap = new Map(
        certificateCounts.map(cc => [cc.vesselId, Number(cc.count)])
      )
      
      // Merge counts
      vesselIds.forEach(vesselId => {
        const docCount = docCountMap.get(vesselId) || 0
        const certCount = certCountMap.get(vesselId) || 0
        documentCountMap.set(vesselId, docCount + certCount)
      })
    }

    // Combine vessels with their document counts
    const vesselsWithCounts = vessels.map(vessel => ({
      ...vessel,
      documentCount: documentCountMap.get(vessel.id) || 0,
      createdAt: vessel.createdAt.toISOString()
    }))

    return NextResponse.json({
      success: true,
      data: vesselsWithCounts
    })
  } catch (error) {
    console.error('Error fetching vessels with documents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch vessels' },
      { status: 500 }
    )
  }
}

