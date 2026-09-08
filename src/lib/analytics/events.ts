/**
 * Lightweight organic conversion tracking system.
 * This stores the referrer and tracks specific SEO conversion events.
 */

const REFERRER_KEY = 'leaderboardos_referrer';
const UTM_SOURCE_KEY = 'leaderboardos_utm_source';

export function captureOrganicReferrer() {
  if (typeof window === 'undefined') return;

  // Only capture if not already set
  if (!localStorage.getItem(REFERRER_KEY)) {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get('utm_source');
    
    if (utmSource) {
      localStorage.setItem(UTM_SOURCE_KEY, utmSource);
    } else if (document.referrer) {
      // If no UTM, but there's a referrer (like Google, Bing)
      localStorage.setItem(REFERRER_KEY, document.referrer);
    }
  }
}

export type SeoEventType = 
  | 'ORGANIC_SIGNUP'
  | 'ORGANIC_LEADERBOARD_CREATION'
  | 'ORGANIC_TEMPLATE_DOWNLOAD';

export function logOrganicEvent(eventType: SeoEventType, metadata?: any) {
  if (typeof window === 'undefined') return;

  const referrer = localStorage.getItem(REFERRER_KEY);
  const utmSource = localStorage.getItem(UTM_SOURCE_KEY);

  // If there's no organic history, we don't log it as an organic event
  if (!referrer && !utmSource) return;

  const isGoogle = referrer?.includes('google') || utmSource === 'google';
  
  // In a production system, this would push to PostHog, Mixpanel, or custom DB table
  console.log(`[SEO Analytics] Event Triggered: ${eventType}`, {
    source: isGoogle ? 'google' : 'other_organic',
    rawReferrer: referrer,
    rawUtm: utmSource,
    timestamp: new Date().toISOString(),
    ...metadata
  });
}
