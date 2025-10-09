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
    const { fileType, prefix } = await req.json()
    if (!fileType) return NextResponse.json({ error: 'fileType required' }, { status: 400 })
    if (!region || !bucket) return NextResponse.json({ error: 'S3 not configured' }, { status: 500 })

    const key = `${prefix || 'uploads'}/${Date.now()}-${nanoid(8)}`

    const cmd = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: fileType,
    })

    const url = await getSignedUrl(s3, cmd, { expiresIn: 60 * 5 })
    const publicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`
    return NextResponse.json({ url, key, publicUrl })
  } catch (e: unknown) {
    console.error('presign error', e)
    return NextResponse.json({ error: 'Failed to presign' }, { status: 500 })
  }
}


