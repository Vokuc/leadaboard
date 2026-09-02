'use client';

import { useEffect } from 'react';

export function useUnsavedChangesWarning(
  hasUnsavedChanges: boolean,
  message = 'You have unsaved changes. Are you sure you want to leave this page?'
) {
  useEffect(() => {
    if (!hasUnsavedChanges || typeof window === 'undefined') {
      return;
    }

    const confirmLeave = () => window.confirm(message);

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest('a');
      if (!anchor) {
        return;
      }

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || anchor.target === '_blank' || anchor.hasAttribute('download')) {
        return;
      }

      const nextUrl = new URL(href, window.location.href);
      const currentUrl = new URL(window.location.href);

      if (
        nextUrl.origin !== currentUrl.origin ||
        (nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search && nextUrl.hash === currentUrl.hash)
      ) {
        return;
      }

      if (!confirmLeave()) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const handlePopState = () => {
      if (confirmLeave()) {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        document.removeEventListener('click', handleDocumentClick, true);
        window.removeEventListener('popstate', handlePopState);
        window.history.back();
        return;
      }

      window.history.pushState({ leaderboardosGuard: true }, '', window.location.href);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleDocumentClick, true);
    window.addEventListener('popstate', handlePopState);
    window.history.pushState({ leaderboardosGuard: true }, '', window.location.href);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleDocumentClick, true);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [hasUnsavedChanges, message]);
}