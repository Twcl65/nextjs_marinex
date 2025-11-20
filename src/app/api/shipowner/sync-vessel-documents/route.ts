import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jwtVerify } from 'jose'
import { randomUUID } from 'crypto'

// Helper function to generate UUID
function generateId(): string {
  return randomUUID()
}

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

export async function POST(request: NextRequest) {
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
        imoNumber: true
      }
    })

    if (vessels.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No vessels found to sync documents',
        synced: 0
      })
    }

    const vesselIds = vessels.map(v => v.id)
    let syncedCount = 0

    // Clean up any existing builder/repair/other certificates that shouldn't be there
    // These are shipyard credentials, not vessel documents
    const excludedDocumentNames = ['Builder Certificate', 'Repair Certificate', 'Other Certificate']
    if (vesselIds.length > 0) {
      const placeholders = vesselIds.map(() => '?').join(',')
      const namePlaceholders = excludedDocumentNames.map(() => '?').join(',')
      await prisma.$executeRawUnsafe(
        `DELETE FROM user_documents 
         WHERE vesselId IN (${placeholders}) 
         AND documentName IN (${namePlaceholders})`,
        ...vesselIds,
        ...excludedDocumentNames
      )
    }

    // 1. Sync certificates from ship_vessels table (uploaded by shipowner themselves)
    for (const vessel of vessels) {
      const vesselData = await prisma.shipVessel.findUnique({
        where: { id: vessel.id },
        select: {
          vesselCertificationUrl: true,
          vesselPlansUrl: true,
          drydockCertificateUrl: true,
          safetyCertificateUrl: true
        }
      })

      if (vesselData) {
        const documents = [
          { url: vesselData.vesselCertificationUrl, name: 'Vessel Certification', type: 'Certificate', description: 'Vessel certification document' },
          { url: vesselData.vesselPlansUrl, name: 'Vessel Plans', type: 'Plan', description: 'Vessel plans document' },
          { url: vesselData.drydockCertificateUrl, name: 'Drydock Certificate', type: 'Certificate', description: 'Drydock certificate' },
          { url: vesselData.safetyCertificateUrl, name: 'Safety Certificate', type: 'Certificate', description: 'Safety certificate' }
        ]

        for (const doc of documents) {
          if (doc.url && doc.url.trim() !== '' && doc.url !== 'null') {
            // Check if document already exists
            const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
              `SELECT id FROM user_documents WHERE vesselId = ? AND documentUrl = ? LIMIT 1`,
              vessel.id,
              doc.url
            )

            if (existing.length === 0) {
              await prisma.$executeRawUnsafe(
                `INSERT INTO user_documents (id, vesselId, senderId, documentType, documentName, documentUrl, description, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                generateId(),
                vessel.id,
                user.userId, // Shipowner uploaded these themselves
                doc.type,
                doc.name,
                doc.url,
                doc.description
              )
              syncedCount++
            }
          }
        }
      }
    }

    // 2. Sync certificates from drydock_vessel_recertificate table (sent by MARINA)
    const marinaUsers = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM users WHERE role = 'MARINA' LIMIT 1`
    )
    const marinaId = marinaUsers.length > 0 ? marinaUsers[0].id : null

    if (marinaId) {
      const recertificates = await prisma.$queryRawUnsafe<Array<{
        id: string
        vesselId: string
        vesselPlansUrl: string | null
        drydockReportUrl: string | null
        drydockCertificateUrl: string | null
        safetyCertificateUrl: string | null
        vesselCertificateFile: string | null
        status: string
      }>>(
        `SELECT id, vesselId, vesselPlansUrl, drydockReportUrl, drydockCertificateUrl, safetyCertificateUrl, vesselCertificateFile, status
         FROM drydock_vessel_recertificate
         WHERE vesselId IN (${vesselIds.map(() => '?').join(',')}) AND status = 'COMPLETED'`,
        ...vesselIds
      )

      for (const recert of recertificates) {
        const documents = [
          { url: recert.vesselPlansUrl, name: 'Vessel Plans', type: 'Plan', description: 'Vessel plans from recertification' },
          { url: recert.drydockReportUrl, name: 'Drydock Report', type: 'Report', description: 'Drydock report from recertification' },
          { url: recert.drydockCertificateUrl, name: 'Drydock Certificate', type: 'Certificate', description: 'Drydock certificate from recertification' },
          { url: recert.safetyCertificateUrl, name: 'Safety Certificate', type: 'Certificate', description: 'Safety certificate from recertification' },
          { url: recert.vesselCertificateFile, name: 'Vessel Certificate', type: 'Certificate', description: 'Vessel certificate file from recertification' }
        ]

        for (const doc of documents) {
          if (doc.url && doc.url.trim() !== '' && doc.url !== 'null') {
            // Check if document already exists
            const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
              `SELECT id FROM user_documents WHERE vesselId = ? AND documentUrl = ? LIMIT 1`,
              recert.vesselId,
              doc.url
            )

            if (existing.length === 0) {
              await prisma.$executeRawUnsafe(
                `INSERT INTO user_documents (id, vesselId, senderId, documentType, documentName, documentUrl, description, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                generateId(),
                recert.vesselId,
                marinaId, // Sent by MARINA
                doc.type,
                doc.name,
                doc.url,
                doc.description
              )
              syncedCount++
            }
          }
        }
      }
    }

    // 3. Sync authority certificates from drydock_authority_requests (sent by MARINA)
    // Only sync authority requests for requests created by the current user
    if (marinaId) {
      const authorityRequests = await prisma.$queryRawUnsafe<Array<{
        id: string
        vesselId: string
        userId: string
        authorityCertificate: string | null
      }>>(
        `SELECT dar.id, dar.vesselId, dar.userId, dar.authorityCertificate
         FROM drydock_authority_requests dar
         INNER JOIN drydock_requests dr ON dar.drydockRequestId = dr.id
         WHERE dar.vesselId IN (${vesselIds.map(() => '?').join(',')}) 
         AND dr.userId = ?
         AND dar.authorityCertificate IS NOT NULL AND dar.authorityCertificate != ''`,
        ...vesselIds,
        user.userId
      )

      for (const authReq of authorityRequests) {
        // Double-check that the authority request belongs to the current user
        if (authReq.userId === user.userId && vesselIds.includes(authReq.vesselId)) {
          if (authReq.authorityCertificate && authReq.authorityCertificate.trim() !== '' && authReq.authorityCertificate !== 'null') {
            // Check if document already exists
            const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
              `SELECT id FROM user_documents WHERE vesselId = ? AND documentUrl = ? LIMIT 1`,
              authReq.vesselId,
              authReq.authorityCertificate
            )

            if (existing.length === 0) {
              await prisma.$executeRawUnsafe(
                `INSERT INTO user_documents (id, vesselId, senderId, documentType, documentName, documentUrl, description, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                generateId(),
                authReq.vesselId,
                marinaId, // Sent by MARINA
                'Certificate',
                'Authority Certificate',
                authReq.authorityCertificate,
                'Authority certificate for drydock request'
              )
              syncedCount++
            }
          }
        }
      }
    }

    // 4. Sync bid certificates from drydock_bids (sent by SHIPYARD)
    // Only sync bids for requests created by the current user
    const bids = await prisma.$queryRawUnsafe<Array<{
      id: string
      drydockRequestId: string
      shipyardUserId: string
      vesselId: string
      bidCertificateUrl: string | null
    }>>(
      `SELECT db.id, db.drydockRequestId, db.shipyardUserId, dr.vesselId, db.bidCertificateUrl
       FROM drydock_bids db
       INNER JOIN drydock_requests dr ON db.drydockRequestId = dr.id
       WHERE dr.vesselId IN (${vesselIds.map(() => '?').join(',')})
       AND dr.userId = ?
       AND db.bidCertificateUrl IS NOT NULL AND db.bidCertificateUrl != ''`,
      ...vesselIds,
      user.userId
    )

    for (const bid of bids) {
      // Verify vessel belongs to user
      if (vesselIds.includes(bid.vesselId)) {
        // Only sync bid certificate - builder/repair/other certificates are shipyard credentials, not vessel documents
        const bidDocuments = [
          { url: bid.bidCertificateUrl, name: 'Bid Certificate', type: 'Certificate', description: 'Bid certificate from shipyard' }
        ]

        for (const doc of bidDocuments) {
          if (doc.url && doc.url.trim() !== '' && doc.url !== 'null') {
            // Check if document already exists
            const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
              `SELECT id FROM user_documents WHERE vesselId = ? AND documentUrl = ? LIMIT 1`,
              bid.vesselId,
              doc.url
            )

            if (existing.length === 0) {
              await prisma.$executeRawUnsafe(
                `INSERT INTO user_documents (id, vesselId, senderId, documentType, documentName, documentUrl, description, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                generateId(),
                bid.vesselId,
                bid.shipyardUserId, // Sent by SHIPYARD
                doc.type,
                doc.name,
                doc.url,
                doc.description
              )
              syncedCount++
            }
          }
        }
      }
    }

    // 5. Sync scope of work documents from drydock_requests (uploaded by shipowner)
    // Only sync requests created by the current user
    const drydockRequests = await prisma.$queryRawUnsafe<Array<{
      id: string
      vesselId: string
      userId: string
      scopeOfWorkUrl: string | null
    }>>(
      `SELECT id, vesselId, userId, scopeOfWorkUrl
       FROM drydock_requests
       WHERE vesselId IN (${vesselIds.map(() => '?').join(',')}) 
       AND userId = ?
       AND scopeOfWorkUrl IS NOT NULL AND scopeOfWorkUrl != ''`,
      ...vesselIds,
      user.userId
    )

    for (const req of drydockRequests) {
      if (req.scopeOfWorkUrl && req.scopeOfWorkUrl.trim() !== '' && req.scopeOfWorkUrl !== 'null') {
        // Check if document already exists
        const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT id FROM user_documents WHERE vesselId = ? AND documentUrl = ? LIMIT 1`,
          req.vesselId,
          req.scopeOfWorkUrl
        )

        if (existing.length === 0) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO user_documents (id, vesselId, senderId, documentType, documentName, documentUrl, description, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            generateId(),
            req.vesselId,
            req.userId, // Uploaded by shipowner
            'Plan',
            'Scope of Work',
            req.scopeOfWorkUrl,
            'Scope of work document for drydock request'
          )
          syncedCount++
        }
      }
    }

    // 6. Sync final scope of work from drydock_authority_requests (sent by MARINA)
    // Only sync authority requests for requests created by the current user
    if (marinaId) {
      const finalScopeRequests = await prisma.$queryRawUnsafe<Array<{
        id: string
        vesselId: string
        userId: string
        finalScopeOfWorkUrl: string | null
      }>>(
        `SELECT dar.id, dar.vesselId, dar.userId, dar.finalScopeOfWorkUrl
         FROM drydock_authority_requests dar
         INNER JOIN drydock_requests dr ON dar.drydockRequestId = dr.id
         WHERE dar.vesselId IN (${vesselIds.map(() => '?').join(',')}) 
         AND dr.userId = ?
         AND dar.finalScopeOfWorkUrl IS NOT NULL AND dar.finalScopeOfWorkUrl != ''`,
        ...vesselIds,
        user.userId
      )

      for (const authReq of finalScopeRequests) {
        // Double-check that the authority request belongs to the current user
        if (authReq.userId === user.userId && vesselIds.includes(authReq.vesselId)) {
          if (authReq.finalScopeOfWorkUrl && authReq.finalScopeOfWorkUrl.trim() !== '' && authReq.finalScopeOfWorkUrl !== 'null') {
            // Check if document already exists
            const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
              `SELECT id FROM user_documents WHERE vesselId = ? AND documentUrl = ? LIMIT 1`,
              authReq.vesselId,
              authReq.finalScopeOfWorkUrl
            )

            if (existing.length === 0) {
              await prisma.$executeRawUnsafe(
                `INSERT INTO user_documents (id, vesselId, senderId, documentType, documentName, documentUrl, description, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                generateId(),
                authReq.vesselId,
                marinaId, // Sent by MARINA
                'Plan',
                'Final Scope of Work',
                authReq.finalScopeOfWorkUrl,
                'Final scope of work document from authority request'
              )
              syncedCount++
            }
          }
        }
      }
    }

    // 7. Sync progress images from drydock_progress (sent by SHIPYARD during operations)
    // Only sync progress for requests created by the current user
    const progressRecords = await prisma.$queryRawUnsafe<Array<{
      id: string
      drydockServiceId: string
      imageUrl: string | null
      updatedBy: string
      vesselId: string
    }>>(
      `SELECT dp.id, dp.drydockServiceId, dp.imageUrl, dp.updatedBy, dr.vesselId
       FROM drydock_progress dp
       INNER JOIN drydock_services ds ON dp.drydockServiceId = ds.id
       INNER JOIN drydock_bookings db ON ds.drydockBookingId = db.id
       INNER JOIN drydock_requests dr ON db.drydockRequestId = dr.id
       WHERE dr.vesselId IN (${vesselIds.map(() => '?').join(',')}) 
       AND dr.userId = ?
       AND dp.imageUrl IS NOT NULL AND dp.imageUrl != ''`,
      ...vesselIds,
      user.userId
    )

    for (const progress of progressRecords) {
      // Verify vessel belongs to user
      if (vesselIds.includes(progress.vesselId)) {
        if (progress.imageUrl && progress.imageUrl.trim() !== '' && progress.imageUrl !== 'null') {
          // Check if document already exists
          const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
            `SELECT id FROM user_documents WHERE vesselId = ? AND documentUrl = ? LIMIT 1`,
            progress.vesselId,
            progress.imageUrl
          )

          if (existing.length === 0) {
            await prisma.$executeRawUnsafe(
              `INSERT INTO user_documents (id, vesselId, senderId, documentType, documentName, documentUrl, description, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
              generateId(),
              progress.vesselId,
              progress.updatedBy, // Sent by the user who updated (usually shipyard)
              'Report',
              'Progress Image',
              progress.imageUrl,
              'Progress image from drydock operation'
            )
            syncedCount++
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${syncedCount} documents`,
      synced: syncedCount
    })
  } catch (error) {
    console.error('Error syncing vessel documents:', error)
    return NextResponse.json(
      { error: 'Failed to sync documents', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

