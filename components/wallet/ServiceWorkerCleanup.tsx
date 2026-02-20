'use client';

import { useEffect } from 'react';

const CLEANUP_MARKER = 'clawgame:sw-cleanup:v1';

export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    if (localStorage.getItem(CLEANUP_MARKER)) return;
    localStorage.setItem(CLEANUP_MARKER, '1');

    void (async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        if (!registrations.length) return;

        // Remove stale registrations without forcing a reload that can cause
        // visible flicker on mobile navigation.
        await Promise.all(registrations.map((registration) => registration.unregister()));
      } catch (error) {
        console.warn('Service worker cleanup failed:', error);
      }
    })();
  }, []);

  return null;
}
