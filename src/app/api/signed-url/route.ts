import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const s3Url = searchParams.get('url')
    
    if (!s3Url) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
    }

    console.log('[signed-url] Processing URL:', s3Url)

    // Extract bucket and key from S3 URL
    // Format: https://bucket-name.s3.region.amazonaws.com/key/path
    // Or: https://s3.region.amazonaws.com/bucket-name/key/path (path-style)
    let bucket: string = ''
    let key: string = ''

    try {
      const url = new URL(s3Url)
      console.log('[signed-url] Parsed URL - hostname:', url.hostname, 'pathname:', url.pathname)
      
      // Check if it's virtual-hosted style (bucket.s3.region.amazonaws.com)
      if (url.hostname.includes('.s3.') || url.hostname.includes('.s3-')) {
        // Extract bucket from hostname (everything before .s3.)
        const parts = url.hostname.split('.s3')
        bucket = parts[0]
        // Key is the pathname without leading slash
        key = url.pathname.substring(1)
        // Clean the key: decode URL encoding and remove any trailing backslashes
        key = decodeURIComponent(key).replace(/\\+$/, '').replace(/\/+$/, '')
        console.log('[signed-url] Virtual-hosted style - bucket:', bucket, 'key:', key)
      } else {
        // Path-style URL (s3.region.amazonaws.com/bucket/key)
        const pathParts = url.pathname.substring(1).split('/')
        bucket = pathParts[0]
        key = pathParts.slice(1).join('/')
        // Clean the key: decode URL encoding and remove any trailing backslashes
        key = decodeURIComponent(key).replace(/\\+$/, '').replace(/\/+$/, '')
        console.log('[signed-url] Path-style - bucket:', bucket, 'key:', key)
      }

      // Fallback to environment variable if bucket extraction fails
      if (!bucket || bucket.length === 0) {
        bucket = process.env.AWS_S3_BUCKET || ''
        console.log('[signed-url] Using fallback bucket from env:', bucket)
      }

      if (!bucket || !key) {
        console.error('[signed-url] Missing bucket or key - bucket:', bucket, 'key:', key)
        return NextResponse.json(
          { error: `Could not extract bucket or key from URL. Bucket: ${bucket || 'empty'}, Key: ${key || 'empty'}` },
          { status: 400 }
        )
      }

      // Determine region from URL or use default
      const region = getRegionFromUrl(s3Url)
      console.log('[signed-url] Using region:', region, 'bucket:', bucket, 'key:', key)
      
      const s3Client = createS3Client(region)

      // Create signed URL
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })

      console.log('[signed-url] Generating signed URL for bucket:', bucket, 'key:', key, 'region:', region)
      console.log('[signed-url] Command details:', JSON.stringify({ Bucket: bucket, Key: key }))
      
      try {
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }) // 1 hour
        console.log('[signed-url] Successfully generated signed URL')
        console.log('[signed-url] Signed URL length:', signedUrl.length)
        console.log('[signed-url] Signed URL preview (first 200 chars):', signedUrl.substring(0, 200))
        console.log('[signed-url] Has query params:', signedUrl.includes('?'))
        
        if (!signedUrl.includes('?X-Amz-')) {
          console.error('[signed-url] WARNING: Generated URL does not appear to be signed!')
          console.error('[signed-url] This should not happen - getSignedUrl should always return a signed URL')
        }

        return NextResponse.json({ signedUrl })
      } catch (signError) {
        console.error('[signed-url] Error during getSignedUrl:', signError)
        console.error('[signed-url] Error details:', signError instanceof Error ? signError.message : String(signError))
        throw signError
      }
    } catch (parseError) {
      console.error('[signed-url] Error parsing S3 URL:', parseError, 'URL:', s3Url)
      return NextResponse.json(
        { error: `Invalid S3 URL format: ${parseError instanceof Error ? parseError.message : 'Unknown error'}` },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[signed-url] Error generating signed URL:', error)
    return NextResponse.json({ 
      error: `Failed to generate signed URL: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 })
  }
}
