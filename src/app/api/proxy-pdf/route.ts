import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Get region from environment or extract from URL
const getRegionFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url)
    const match = urlObj.hostname.match(/\.s3\.([^.]+)\.amazonaws\.com/)
    if (match && match[1]) {
      return match[1]
    }
  } catch (e) {
    // Ignore parsing errors
  }
  return process.env.AWS_REGION || 'ap-southeast-1'
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

const extractBucketAndKey = (s3Url: string): { bucket: string; key: string } | null => {
  try {
    const url = new URL(s3Url)
    
    // Virtual-hosted style (bucket.s3.region.amazonaws.com)
    if (url.hostname.includes('.s3.') || url.hostname.includes('.s3-')) {
      const parts = url.hostname.split('.s3')
      const bucket = parts[0]
      let key = url.pathname.substring(1)
      key = decodeURIComponent(key).replace(/\\+$/, '').replace(/\/+$/, '')
      return { bucket, key }
    }
    
    // Path-style URL (s3.region.amazonaws.com/bucket/key)
    const pathParts = url.pathname.substring(1).split('/')
    if (pathParts.length >= 2) {
      const bucket = pathParts[0]
      const key = decodeURIComponent(pathParts.slice(1).join('/')).replace(/\\+$/, '').replace(/\/+$/, '')
      return { bucket, key }
    }
  } catch (e) {
    console.error('[proxy-pdf] Error parsing S3 URL:', e)
  }
  return null
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    let pdfUrl = searchParams.get('url')
    
    if (!pdfUrl) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
    }

    console.log('[proxy-pdf] Processing URL:', pdfUrl)

    // If it's an S3 URL, fetch directly using S3 SDK to avoid CORS
    if (pdfUrl.includes('s3.amazonaws.com') || pdfUrl.includes('amazonaws.com')) {
      const bucketKey = extractBucketAndKey(pdfUrl)
      
      if (bucketKey) {
        try {
          const region = getRegionFromUrl(pdfUrl)
          const s3Client = createS3Client(region)
          
          const command = new GetObjectCommand({
            Bucket: bucketKey.bucket,
            Key: bucketKey.key,
          })
          
          // Get the object directly from S3
          const s3Response = await s3Client.send(command)
          
          if (!s3Response.Body) {
            return NextResponse.json({ error: 'No content in S3 object' }, { status: 404 })
          }
          
          // Convert stream to buffer
          const chunks: Uint8Array[] = []
          const reader = s3Response.Body.transformToWebStream().getReader()
          
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value)
          }
          
          // Combine chunks into single buffer
          const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
          const pdfBuffer = new Uint8Array(totalLength)
          let offset = 0
          for (const chunk of chunks) {
            pdfBuffer.set(chunk, offset)
            offset += chunk.length
          }
          
          // Return the PDF with proper headers
          return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
              'Content-Type': s3Response.ContentType || 'application/pdf',
              'Content-Disposition': `inline; filename="bid-document.pdf"`,
              'Cache-Control': 'public, max-age=3600',
            },
          })
        } catch (s3Error) {
          console.error('[proxy-pdf] Error fetching from S3:', s3Error)
          return NextResponse.json(
            { error: `Failed to fetch PDF from S3: ${s3Error instanceof Error ? s3Error.message : 'Unknown error'}` },
            { status: 500 }
          )
        }
      }
    }

    // For non-S3 URLs or if S3 extraction failed, try direct fetch
    try {
      const response = await fetch(pdfUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/pdf',
        },
      })

      if (!response.ok) {
        console.error('[proxy-pdf] Failed to fetch PDF:', response.status, response.statusText)
        return NextResponse.json(
          { error: `Failed to fetch PDF: ${response.statusText}` },
          { status: response.status }
        )
      }

      const pdfBlob = await response.blob()
      const pdfBuffer = await pdfBlob.arrayBuffer()

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline; filename="bid-document.pdf"',
          'Cache-Control': 'public, max-age=3600',
        },
      })
    } catch (fetchError) {
      console.error('[proxy-pdf] Error fetching PDF:', fetchError)
      return NextResponse.json(
        { error: `Failed to fetch PDF: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}` },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[proxy-pdf] Error in proxy route:', error)
    return NextResponse.json(
      { error: `Proxy error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

