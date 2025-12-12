import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      // If you later support file uploads directly, parse formData here
      const formData = await req.formData()
      const json: Record<string, string> = {}
      for (const [key, value] of formData.entries()) {
        if (typeof value === 'string') json[key] = value
      }
      return await handleCreate(json)
    } else {
      const body = await req.json()
      return await handleCreate(body)
    }
  } catch (err: unknown) {
    console.error('Register error', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, logoUrl, certificateBuilder, certificateRepair, certificateOther } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const updated = await prisma.user.update({
      where: { id },
      data: {
        logoUrl: logoUrl ?? undefined,
        certificateBuilder: certificateBuilder ?? undefined,
        certificateRepair: certificateRepair ?? undefined,
        certificateOther: certificateOther ?? undefined,
      },
      select: { id: true, logoUrl: true, certificateBuilder: true, certificateRepair: true, certificateOther: true },
    })
    return NextResponse.json({ user: updated })
  } catch (e: unknown) {
    console.error('Register PATCH error', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

async function handleCreate(body: Record<string, unknown>) {
  console.log('[API /register] incoming body:', body)
  console.log('[API /register] certificate fields:', {
    certificateBuilder: body.certificateBuilder,
    certificateRepair: body.certificateRepair,
    certificateOther: body.certificateOther
  })
  const {
    email,
    password,
    role,
    fullName,
    shipyardName,
    contactNumber,
    officeAddress,
    businessRegistrationNumber,
    vesselInfo,
    dockingServices,
    dryDockAvailability,
    contactPerson,
    logoUrl,
    certificateBuilder,
    certificateRepair,
    certificateOther,
  } = body

  // Type validation and conversion
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }
  if (!password || typeof password !== 'string') {
    return NextResponse.json({ error: 'Valid password is required' }, { status: 400 })
  }
  if (!role || typeof role !== 'string' || !['SHIPOWNER', 'SHIPYARD', 'MARINA'].includes(role)) {
    return NextResponse.json({ error: 'Valid role (SHIPOWNER, SHIPYARD, or MARINA) is required' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const created = await prisma.user.create({
    data: {
      // base
      email: email as string,
      passwordHash,
      role: role as 'SHIPOWNER' | 'SHIPYARD' | 'MARINA',
      status: 'INACTIVE',
      fullName: fullName && typeof fullName === 'string' ? fullName : null,
      shipyardName: shipyardName && typeof shipyardName === 'string' ? shipyardName : null,
      contactNumber: contactNumber && typeof contactNumber === 'string' ? contactNumber : null,
      officeAddress: officeAddress && typeof officeAddress === 'string' ? officeAddress : null,
      businessRegNumber: businessRegistrationNumber && typeof businessRegistrationNumber === 'string' ? businessRegistrationNumber : null,
      shipownerVesselInfo: vesselInfo && typeof vesselInfo === 'object' && vesselInfo !== null ? vesselInfo : undefined,
      // Keep optional JSON, but we will normalize services below
      shipyardServices: dockingServices && typeof dockingServices === 'object' && dockingServices !== null ? dockingServices : undefined,
      shipyardDryDock: dryDockAvailability && typeof dryDockAvailability === 'string' ? dryDockAvailability : null,
      contactPerson: contactPerson && typeof contactPerson === 'string' ? contactPerson : null,
      logoUrl: logoUrl && typeof logoUrl === 'string' ? logoUrl : null,
      certificateBuilder: certificateBuilder && typeof certificateBuilder === 'string' ? certificateBuilder : null,
      certificateRepair: certificateRepair && typeof certificateRepair === 'string' ? certificateRepair : null,
      certificateOther: certificateOther && typeof certificateOther === 'string' ? certificateOther : null,
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
    },
  })
  console.log('[API /register] created register id:', created.id)

  // If shipyard and services provided, create rows in RegisterService
  if (role === 'SHIPYARD' && Array.isArray(dockingServices)) {
    const prepared = dockingServices
      .filter((s: unknown): s is Record<string, unknown> => Boolean(s) && typeof s === 'object' && s !== null && 'name' in s && String((s as Record<string, unknown>).name).trim().length > 0)
      .map((s: Record<string, unknown>) => ({
        userId: created.id,
        name: String(s.name),
        squareMeters: parseInt(String(s.squareMeters || '0'), 10) || 0,
        hours: parseInt(String(s.hours || '0'), 10) || 0,
        workers: parseInt(String(s.workers || '0'), 10) || 0,
        days: parseInt(String(s.days || '0'), 10) || 0,
        price: String(s.price || ''),
      }))

    if (prepared.length > 0) {
      await prisma.userService.createMany({ data: prepared })
      console.log('[API /register] services created:', prepared.length)
    }
  }

  // Send registration pending email
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000'
  try {
    await fetch(`${baseUrl}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: created.email,
        subject: 'Registration received - pending approval',
        message:
          'Your registration was received. Our team is reviewing your details and will notify you once approved.',
        userType: created.role,
        userName:
          (fullName && typeof fullName === 'string' && fullName) ||
          (shipyardName && typeof shipyardName === 'string' && shipyardName) ||
          created.email,
        emailType: 'REGISTRATION_PENDING',
      }),
    })
  } catch (emailErr) {
    console.error('[API /register] failed to send pending email', emailErr)
    // Do not block registration on email failure
  }

  return NextResponse.json({ user: created }, { status: 201 })
}


