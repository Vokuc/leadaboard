'use client';

import { useEffect } from 'react';
import { captureOrganicReferrer } from '@/lib/analytics/events';

export function AnalyticsTracker() {
  useEffect(() => {
    captureOrganicReferrer();
  }, []);

  return null;
}
