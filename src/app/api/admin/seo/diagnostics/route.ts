import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { requireAuthenticatedUser } from '@/lib/billing/guards';
import { isUserBillingAdmin } from '@/lib/billing/admin';
import { supabase } from '@/lib/db';
import { BASE_URL } from '@/lib/seo/metadata';

// Note: To avoid heavy loads on Vercel or timeouts, we will limit the pages we scan.
// In a true enterprise environment, this would be a background queue.
const PAGES_TO_SCAN = [
  '/',
  '/blog',
  '/templates',
  '/tools',
  '/directory',
  '/how-to-play'
];

export async function GET() {
  try {
    const user = await requireAuthenticatedUser();
    if (!isUserBillingAdmin(user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const results = [];
    
    // 1. Scan predefined critical pages by fetching their HTML locally
    for (const path of PAGES_TO_SCAN) {
      try {
        const url = `${BASE_URL}${path}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
          results.push({ path, status: 'error', code: res.status });
          continue;
        }

        const html = await res.text();
        const $ = cheerio.load(html);

        const title = $('title').text();
        const description = $('meta[name="description"]').attr('content');
        const canonical = $('link[rel="canonical"]').attr('href');
        const h1Count = $('h1').length;
        
        results.push({
          path,
          status: 'ok',
          title: title || null,
          hasDescription: !!description,
          hasCanonical: !!canonical,
          h1Count,
          isDuplicateMetadata: false // Placeholder for advanced checking
        });
      } catch (err) {
        results.push({ path, status: 'fetch_failed' });
      }
    }

    // 2. Query the DB to find public leaderboards
    let publicLeaderboardsCount = 0;
    if (supabase) {
      const { count } = await supabase
        .from('leaderboards')
        .select('*', { count: 'exact', head: true })
        .eq('visibility', 'public');
      
      publicLeaderboardsCount = count || 0;
    }

    return NextResponse.json({
      success: true,
      scannedPages: results,
      publicLeaderboardsCount
    });

  } catch (error: any) {
    console.error('SEO Diagnostic Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
