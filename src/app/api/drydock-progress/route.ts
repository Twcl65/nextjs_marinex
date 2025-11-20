import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { writeFile } from 'fs/promises'
import { join } from 'path'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    
    const serviceId = formData.get('serviceId') as string
    const progress = parseInt(formData.get('progress') as string)
    const comment = formData.get('comment') as string
    const image = formData.get('image') as File | null

    if (!serviceId || !progress) {
      return NextResponse.json(
        { error: 'Missing required fields: serviceId, progress' },
        { status: 400 }
      )
    }

    let imageUrl: string | null = null

    // Handle image upload if provided
    if (image && image.size > 0) {
      const bytes = await image.arrayBuffer()
      const buffer = Buffer.from(bytes)
      
      // Create a unique filename
      const timestamp = Date.now()
      const filename = `progress-${serviceId}-${timestamp}.${image.name.split('.').pop()}`
      const path = join(process.cwd(), 'public', 'uploads', 'progress', filename)
      
      // Ensure directory exists
      const fs = await import('fs')
      const dir = join(process.cwd(), 'public', 'uploads', 'progress')
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      
      await writeFile(path, buffer)
      imageUrl = `/uploads/progress/${filename}`
    }

    // Determine progress level based on percentage
    let progressLevel: string
    if (progress <= 15) progressLevel = 'Level 1'
    else if (progress <= 25) progressLevel = 'Level 2'
    else if (progress <= 50) progressLevel = 'Level 3'
    else if (progress <= 75) progressLevel = 'Level 4'
    else progressLevel = 'Level 5'

    // Create progress record
    const progressRecord = await prisma.drydockProgress.create({
      data: {
        drydockServiceId: serviceId,
        progressLevel,
        progressPercent: progress,
        comment: comment || null,
        imageUrl,
        updatedBy: 'shipyard-user' // You might want to get this from auth context
      }
    })

    // Update the service progress
    await prisma.drydockService.update({
      where: { id: serviceId },
      data: { progress }
    })

    return NextResponse.json({
      success: true,
      data: progressRecord,
      message: 'Progress updated successfully'
    })

  } catch (error) {
    console.error('Error updating drydock progress:', error)
    return NextResponse.json(
      { 
        error: 'Failed to update progress',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const serviceId = searchParams.get('serviceId')

    if (!serviceId) {
      return NextResponse.json(
        { error: 'serviceId is required' },
        { status: 400 }
      )
    }

    const progressRecords = await prisma.drydockProgress.findMany({
      where: {
        drydockServiceId: serviceId
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    return NextResponse.json({
      success: true,
      data: progressRecords
    })

  } catch (error) {
    console.error('Error fetching drydock progress:', error)
    return NextResponse.json(
      { error: 'Failed to fetch progress records' },
      { status: 500 }
    )
  }
}
