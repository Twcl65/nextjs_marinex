import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import crypto from "crypto"
import { jwtVerify } from "jose"
import { logUserActivity, ActivityType } from "@/lib/activity-logger"

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

    // Send SMS notification if user has contact number
    let smsSent = false
    let smsError = null
    
    if (vessel.user.contactNumber) {
      try {
        // Format phone number (handle formats like: 09166879159, +639166879159, 9166879159)
        let phoneNumber = vessel.user.contactNumber.trim().replace(/\s+/g, '')
        
        // Remove any non-digit characters except +
        phoneNumber = phoneNumber.replace(/[^\d+]/g, '')
        
        // Handle different phone number formats
        if (phoneNumber.startsWith('+63')) {
          // Already in international format: +639166879159
          // Just validate it has 10 digits after +63
          const digits = phoneNumber.substring(3)
          if (digits.length !== 10) {
            throw new Error(`Invalid phone number length: ${phoneNumber}. Expected 10 digits after +63`)
          }
        } else if (phoneNumber.startsWith('63') && phoneNumber.length === 12) {
          // Format: 639166879159 (missing +)
          phoneNumber = `+${phoneNumber}`
        } else if (phoneNumber.startsWith('0') && phoneNumber.length === 11) {
          // Format: 09166879159 (local format with leading 0)
          phoneNumber = phoneNumber.substring(1) // Remove leading 0
          phoneNumber = `+63${phoneNumber}`
        } else if (phoneNumber.length === 10 && /^9\d{9}$/.test(phoneNumber)) {
          // Format: 9166879159 (10 digits starting with 9)
          phoneNumber = `+63${phoneNumber}`
        } else {
          throw new Error(`Invalid phone number format: ${vessel.user.contactNumber}. Supported formats: 09166879159, 9166879159, +639166879159`)
        }

        // Final validation: should be +63 followed by exactly 10 digits
        if (!/^\+63\d{10}$/.test(phoneNumber)) {
          throw new Error(`Invalid phone number format after processing: ${phoneNumber}. Expected format: +639123456789`)
        }

        console.log(`Formatted phone number: ${vessel.user.contactNumber} -> ${phoneNumber}`)

        // Create SMS message matching the notification format (professional and detailed)
        const requirementsListSms = requirements.map((req, index) => `${index + 1}. ${req}`).join('\n')
        
        const smsMessage = `Dear ${companyName},

We would like to inform you that your vessel, ${vesselName}, certification is nearing its expiration date. To remain in compliance with maritime regulations, please proceed with the necessary drydocking and submit the following requirements as soon as possible:

Requirements:
${requirementsListSms}

If you have any questions or need assistance, feel free to contact us.

Thank you for your prompt attention.

Best regards,
Maritime Industry Authority`

        // Send SMS using TextBee.dev API
        const textbeeApiKey = process.env.TEXTBEE_API_KEY || 'ceedf0f3-b0b3-43e4-af6a-aa5a2745f4c1'
        const textbeeDeviceId = process.env.TEXTBEE_DEVICE_ID || '69232a9382033f1609eb65b1'
        
        const textbeeApiUrl = `https://api.textbee.dev/api/v1/gateway/devices/${textbeeDeviceId}/send-sms`

        console.log('Sending SMS via TextBee.dev to:', phoneNumber)
        console.log('TextBee Device ID:', textbeeDeviceId)
        console.log('TextBee API URL:', textbeeApiUrl)

        const smsResponse = await fetch(textbeeApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': textbeeApiKey,
          },
          body: JSON.stringify({
            recipients: [phoneNumber],
            message: smsMessage,
          }),
        })

        console.log('SMS API Response Status:', smsResponse.status)
        
        // Get response text first (can only read once)
        const responseText = await smsResponse.text()
        console.log('SMS API Response Text:', responseText)

        // Check if response is OK
        if (!smsResponse.ok) {
          console.error('SMS API HTTP Error:', smsResponse.status, responseText)
          smsError = `HTTP ${smsResponse.status}: ${responseText.substring(0, 200)}`
        } else {
          // Try to parse JSON response
          try {
            const smsResult = JSON.parse(responseText)
            console.log('SMS API Response (parsed):', smsResult)

            // TextBee.dev typically returns success in response data
            if (smsResult.success || smsResult.status === 'success' || smsResponse.ok) {
              smsSent = true
              console.log('SMS sent successfully via TextBee.dev:', smsResult)
            } else {
              smsError = smsResult.error || smsResult.message || 'Failed to send SMS'
              console.error('SMS API error:', smsError)
            }
          } catch (parseError) {
            console.error('Failed to parse SMS API response as JSON:', parseError)
            console.error('Response text:', responseText)
            // If it's not JSON but status is OK, might still be successful
            if (smsResponse.ok && responseText.toLowerCase().includes('success')) {
              smsSent = true
              console.log('SMS appears to be sent (non-JSON success response)')
            } else {
              smsError = `Invalid response format: ${responseText.substring(0, 200)}`
            }
          }
        }
      } catch (error) {
        smsError = error instanceof Error ? error.message : 'Unknown SMS error'
        console.error('Error sending SMS:', error)
        // Don't fail the notification if SMS fails
      }
    } else {
      console.log('SMS not sent: User does not have a contact number')
      console.log('User object:', { 
        userId: vessel.user.id, 
        fullName: vessel.user.fullName,
        contactNumber: vessel.user.contactNumber 
      })
    }

    // Log activity for marina user
    const marinaUser = await prisma.user.findFirst({
      where: { role: 'MARINA' },
      select: { id: true }
    })
    
    if (marinaUser) {
      const requirementsList = requirements.join(', ')
      await logUserActivity(
        marinaUser.id,
        ActivityType.SHIPOWNER_NOTIFIED,
        `Shipowner notified for ${vesselName} (${requirementsList})`,
        'Bell',
        {
          vesselId: vesselId,
          vesselName: vesselName,
          userId: userId,
          requirements: requirements
        }
      )
    }

    return NextResponse.json({
      success: true,
      notificationId,
      message: "Notification created successfully",
      smsSent,
      ...(smsError && { smsError })
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

