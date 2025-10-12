import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    console.log('Fetching ALL drydock requests for marina authority...')
    
    // Fetch all drydock requests for marina authority view
    const drydockRequests = await prisma.$queryRaw`
      SELECT 
        dr.id,
        dr.userId,
        dr.vesselId,
        dr.companyName,
        dr.companyLogoUrl,
        dr.vesselName,
        dr.imoNumber,
        dr.flag,
        dr.shipType,
        dr.vesselImageUrl,
        dr.priorityLevel,
        dr.servicesNeeded,
        dr.scopeOfWorkUrl,
        dr.status,
        dr.createdAt,
        dr.updatedAt,
        sv.lengthOverall,
        sv.grossTonnage,
        u.officeAddress as companyLocation
      FROM drydock_requests dr
      LEFT JOIN ship_vessels sv ON dr.vesselId = sv.id
      LEFT JOIN users u ON dr.userId = u.id
      ORDER BY dr.createdAt DESC
    `

    console.log(`Found ${Array.isArray(drydockRequests) ? drydockRequests.length : 0} drydock requests`)
    console.log('Raw drydock requests:', drydockRequests)
    
    // Debug services data specifically
    if (Array.isArray(drydockRequests)) {
        drydockRequests.forEach((request: { servicesNeeded: string }, index: number) => {
            console.log(`Request ${index + 1} servicesNeeded:`, request.servicesNeeded);
            console.log(`Request ${index + 1} servicesNeeded type:`, typeof request.servicesNeeded);
            
            // Try to parse and show structure if it's a string
            if (typeof request.servicesNeeded === 'string') {
                try {
                    const parsed = JSON.parse(request.servicesNeeded);
                    console.log(`Request ${index + 1} parsed services:`, parsed);
                    if (Array.isArray(parsed)) {
                        parsed.forEach((service: { name: string; area: string }, serviceIndex: number) => {
                            console.log(`  Service ${serviceIndex + 1}:`, service);
                            console.log(`  Service ${serviceIndex + 1} has name:`, service.name);
                            console.log(`  Service ${serviceIndex + 1} has area:`, service.area);
                        });
                    }
                } catch (error) {
                    console.log(`Request ${index + 1} services parsing error:`, error);
                }
            }
        });
    }

    // Transform the data to match the expected format
    const transformedRequests = Array.isArray(drydockRequests) ? drydockRequests.map((request: {
      id: string;
      vesselId: string;
      servicesNeeded: string;
      priorityLevel: string;
      scopeOfWorkUrl: string;
      status: string;
      createdAt: string;
      vesselName: string;
      imoNumber: string;
      shipType: string;
      flag: string;
      lengthOverall: number | null;
      grossTonnage: number | null;
      vesselImageUrl: string;
      companyLogoUrl: string;
      companyName: string;
      companyLocation: string;
    }) => ({
      id: request.id,
      vessel_id: request.vesselId,
      services_needed: request.servicesNeeded,
      priority_level: request.priorityLevel,
      scope_of_work: request.scopeOfWorkUrl,
      status: request.status,
      request_date: new Date(request.createdAt).toISOString().split('T')[0],
      created_at: new Date(request.createdAt).toISOString(),
      vessel: {
        id: request.vesselId,
        name: request.vesselName,
        imo_number: request.imoNumber,
        ship_type: request.shipType,
        flag: request.flag,
        length_overall: request.lengthOverall || null,
        gross_tonnage: request.grossTonnage || null,
        picture: request.vesselImageUrl
      },
      company_logo: request.companyLogoUrl,
      company_name: request.companyName,
      company_location: request.companyLocation
    })) : []

    console.log('Transformed requests:', transformedRequests.length)

    return NextResponse.json({ drydockRequests: transformedRequests }, { status: 200 })
  } catch (error) {
    console.error('Error fetching drydock requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch drydock requests' },
      { status: 500 }
    )
  }
}
