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

    if (user.role !== 'SHIPYARD') {
      return NextResponse.json(
        { error: 'Forbidden - Shipyard access only' },
        { status: 403 }
      )
    }

    // Get all certificates issued by this shipyard
    // We need to join with bookings to get the shipyardUserId
    const certificates = await prisma.$queryRawUnsafe<Array<{
      id: string
      drydockBookingId: string
      vesselId: string
      userId: string
      certificateName: string
      certificateType: string
      certificateUrl: string | null
      issuedDate: Date
      createdAt: Date
      updatedAt: Date
      vesselName: string
      imoNumber: string
      companyName: string
      companyLogoUrl: string | null
    }>>(
      `SELECT 
        dic.id,
        dic.drydockBookingId,
        dic.vesselId,
        dic.userId,
        dic.certificateName,
        dic.certificateType,
        dic.certificateUrl,
        dic.issuedDate,
        dic.createdAt,
        dic.updatedAt,
        dr.vesselName,
        dr.imoNumber,
        dr.companyName,
        dr.companyLogoUrl
      FROM drydock_issued_certificates dic
      INNER JOIN drydock_bookings db ON dic.drydockBookingId = db.id
      INNER JOIN drydock_requests dr ON db.drydockRequestId = dr.id
      WHERE db.shipyardUserId = ?
      ORDER BY dic.issuedDate DESC`,
      user.userId
    )

    const formattedCertificates = certificates.map(cert => ({
        ...cert,
        issuedDate: cert.issuedDate instanceof Date ? cert.issuedDate.toISOString() : new Date(cert.issuedDate).toISOString(),
        createdAt: cert.createdAt instanceof Date ? cert.createdAt.toISOString() : new Date(cert.createdAt).toISOString(),
        updatedAt: cert.updatedAt instanceof Date ? cert.updatedAt.toISOString() : new Date(cert.updatedAt).toISOString(),
        companyLogoUrl: cert.companyLogoUrl
      }))

    const initialScopes = await prisma.$queryRawUnsafe<Array<{
      drydockBookingId: string
      drydockRequestId: string
      vesselId: string
      scopeOfWorkUrl: string | null
      createdAt: Date
      updatedAt: Date
      vesselName: string
      imoNumber: string
      companyName: string
      companyLogoUrl: string | null
    }>>(
      `SELECT 
        db.id AS drydockBookingId,
        dr.id AS drydockRequestId,
        dr.vesselId,
        dr.scopeOfWorkUrl,
        dr.createdAt,
        dr.updatedAt,
        dr.vesselName,
        dr.imoNumber,
        dr.companyName,
        dr.companyLogoUrl
      FROM drydock_requests dr
      INNER JOIN drydock_bookings db ON db.drydockRequestId = dr.id
      WHERE db.shipyardUserId = ? AND dr.scopeOfWorkUrl IS NOT NULL`,
      user.userId
    )

    initialScopes.forEach(scope => {
      if (!scope.scopeOfWorkUrl) return
      formattedCertificates.push({
        id: `initial-scope-${scope.drydockRequestId}`,
        drydockBookingId: scope.drydockBookingId,
        vesselId: scope.vesselId,
        userId: user.userId,
        certificateName: "Initial Scope of Work",
        certificateType: "Scope",
        certificateUrl: scope.scopeOfWorkUrl,
        issuedDate: (scope.updatedAt || scope.createdAt).toISOString(),
        createdAt: scope.createdAt.toISOString(),
        updatedAt: scope.updatedAt.toISOString(),
        vesselName: scope.vesselName,
        imoNumber: scope.imoNumber,
        companyName: scope.companyName,
        companyLogoUrl: scope.companyLogoUrl
      })
    })

    const finalScopes = await prisma.$queryRawUnsafe<Array<{
      authorityRequestId: string
      drydockBookingId: string
      vesselId: string
      finalScopeOfWorkUrl: string | null
      updatedAt: Date
      createdAt: Date
      vesselName: string
      imoNumber: string
      companyName: string
      companyLogoUrl: string | null
    }>>(
      `SELECT 
        dar.id AS authorityRequestId,
        db.id AS drydockBookingId,
        dar.vesselId,
        dar.finalScopeOfWorkUrl,
        dar.updatedAt,
        dar.createdAt,
        dr.vesselName,
        dr.imoNumber,
        dr.companyName,
        dr.companyLogoUrl
      FROM drydock_authority_requests dar
      INNER JOIN drydock_bookings db ON dar.drydockBookingId = db.id
      INNER JOIN drydock_requests dr ON dar.drydockRequestId = dr.id
      WHERE db.shipyardUserId = ? AND dar.finalScopeOfWorkUrl IS NOT NULL
      ORDER BY dar.updatedAt DESC`,
      user.userId
    )

    const latestFinalScopeByVessel = new Map<string, typeof finalScopes[number]>()
    finalScopes.forEach(scope => {
      if (!scope.finalScopeOfWorkUrl) return
      if (!latestFinalScopeByVessel.has(scope.vesselId)) {
        latestFinalScopeByVessel.set(scope.vesselId, scope)
      }
    })

    latestFinalScopeByVessel.forEach(scope => {
      formattedCertificates.push({
        id: `final-scope-${scope.authorityRequestId}`,
        drydockBookingId: scope.drydockBookingId,
        vesselId: scope.vesselId,
        userId: user.userId,
        certificateName: "Final Scope of Work",
        certificateType: "Scope",
        certificateUrl: scope.finalScopeOfWorkUrl,
        issuedDate: scope.updatedAt.toISOString(),
        createdAt: scope.createdAt.toISOString(),
        updatedAt: scope.updatedAt.toISOString(),
        vesselName: scope.vesselName,
        imoNumber: scope.imoNumber,
        companyName: scope.companyName,
        companyLogoUrl: scope.companyLogoUrl
      })
    })

    // Fetch authority certificates from drydock_authority_requests
    const authorityCertificates = await prisma.$queryRawUnsafe<Array<{
      authorityRequestId: string
      drydockBookingId: string
      vesselId: string
      authorityCertificate: string | null
      issuedDate: Date
      updatedAt: Date
      createdAt: Date
      vesselName: string
      imoNumber: string
      companyName: string
      companyLogoUrl: string | null
    }>>(
      `SELECT 
        dar.id AS authorityRequestId,
        db.id AS drydockBookingId,
        dar.vesselId,
        dar.authorityCertificate,
        dar.updatedAt AS issuedDate,
        dar.updatedAt,
        dar.createdAt,
        dr.vesselName,
        dr.imoNumber,
        dr.companyName,
        dr.companyLogoUrl
      FROM drydock_authority_requests dar
      INNER JOIN drydock_bookings db ON dar.drydockBookingId = db.id
      INNER JOIN drydock_requests dr ON dar.drydockRequestId = dr.id
      WHERE db.shipyardUserId = ? AND dar.authorityCertificate IS NOT NULL AND dar.authorityCertificate != ''
      ORDER BY dar.updatedAt DESC`,
      user.userId
    )

    authorityCertificates.forEach(cert => {
      if (!cert.authorityCertificate) return
      formattedCertificates.push({
        id: `authority-cert-${cert.authorityRequestId}`,
        drydockBookingId: cert.drydockBookingId,
        vesselId: cert.vesselId,
        userId: user.userId,
        certificateName: "Authority Certificate",
        certificateType: "AUTHORITY_CERTIFICATE",
        certificateUrl: cert.authorityCertificate,
        issuedDate: cert.issuedDate.toISOString(),
        createdAt: cert.createdAt.toISOString(),
        updatedAt: cert.updatedAt.toISOString(),
        vesselName: cert.vesselName,
        imoNumber: cert.imoNumber,
        companyName: cert.companyName,
        companyLogoUrl: cert.companyLogoUrl
      })
    })

    formattedCertificates.sort((a, b) => {
      return new Date(b.issuedDate).getTime() - new Date(a.issuedDate).getTime()
    })

    return NextResponse.json({
      success: true,
      data: formattedCertificates
    })
  } catch (error) {
    console.error('Error fetching issued certificates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch certificates' },
      { status: 500 }
    )
  }
}

