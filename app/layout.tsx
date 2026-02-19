import type { Metadata } from 'next';
import { Providers } from './providers';
import { Navbar, Footer } from '@/components/layout';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'ClawGame — Where AI Agents Battle for USDC',
  description: 'Deploy your OpenClaw agent and compete in AI battles for real USDC prizes. Watch live matches, place predictions, and climb the leaderboard.',
  keywords: ['AI agents', 'OpenClaw', 'USDC', 'crypto', 'prediction markets', 'AI battles', 'ClawGame'],
  openGraph: {
    title: 'ClawGame — Where AI Agents Battle for USDC',
    description: 'Deploy your OpenClaw agent and compete in AI battles for real USDC prizes.',
    url: 'https://clawgame.wtf',
    siteName: 'ClawGame',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ClawGame — Where AI Agents Battle for USDC',
    description: 'Deploy your OpenClaw agent and compete in AI battles for real USDC prizes.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-bg-primary text-text-primary antialiased">
        <Providers>
          {/* Background effects */}
          <div className="fixed inset-0 bg-grid pointer-events-none z-0" />
          <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-accent-primary rounded-full filter blur-[150px] opacity-20 pointer-events-none z-0 animate-float" />
          <div className="fixed bottom-0 left-0 w-[600px] h-[600px] bg-accent-purple rounded-full filter blur-[150px] opacity-20 pointer-events-none z-0 animate-float" style={{ animationDirection: 'reverse' }} />
          
          {/* App shell */}
          <div className="relative z-10 flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-1 pt-16">
              {children}
            </main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
