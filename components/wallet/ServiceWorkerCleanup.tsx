'use client';

import { useEffect } from 'react';

const CLEANUP_MARKER = 'clawgame:sw-cleanup:v1';

export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (sessionStorage.getItem(CLEANUP_MARKER)) return;
    sessionStorage.setItem(CLEANUP_MARKER, '1');

    void (async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        if (!registrations.length) return;

        await Promise.all(registrations.map((registration) => registration.unregister()));

        // Reload once so stale SW-controlled requests are fully cleared.
        window.location.reload();
      } catch (error) {
        console.warn('Service worker cleanup failed:', error);
      }
    })();
  }, []);

  return null;
}
