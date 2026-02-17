import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

    // First get the article by slug to get its ID
    const articleResponse = await fetch(`${backendUrl}/knowledge-base/${slug}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!articleResponse.ok) {
      return NextResponse.json({ message: 'Makale bulunamadı' }, { status: 404 });
    }

    const articleData = await articleResponse.json();
    const articleId = articleData.article?.id || articleData.id;

    // Now submit feedback using the article ID
    const response = await fetch(`${backendUrl}/knowledge-base/${articleId}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Feedback submission error:', error);
    return NextResponse.json({ message: 'Geri bildirim gönderilemedi' }, { status: 500 });
  }
}
