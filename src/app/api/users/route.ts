import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Fetch only SHIPYARD and SHIPOWNER users with their services
    const users = await prisma.user.findMany({
      where: {
        role: {
          in: ['SHIPYARD', 'SHIPOWNER']
        }
      },
      include: {
        services: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Transform the data to include readable information
    const transformedUsers = users.map((user) => ({
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      fullName: user.fullName,
      shipyardName: user.shipyardName,
      contactNumber: user.contactNumber,
      officeAddress: user.officeAddress,
      businessRegNumber: user.businessRegNumber,
      logoUrl: user.logoUrl,
      certificateBuilder: user.certificateBuilder,
      certificateRepair: user.certificateRepair,
      certificateOther: user.certificateOther,
      contactPerson: user.contactPerson,
      services: user.services.map((service) => ({
        serviceName: service.name,
        servicePrice: service.price,
        squareMeters: service.squareMeters,
        hours: service.hours,
        workers: service.workers,
        days: service.days
      })),
      dryDockSlots: user.shipyardDryDock,
      shipownerVesselInfo: user.shipownerVesselInfo,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }))

    return NextResponse.json({ users: transformedUsers })
  } catch (error: unknown) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
