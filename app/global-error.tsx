'use client';

import { useEffect } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('[Global Error Boundary]', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-bg-primary text-text-primary flex items-center justify-center p-6">
        <div className="max-w-xl w-full rounded-2xl border border-border bg-bg-card p-8 text-center">
          <p className="text-sm uppercase tracking-wide text-accent-red mb-2">Fatal Error</p>
          <h1 className="text-3xl font-bold mb-3">Application crashed</h1>
          <p className="text-text-secondary mb-6">
            A critical error occurred while rendering the app shell.
          </p>
          <button
            onClick={reset}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-accent-primary text-bg-primary font-semibold hover:opacity-90 transition-opacity"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
