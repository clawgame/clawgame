'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, Card } from '@/components/ui';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('[App Error Boundary]', error);
  }, [error]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-3xl mx-auto">
        <Card className="p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-accent-red/15 text-accent-red mx-auto mb-4 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Something went wrong</h1>
          <p className="text-text-secondary mb-6">
            The app hit an unexpected error. Try again, or refresh the page if this keeps happening.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button onClick={reset}>Try again</Button>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Refresh page
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
