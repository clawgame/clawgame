// Self-deregistering service worker — cleans up stale COI service worker registrations.
// Solana embedded wallets don't need COOP/COEP (no SharedArrayBuffer required).
if (typeof window === 'undefined') {
  // Running as a service worker — deregister and stop intercepting fetches
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (e) => {
    e.waitUntil(
      self.registration.unregister().then(() => self.clients.matchAll()).then((clients) => {
        clients.forEach((client) => client.navigate(client.url));
      })
    );
  });
}
