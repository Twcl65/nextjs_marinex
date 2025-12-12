import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const certificateUrl = searchParams.get('url')

    if (!certificateUrl) {
      return NextResponse.json(
        { error: 'Certificate URL is required' },
        { status: 400 }
      )
    }

    // Extract bucket and key from S3 URL
    // Format: https://bucket-name.s3.region.amazonaws.com/key/path
    let bucket: string
    let key: string

    try {
      const url = new URL(certificateUrl)
      
      // Check if it's virtual-hosted style (bucket.s3.region.amazonaws.com)
      if (url.hostname.includes('.s3.') || url.hostname.includes('.s3-')) {
        // Extract bucket from hostname (everything before .s3.)
        const parts = url.hostname.split('.s3')
        bucket = parts[0]
        // Key is the pathname without leading slash
        key = url.pathname.substring(1)
      } else {
        // Path-style URL (s3.region.amazonaws.com/bucket/key)
        const pathParts = url.pathname.substring(1).split('/')
        bucket = pathParts[0]
        key = pathParts.slice(1).join('/')
      }

      // Clean up key: decode, strip query fragments accidentally embedded in path
      key = decodeURIComponent(key)
      if (key.includes('?')) {
        key = key.split('?')[0]
      }
      key = key.replace(/^\/+/, '').replace(/\/+$/, '')

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
      console.error('Error parsing certificate URL:', parseError, 'URL:', certificateUrl)
      return NextResponse.json(
        { error: 'Invalid certificate URL format' },
        { status: 400 }
      )
    }

    const bucketName = bucket
    if (!bucketName) {
      return NextResponse.json(
        { error: 'S3 bucket configuration error' },
        { status: 500 }
      )
    }

    // Create a signed URL for the certificate
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    })

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }) // 1 hour expiry

    // Return JSON so the frontend can open it explicitly
    return NextResponse.json({ signedUrl })

  } catch (error) {
    console.error('Error generating signed URL:', error)
    return NextResponse.json(
      { error: 'Failed to generate signed URL' },
      { status: 500 }
    )
  }
}
