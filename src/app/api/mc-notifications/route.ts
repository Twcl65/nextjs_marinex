import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { jwtVerify } from "jose"

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
    // Get authenticated user from token
    const authenticatedUser = await getAuthenticatedUser(request)
    
    if (!authenticatedUser) {
      return NextResponse.json(
        { error: "Unauthorized. Please login." },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const requestedUserId = searchParams.get('userId')

    if (!requestedUserId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      )
    }

    // Verify that the logged-in user matches the requested userId
    if (authenticatedUser.userId !== requestedUserId) {
      return NextResponse.json(
        { error: "Forbidden. You can only access your own notifications." },
        { status: 403 }
      )
    }

    // Fetch notifications using raw SQL query (like POST method)
    const notifications = await prisma.$queryRaw<Array<{
      id: string
      userId: string
      vesselId: string
      title: string
      type: string
      message: string
      isRead: number
      createdAt: Date
      updatedAt: Date
      vesselName: string
      imoNumber: string
    }>>`
      SELECT 
        n.id,
        n.userId,
        n.vesselId,
        n.title,
        n.type,
        n.message,
        n.isRead,
        n.createdAt,
        n.updatedAt,
        v.vesselName,
        v.imoNumber
      FROM drydock_mc_notifications n
      INNER JOIN ship_vessels v ON n.vesselId = v.id
      WHERE n.userId = ${requestedUserId}
      ORDER BY n.createdAt DESC
    `

    // Get unread count
    const unreadCount = notifications.filter(n => n.isRead === 0).length

    // Format notifications
    const formattedNotifications = notifications.map(notification => ({
      id: notification.id,
      title: notification.title,
      type: notification.type,
      message: notification.message,
      vesselName: notification.vesselName,
      imoNumber: notification.imoNumber,
      isRead: notification.isRead === 1,
      createdAt: notification.createdAt instanceof Date 
        ? notification.createdAt.toISOString() 
        : new Date(notification.createdAt).toISOString(),
      updatedAt: notification.updatedAt instanceof Date 
        ? notification.updatedAt.toISOString() 
        : new Date(notification.updatedAt).toISOString()
    }))

    return NextResponse.json({
      notifications: formattedNotifications,
      unreadCount,
      totalCount: notifications.length
    })

  } catch (error) {
    console.error("Error fetching notifications:", error)
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, vesselId, drydockReport, drydockCertificate, safetyCertificate, vesselPlans } = body

    if (!userId || !vesselId) {
      return NextResponse.json(
        { error: "User ID and Vessel ID are required" },
        { status: 400 }
      )
    }

    // Fetch vessel and user details for the notification message
    const vessel = await prisma.shipVessel.findUnique({
      where: { id: vesselId },
      include: { user: true }
    })

    if (!vessel) {
      return NextResponse.json(
        { error: "Vessel not found" },
        { status: 404 }
      )
    }

    // Build the requirements list based on checked items
    const requirements = []
    if (drydockReport) requirements.push("Drydock Report")
    if (drydockCertificate) requirements.push("Drydock Certificate")
    if (safetyCertificate) requirements.push("Safety Certificate")
    if (vesselPlans) requirements.push("Vessel Plans")

    // Generate the notification message
    const companyName = vessel.user.fullName || "Test"
    const vesselName = vessel.vesselName || "Test Ship"
    
    const requirementsList = requirements.map((req, index) => `${index + 1}. ${req}`).join("\n\n")

    const message = `Dear **${companyName}**,



We would like to inform you that your vessel, **${vesselName}**, certification is nearing its expiration date. To remain in compliance with **maritime** regulations, please proceed with the necessary **drydocking and submit the following requirements** as soon as possible:

**Requirements:**

${requirementsList}

If you have any questions or need assistance, feel free to contact us.

Thank you for your prompt attention.

Best regards,

**Maritime Industry Authority**`

    // Create notification in database
    const notificationId = crypto.randomUUID()
    
    await prisma.$executeRaw`
      INSERT INTO drydock_mc_notifications (
        id, userId, vesselId, drydockReport, drydockCertificate, 
        safetyCertificate, vesselPlans, title, type, message, 
        isRead, createdAt, updatedAt
      ) VALUES (
        ${notificationId}, ${userId}, ${vesselId}, 
        ${drydockReport ? 1 : 0}, ${drydockCertificate ? 1 : 0}, 
        ${safetyCertificate ? 1 : 0}, ${vesselPlans ? 1 : 0},
        'Vessel Certificate Expiration', 'Vessel Recertification',
        ${message}, 0, NOW(), NOW()
      )
    `

    return NextResponse.json({
      success: true,
      notificationId,
      message: "Notification created successfully"
    }, { status: 201 })

  } catch (error) {
    console.error("Error creating notification:", error)
    return NextResponse.json(
      { error: "Failed to create notification" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Get authenticated user from token
    const authenticatedUser = await getAuthenticatedUser(request)
    
    if (!authenticatedUser) {
      return NextResponse.json(
        { error: "Unauthorized. Please login." },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { notificationId } = body

    if (!notificationId) {
      return NextResponse.json(
        { error: "Notification ID is required" },
        { status: 400 }
      )
    }

    // Verify the notification belongs to the authenticated user
    const notification = await prisma.$queryRaw<Array<{
      id: string
      userId: string
      isRead: number
    }>>`
      SELECT id, userId, isRead
      FROM drydock_mc_notifications
      WHERE id = ${notificationId}
    `

    if (!notification || notification.length === 0) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      )
    }

    if (notification[0].userId !== authenticatedUser.userId) {
      return NextResponse.json(
        { error: "Forbidden. You can only mark your own notifications as read." },
        { status: 403 }
      )
    }

    // Mark notification as read
    await prisma.$executeRaw`
      UPDATE drydock_mc_notifications
      SET isRead = 1, updatedAt = NOW()
      WHERE id = ${notificationId} AND userId = ${authenticatedUser.userId}
    `

    return NextResponse.json({
      success: true,
      message: "Notification marked as read"
    })

  } catch (error) {
    console.error("Error marking notification as read:", error)
    return NextResponse.json(
      { error: "Failed to mark notification as read" },
      { status: 500 }
    )
  }
}

