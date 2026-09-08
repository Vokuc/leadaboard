'use client';

import React from 'react';
import { logOrganicEvent } from '@/lib/analytics/events';

interface TrackedDownloadButtonProps {
  href: string;
  templateName: string;
  className?: string;
  children: React.ReactNode;
}

export function TrackedDownloadButton({ href, templateName, className, children }: TrackedDownloadButtonProps) {
  return (
    <a 
      href={href}
      download
      onClick={() => logOrganicEvent('ORGANIC_TEMPLATE_DOWNLOAD', { template: templateName })}
      className={className}
    >
      {children}
    </a>
  );
}
