import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

// Get region from environment or extract from URL
const getRegionFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url)
    // Extract region from hostname like: bucket.s3.ap-southeast-1.amazonaws.com
    const match = urlObj.hostname.match(/\.s3\.([^.]+)\.amazonaws\.com/)
    if (match && match[1]) {
      return match[1]
    }
  } catch (e) {
    // Ignore parsing errors
  }
  return process.env.AWS_REGION || 'ap-southeast-2'
}

const createS3Client = (region: string) => {
  return new S3Client({
    region: region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const pdfUrl = searchParams.get('url')

    if (!pdfUrl) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
    }

    // Extract bucket and key from S3 URL
    let bucket: string = ''
    let key: string = ''

    try {
      const url = new URL(pdfUrl)
      
      // Check if it's virtual-hosted style (bucket.s3.region.amazonaws.com)
      if (url.hostname.includes('.s3.') || url.hostname.includes('.s3-')) {
        // Extract bucket from hostname (everything before .s3.)
        const parts = url.hostname.split('.s3')
        bucket = parts[0]
        // Key is the pathname without leading slash
        key = url.pathname.substring(1)
        // Clean the key: decode URL encoding
        key = decodeURIComponent(key).replace(/\\+$/, '').replace(/\/+$/, '')
      } else {
        // Path-style URL (s3.region.amazonaws.com/bucket/key)
        const pathParts = url.pathname.substring(1).split('/')
        bucket = pathParts[0]
        key = pathParts.slice(1).join('/')
        // Clean the key: decode URL encoding
        key = decodeURIComponent(key).replace(/\\+$/, '').replace(/\/+$/, '')
      }

      // Fallback to environment variable if bucket extraction fails
      if (!bucket || bucket.length === 0) {
        bucket = process.env.AWS_S3_BUCKET || ''
      }

      if (!bucket || !key) {
        return NextResponse.json(
          { error: 'Could not extract bucket or key from URL' },
          { status: 400 }
        )
      }
    } catch (parseError) {
      console.error('Error parsing PDF URL:', parseError, 'URL:', pdfUrl)
      return NextResponse.json(
        { error: 'Invalid PDF URL format' },
        { status: 400 }
      )
    }

    // Get region from URL
    const region = getRegionFromUrl(pdfUrl)
    const s3Client = createS3Client(region)

    // Fetch the PDF from S3
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })

    try {
      const response = await s3Client.send(command)
      
      // Get the content type from S3 response or default to PDF
      const contentType = response.ContentType || 'application/pdf'
      
      // Convert the stream to a buffer
      const chunks: Uint8Array[] = []
      if (response.Body) {
        const bodyStream = response.Body as ReadableStream<Uint8Array>
        const reader = bodyStream.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) chunks.push(value)
        }
      }
      
      const buffer = Buffer.concat(chunks)

      // Return the PDF with proper headers
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="certificate.pdf"`,
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
        },
      })
    } catch (s3Error) {
      console.error('Error fetching PDF from S3:', s3Error)
      return NextResponse.json(
        { error: 'Failed to fetch PDF from S3' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in proxy-pdf route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}