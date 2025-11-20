import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { nanoid } from 'nanoid'

const region = process.env.AWS_REGION as string
const bucket = process.env.AWS_S3_BUCKET as string

const s3 = new S3Client({ region, credentials: {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
}})

export async function POST(req: NextRequest) {
  try {
    const { fileType, prefix, fileName } = await req.json()
    if (!fileType) return NextResponse.json({ error: 'fileType required' }, { status: 400 })
    if (!region || !bucket) return NextResponse.json({ error: 'S3 not configured' }, { status: 500 })

    // Extract file extension from fileName if provided, otherwise try to infer from fileType
    let fileExtension = ''
    if (fileName) {
      const parts = fileName.split('.')
      if (parts.length > 1) {
        fileExtension = '.' + parts[parts.length - 1]
      }
    } else if (fileType) {
      // Try to infer extension from MIME type
      const mimeToExt: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'application/pdf': '.pdf',
        'application/msword': '.doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        'application/vnd.ms-excel': '.xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      }
      fileExtension = mimeToExt[fileType] || ''
    }

    const key = `${prefix || 'uploads'}/${Date.now()}-${nanoid(8)}${fileExtension}`

    // Build PutObjectCommand
    // Note: ACL 'public-read' is removed as it may cause 400 errors if bucket has ACLs disabled
    // If bucket policy is set to make objects public, ACL is not needed
    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: fileType,
      // ACL removed - rely on bucket policy for public access if needed
    })

    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 * 5 })
    const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`
    return NextResponse.json({ url, key, publicUrl })
  } catch (e: unknown) {
    console.error('presign error', e)
    return NextResponse.json({ error: 'Failed to presign' }, { status: 500 })
  }
}


