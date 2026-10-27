import { NextRequest, NextResponse } from 'next/server';
import { searchDocs } from '@/lib/docs/api';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const category = searchParams.get('category') || undefined;

  const results = searchDocs(query, category);

  return NextResponse.json({
    query,
    count: results.length,
    results,
  });
}
