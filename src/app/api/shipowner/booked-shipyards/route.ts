import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const search = searchParams.get('search') || ''

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    console.log('Fetching booked shipyards for userId:', userId)

    // Build the where clause
    const whereClause: {
      userId: string
      status: { in: ('CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED')[] }
      OR?: Array<{
        drydockRequest: {
          vesselName?: { contains: string; mode: 'insensitive' }
          imoNumber?: { contains: string; mode: 'insensitive' }
        }
      }>
    } = {
      userId: userId,
      status: {
        in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] as ('CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED')[]
      }
    }

    // Add search functionality if search term is provided
    if (search) {
      whereClause.OR = [
        {
          drydockRequest: {
            vesselName: {
              contains: search,
              mode: 'insensitive'
            }
          }
        },
        {
          drydockRequest: {
            imoNumber: {
              contains: search,
              mode: 'insensitive'
            }
          }
        }
      ]
    }

    // Fetch booked shipyards for the shipowner
    const bookedShipyards = await prisma.drydockBooking.findMany({
      where: whereClause,
      include: {
        drydockRequest: {
          include: {
            vessel: true
          }
        },
        drydockBid: {
          include: {
            shipyardUser: {
              select: {
                fullName: true,
                shipyardName: true,
                logoUrl: true
              }
            }
          }
        },
        services: true
      },
      orderBy: {
        bookingDate: 'desc'
      }
    })

    console.log('Found booked shipyards:', bookedShipyards.length)

    // Transform the data to match the table structure
    interface Service {
      id: string
      serviceName: string
      startDate: Date
      endDate: Date
      progress: number | null
    }

    const transformedData = await Promise.all(bookedShipyards.map(async (booking) => {
      const shipyard = booking.drydockBid?.shipyardUser
      const vessel = booking.drydockRequest?.vessel
      const totalCost = booking.drydockBid?.totalBid || 0
      
      // Calculate overall progress from services
      const services = (booking.services || []) as Service[]
      const overallProgress = services.length > 0 
        ? Math.round(services.reduce((sum: number, service) => sum + (service.progress || 0), 0) / services.length)
        : 0

      // Calculate end date from services or use booking date
      let endDate = booking.bookingDate
      if (services.length > 0) {
        const maxEndDate = Math.max(...services.map((s) => new Date(s.endDate).getTime()))
        endDate = new Date(maxEndDate)
      }

      // Map services with basic information
      const servicesWithProgress = services.map((service) => ({
        id: service.id,
        serviceName: service.serviceName,
        startDate: service.startDate,
        endDate: service.endDate,
        progress: service.progress || 0,
        progressUpdates: [] // Will be fetched separately if needed
      }))

      return {
        id: booking.id,
        shipyard: {
          name: shipyard?.shipyardName || shipyard?.fullName || 'Unknown Shipyard',
          logo: shipyard?.logoUrl
        },
        vessel: {
          name: vessel?.vesselName || 'Unknown Vessel',
          imo: vessel?.imoNumber || 'Unknown IMO'
        },
        startDate: booking.bookingDate,
        endDate: endDate,
        initialCost: totalCost,
        status: booking.status,
        services: servicesWithProgress,
        overallProgress: overallProgress
      }
    }))

    return NextResponse.json({
      success: true,
      data: transformedData
    })

  } catch (error) {
    console.error('Error fetching booked shipyards:', error)
    return NextResponse.json(
      { error: 'Failed to fetch booked shipyards' },
      { status: 500 }
    )
  }
}