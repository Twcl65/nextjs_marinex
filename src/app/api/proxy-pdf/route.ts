import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  if (!url) {
    return new NextResponse('URL is required', { status: 400 });
  }

  try {
    const signedUrlResponse = await fetch(`${req.nextUrl.origin}/api/signed-url?url=${encodeURIComponent(url)}`);

    if (!signedUrlResponse.ok) {
      const errorData = await signedUrlResponse.json();
      return new NextResponse(errorData.error || 'Failed to get signed URL', { status: signedUrlResponse.status });
    }

    const { signedUrl } = await signedUrlResponse.json();

    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error('Error proxying PDF:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}