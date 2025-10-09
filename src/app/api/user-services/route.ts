import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, name, squareMeters, hours, workers, days, price } = body

    if (!userId || !name || !squareMeters || !hours || !workers || !days || !price) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    // Create new service
    const newService = await prisma.userService.create({
      data: {
        userId,
        name,
        squareMeters: parseInt(squareMeters),
        hours: parseInt(hours),
        workers: parseInt(workers),
        days: parseInt(days),
        price: String(price),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Service added successfully',
      service: newService
    })

  } catch (error) {
    console.error('Error adding service:', error)
    return NextResponse.json(
      { error: 'Failed to add service' },
      { status: 500 }
    )
  }
}

export async function GET(_req: NextRequest) {
  try {
    console.log('Fetching all services from user_services table')

    // Get all services from user_services table (all users)
    const services = await prisma.userService.findMany({
      select: {
        id: true,
        name: true,
        squareMeters: true,
        hours: true,
        workers: true,
        days: true,
        price: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log('Found all services:', services)

    return NextResponse.json({ services })

  } catch (error) {
    console.error('Error fetching services:', error)
    return NextResponse.json(
      { error: 'Failed to fetch services' },
      { status: 500 }
    )
  }
}
