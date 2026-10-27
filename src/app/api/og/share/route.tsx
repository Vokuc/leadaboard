import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getAuthoritativeShareData, ShareType } from '@/lib/sharing/service';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') || 'competition') as ShareType;
    const slug = searchParams.get('slug') || undefined;
    const handle = searchParams.get('handle') || undefined;
    const memberId = searchParams.get('member') || undefined;
    const matchId = searchParams.get('match') || undefined;
    const fixtureId = searchParams.get('fixture') || undefined;
    const achievementId = searchParams.get('achievement') || undefined;
    const version = searchParams.get('v') || undefined;

    const payload = await getAuthoritativeShareData({
      type,
      slug,
      handle,
      memberId,
      matchId,
      fixtureId,
      achievementId,
      version,
    });

    // PRIVACY ENFORCEMENT: Never expose private or unauthorized competition data
    if (!payload || payload.isPrivate) {
      return new ImageResponse(
        (
          <div
            style={{
              height: '100%',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#0a0a0f',
              color: '#ffffff',
              fontFamily: 'sans-serif',
              padding: '60px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 18px',
                borderRadius: '999px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                fontSize: 20,
                fontWeight: 600,
                marginBottom: 24,
              }}
            >
              🔒 Private Competition
            </div>
            <div
              style={{
                fontSize: 44,
                fontWeight: 800,
                color: '#ffffff',
                textAlign: 'center',
                maxWidth: 800,
              }}
            >
              This content is private or restricted.
            </div>
            <div
              style={{
                fontSize: 22,
                color: '#94a3b8',
                marginTop: 16,
                textAlign: 'center',
              }}
            >
              LeaderboardOS does not expose unpublished or private competition results.
            </div>
          </div>
        ),
        {
          width: 1200,
          height: 630,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        }
      );
    }

    // Colors according to type
    let accentGradient = 'linear-gradient(135deg, #8b5cf6, #3b82f6)';
    let badgeBorder = 'rgba(139, 92, 246, 0.3)';
    let badgeBg = 'rgba(139, 92, 246, 0.12)';
    let badgeText = '#c4b5fd';

    if (payload.type === 'champion') {
      accentGradient = 'linear-gradient(135deg, #f59e0b, #d97706)';
      badgeBorder = 'rgba(245, 158, 11, 0.4)';
      badgeBg = 'rgba(245, 158, 11, 0.15)';
      badgeText = '#fcd34d';
    } else if (payload.type === 'achievement') {
      accentGradient = 'linear-gradient(135deg, #a855f7, #ec4899)';
      badgeBorder = 'rgba(168, 85, 247, 0.4)';
      badgeBg = 'rgba(168, 85, 247, 0.15)';
      badgeText = '#f0abfc';
    } else if (payload.type === 'match') {
      accentGradient = 'linear-gradient(135deg, #06b6d4, #3b82f6)';
      badgeBorder = 'rgba(6, 182, 212, 0.4)';
      badgeBg = 'rgba(6, 182, 212, 0.15)';
      badgeText = '#67e8f9';
    }

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            backgroundColor: '#07070b',
            backgroundImage:
              'radial-gradient(circle at 50% 0%, rgba(124, 58, 237, 0.15) 0%, transparent 60%)',
            color: '#ffffff',
            fontFamily: 'sans-serif',
            padding: '56px 64px',
            position: 'relative',
          }}
        >
          {/* Top Brand Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
            }}
          >
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: accentGradient,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  fontWeight: 900,
                  color: '#ffffff',
                  boxShadow: '0 4px 20px rgba(124, 58, 237, 0.4)',
                }}
              >
                ⚡
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: 26,
                    fontWeight: 900,
                    letterSpacing: '-0.02em',
                    color: '#ffffff',
                  }}
                >
                  LeaderboardOS
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#94a3b8',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  Competition Platform
                </span>
              </div>
            </div>

            {/* Verification Status Pill & Sponsor Badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 18px',
                  borderRadius: '999px',
                  backgroundColor: badgeBg,
                  border: `1px solid ${badgeBorder}`,
                  color: badgeText,
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                }}
              >
                <span>{payload.isVerified ? '✓' : '•'}</span>
                <span>{payload.verificationBadgeText || 'Official Record'}</span>
              </div>

              {payload.sponsorName && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid rgba(245, 158, 11, 0.35)',
                    color: '#fbbf24',
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  <span>✨</span>
                  <span>Presented by {payload.sponsorName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Center Card Content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 28,
              padding: '40px 48px',
              position: 'relative',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Category / Context Pill */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: 16,
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#a78bfa',
                }}
              >
                {payload.competitionName}
              </span>
              {payload.highlightText && (
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: 6,
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#e2e8f0',
                  }}
                >
                  {payload.highlightText}
                </span>
              )}
            </div>

            {/* Main Title / Actor */}
            <div
              style={{
                fontSize: payload.title.length > 35 ? 44 : 54,
                fontWeight: 900,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                color: '#ffffff',
                marginBottom: 12,
              }}
            >
              {payload.title}
            </div>

            {/* Subtitle / Details */}
            <div
              style={{
                fontSize: 22,
                color: '#94a3b8',
                lineHeight: 1.4,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
            >
              {payload.badgeIcon && (
                <span style={{ fontSize: 32 }}>{payload.badgeIcon}</span>
              )}
              <span>{payload.subtitle}</span>
            </div>
          </div>

          {/* Bottom Footer Info */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              fontSize: 16,
              color: '#64748b',
              fontWeight: 500,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Verified competitive result on</span>
              <strong style={{ color: '#cbd5e1' }}>leaderboardos.com</strong>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span>Format: {payload.competitionType}</span>
              <span>•</span>
              <span>Real-time Sync</span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error) {
    console.error('OG Share image generation failed:', error);
    return new Response('Image generation error', { status: 500 });
  }
}
