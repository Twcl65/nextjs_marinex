import { prisma } from '@/lib/prisma'

export enum ActivityType {
  VESSEL_ADDED = 'VESSEL_ADDED',
  DRYDOCK_REQUESTED = 'DRYDOCK_REQUESTED',
  SHIPYARD_BOOKED = 'SHIPYARD_BOOKED',
  AUTHORITY_REQUESTED = 'AUTHORITY_REQUESTED',
  RECERTIFICATION_REQUESTED = 'RECERTIFICATION_REQUESTED',
  DOCUMENT_ADDED = 'DOCUMENT_ADDED',
  BID_SUBMITTED = 'BID_SUBMITTED',
  PROGRESS_UPDATED = 'PROGRESS_UPDATED',
  BOOKING_CONFIRMED = 'BOOKING_CONFIRMED',
  AUTHORITY_APPROVED = 'AUTHORITY_APPROVED',
  USER_SUSPENDED = 'USER_SUSPENDED',
  SHIPYARD_RECOMMENDED = 'SHIPYARD_RECOMMENDED',
  SHIPOWNER_NOTIFIED = 'SHIPOWNER_NOTIFIED',
  RECERTIFICATION_APPROVED = 'RECERTIFICATION_APPROVED',
}

export interface ActivityMetadata {
  vesselId?: string
  vesselName?: string
  drydockRequestId?: string
  bookingId?: string
  shipyardName?: string
  documentType?: string
  documentName?: string
  bidId?: string
  serviceName?: string
  progressPercent?: number
  [key: string]: unknown
}

/**
 * Logs a user activity to the database
 * @param userId - The ID of the user performing the activity
 * @param activityType - The type of activity
 * @param message - The activity message to display
 * @param icon - The icon name to display (default: "Wrench")
 * @param metadata - Optional metadata to store with the activity
 */
export async function logUserActivity(
  userId: string,
  activityType: ActivityType,
  message: string,
  icon: string = 'Wrench',
  metadata?: ActivityMetadata
): Promise<void> {
  try {
    const activityId = `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    await prisma.$executeRaw`
      INSERT INTO users_activity (
        id, userId, activityType, message, icon, metadata, createdAt
      ) VALUES (
        ${activityId}, ${userId}, ${activityType}, ${message}, ${icon}, 
        ${metadata ? JSON.stringify(metadata) : null}, NOW()
      )
    `
    
    console.log(`Activity logged: ${activityType} for user ${userId}`)
  } catch (error) {
    // Log error but don't throw - activity logging should not break the main flow
    console.error('Error logging user activity:', error)
  }
}

