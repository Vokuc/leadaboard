import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, title, message, action_url } = body;

    if (!to || !title || !message) {
      return NextResponse.json({ error: 'Missing required email fields (to, title, message)' }, { status: 400 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json({ skipped: true, reason: 'RESEND_API_KEY not configured' });
    }

    const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'notifications@leaderboardos.com';
    const fromName = process.env.EMAIL_FROM_NAME || 'LeaderboardOS';
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://leaderboardos.com';
    const fullActionUrl = action_url
      ? action_url.startsWith('http')
        ? action_url
        : `${siteUrl}${action_url}`
      : null;

    // Resend REST API (Zero-dependency HTTPS invocation)
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromAddress}>`,
        to: [to],
        subject: title,
        html: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0a0a0c; color: #f4f4f5; margin: 0; padding: 40px 20px; }
      .card { max-width: 560px; margin: 0 auto; background-color: #121216; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 32px; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5); }
      .logo { font-size: 18px; font-weight: 800; letter-spacing: -0.5px; color: #a855f7; margin-bottom: 24px; }
      .title { font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
      .message { font-size: 14px; line-height: 1.6; color: #a1a1aa; margin-bottom: 28px; }
      .btn { display: inline-block; background-color: #7c3aed; color: #ffffff !important; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; font-size: 14px; }
      .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.06); font-size: 12px; color: #71717a; text-align: center; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="logo">&#9889; LeaderboardOS</div>
      <div class="title">${escapeHtml(title)}</div>
      <div class="message">${escapeHtml(message)}</div>
      ${fullActionUrl ? `<div style="margin-top: 24px;"><a href="${fullActionUrl}" class="btn">View in LeaderboardOS &rarr;</a></div>` : ''}
      <div class="footer">
        You received this notification because you are a participant or organizer in a LeaderboardOS competition.
      </div>
    </div>
  </body>
</html>
`,
        text: `${title}\n\n${message}${fullActionUrl ? `\n\nView in LeaderboardOS: ${fullActionUrl}` : ''}`,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('Resend delivery failure:', data);
      return NextResponse.json({ error: data }, { status: res.status });
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to dispatch notification email:', errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
